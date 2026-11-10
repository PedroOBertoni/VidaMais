# Abrir o VidaMais pelo cabo USB (Android)

## Apresentação do 2º bimestre: APK com OCR

Instale o APK atualizado, que abre pelo próprio ícone e inclui seleção de várias imagens, ML Kit para embalagem/bula e Gemini remoto para validade/lote (com consentimento). O Expo Go não inclui o ML Kit nativo; use a build Android para validar câmera e OCR local. Consulte [OCR.md](OCR.md), [GEMINI_VISION_SETUP.md](GEMINI_VISION_SETUP.md) e [APK.md](APK.md).

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb install -r .\artifacts\VidaMais.apk
& $adb shell am start -n br.com.vidamais.app/.MainActivity
```

Para espelhar, use o programa de espelhamento já preparado no computador (por exemplo, scrcpy, se instalado) e deixe o aparelho desbloqueado e a depuração USB autorizada. O APK não precisa de Metro nem de `adb reverse`.

## Modo antigo: desenvolvimento no Expo Go (sem OCR)

Esta versão executa dentro do Expo Go compatível com SDK 54. A conexão com o notebook é feita por USB, sem precisar do QR code nem da mesma rede Wi-Fi.

## Para abrir novamente

1. Conecte o celular por USB, desbloqueie e aceite a depuração USB, se solicitado.
2. Na pasta `frontEnd`, inicie o servidor (caso ainda não esteja aberto):

```powershell
npx expo start --localhost --port 8081 --max-workers 1
```

3. Em outro terminal PowerShell, execute:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb reverse tcp:8081 tcp:8081
& $adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8081' -p host.exp.exponent
```

Mantenha o terminal do servidor aberto e o cabo conectado durante o uso. O celular precisa de internet para sincronizar com o Supabase; os dados locais ficam no SQLite do aparelho.

O Expo Go fica instalado no celular. O VidaMais é aberto dentro dele; ainda não foi produzido um APK independente do VidaMais.
