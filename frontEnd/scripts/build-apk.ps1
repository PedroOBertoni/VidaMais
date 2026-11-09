param([string]$Arquiteturas = 'arm64-v8a', [switch]$IgnorarCopiaCurta)

$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME) {
  $taskJdk = Join-Path $env:USERPROFILE '.jdks\ms-17.0.16'
  if (-not (Test-Path -LiteralPath (Join-Path $taskJdk 'bin\java.exe'))) {
    throw 'Defina JAVA_HOME com um JDK 17 antes de compilar.'
  }
  $env:JAVA_HOME = $taskJdk
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Configure ANDROID_HOME com o caminho do Android SDK.' }
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA 'Gradle' }

function Publish-ValidatedApk([string]$Source, [string]$Destination) {
  if (-not (Test-Path -LiteralPath $Source)) { throw 'O APK de release não foi encontrado após a compilação.' }
  $taskSdkBuildTools = Get-ChildItem -LiteralPath (Join-Path $env:ANDROID_HOME 'build-tools') -Directory |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
  if (-not $taskSdkBuildTools) { throw 'Não foi encontrada uma versão do Android Build Tools.' }
  $taskApkSigner = Join-Path $taskSdkBuildTools.FullName 'apksigner.bat'
  $taskAapt = Join-Path $taskSdkBuildTools.FullName 'aapt.exe'
  if (-not (Test-Path -LiteralPath $taskApkSigner) -or -not (Test-Path -LiteralPath $taskAapt)) {
    throw 'apksigner ou aapt não foi encontrado no Android Build Tools.'
  }

  $taskCandidate = Join-Path (Split-Path -Parent $Destination) ('.VidaMais-' + [guid]::NewGuid().ToString('N') + '.apk')
  try {
    Copy-Item -LiteralPath $Source -Destination $taskCandidate
    & $taskApkSigner verify --verbose $taskCandidate | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'A assinatura do APK candidato não passou na verificação.' }
    $taskPermissions = (& $taskAapt dump permissions $taskCandidate | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ler o Android Manifest do APK candidato.' }
    if ($taskPermissions -notmatch 'android\.permission\.INTERNET' -or $taskPermissions -notmatch 'android\.permission\.CAMERA') {
      throw 'O Android Manifest do APK não contém as permissões esperadas de internet e câmera.'
    }
    Move-Item -LiteralPath $taskCandidate -Destination $Destination -Force
  } finally {
    if (Test-Path -LiteralPath $taskCandidate) { Remove-Item -LiteralPath $taskCandidate -Force }
  }
}

# O Ninja pode ultrapassar o limite de caminho do Windows quando o workspace
# fica em uma pasta profunda do OneDrive. Nesse caso, faz uma cópia temporária
# curta, instala o lockfile e devolve o APK ao projeto original.
if (-not $IgnorarCopiaCurta -and $taskProject.Length -gt 100) {
  do {
    $taskTempRoot = Join-Path $env:TEMP ("vm-" + [guid]::NewGuid().ToString('N').Substring(0, 4))
  } while (Test-Path -LiteralPath $taskTempRoot)
  $taskShortProject = Join-Path $taskTempRoot (Split-Path -Leaf $taskProject)
  New-Item -ItemType Directory -Path $taskShortProject -Force | Out-Null
  $taskExcluded = @(
    (Join-Path $taskProject 'node_modules'),
    (Join-Path $taskProject 'android\.gradle'),
    (Join-Path $taskProject 'android\build'),
    (Join-Path $taskProject 'android\app\build'),
    (Join-Path $taskProject 'android\app\.cxx'),
    (Join-Path $taskProject '.signing'),
    (Join-Path $taskProject 'artifacts'),
    (Join-Path $taskProject 'dist-web')
  )
  & robocopy.exe $taskProject $taskShortProject /E /NFL /NDL /NJH /NJS /NP /XD $taskExcluded | Out-Null
  if ($LASTEXITCODE -gt 7) { throw 'Não foi possível preparar uma cópia curta do frontend para a compilação.' }
  if (Test-Path -LiteralPath (Join-Path $taskProject '.signing')) {
    Copy-Item -LiteralPath (Join-Path $taskProject '.signing') -Destination $taskShortProject -Recurse -Force
  }
  Push-Location $taskShortProject
  try {
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar as dependências na cópia curta.' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'scripts\build-apk.ps1' -Arquiteturas $Arquiteturas -IgnorarCopiaCurta
    if ($LASTEXITCODE -ne 0) { throw 'A compilação Android falhou na cópia curta do frontend.' }

    $taskArtifacts = Join-Path $taskProject 'artifacts'
    New-Item -ItemType Directory -Path $taskArtifacts -Force | Out-Null
    Publish-ValidatedApk -Source (Join-Path $taskShortProject 'artifacts\VidaMais.apk') -Destination (Join-Path $taskArtifacts 'VidaMais.apk')
    if (-not (Test-Path -LiteralPath (Join-Path $taskProject '.signing')) -and (Test-Path -LiteralPath (Join-Path $taskShortProject '.signing'))) {
      Copy-Item -LiteralPath (Join-Path $taskShortProject '.signing') -Destination $taskProject -Recurse -Force
    }
    Write-Output "APK gerado: $taskArtifacts\VidaMais.apk"
  } finally {
    Pop-Location
    if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA 'Gradle' }
    Push-Location (Join-Path $taskProject 'android')
    try { & .\gradlew.bat --stop --console=plain | Out-Null }
    finally { Pop-Location }
    $taskResolvedTemp = (Resolve-Path -LiteralPath $taskTempRoot).Path
    $taskResolvedTempBase = (Resolve-Path -LiteralPath $env:TEMP).Path.TrimEnd('\') + '\'
    if (-not $taskResolvedTemp.StartsWith($taskResolvedTempBase, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'O caminho temporário de compilação saiu da pasta TEMP; ele não foi removido.'
    }
    for ($taskCleanupAttempt = 0; $taskCleanupAttempt -lt 3 -and (Test-Path -LiteralPath $taskResolvedTemp); $taskCleanupAttempt++) {
      Remove-Item -LiteralPath $taskResolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
      if (Test-Path -LiteralPath $taskResolvedTemp) { Start-Sleep -Seconds 1 }
    }
    if (Test-Path -LiteralPath $taskResolvedTemp) { throw 'A pasta temporária de compilação está bloqueada e não pôde ser removida.' }
  }
  exit 0
}

if (-not $env:JAVA_HOME) {
  $taskJdk = Join-Path $env:USERPROFILE '.jdks\ms-17.0.16'
  if (-not (Test-Path -LiteralPath (Join-Path $taskJdk 'bin\java.exe'))) {
    throw 'Defina JAVA_HOME com o caminho de um JDK 17 antes de compilar.'
  }
  $env:JAVA_HOME = $taskJdk
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Configure ANDROID_HOME com o caminho do Android SDK.' }
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA 'Gradle' }
$env:NODE_ENV = 'production'
$env:EXPO_NO_TELEMETRY = '1'
$env:DEBUG = ''

Push-Location $taskProject
try {
  node scripts/preparar-assinatura.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar a assinatura.' }
  Push-Location android
  try {
    & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Arquiteturas" --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação Android.' }
  } finally { Pop-Location }
  $taskOutput = Join-Path $taskProject 'artifacts'
  New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
  Publish-ValidatedApk -Source (Join-Path $taskProject 'android\app\build\outputs\apk\release\app-release.apk') -Destination (Join-Path $taskOutput 'VidaMais.apk')
  Write-Output "APK gerado: $taskOutput\VidaMais.apk"
} finally { Pop-Location }
