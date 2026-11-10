# VidaMais independente para Android

O APK de release inclui o código JavaScript e os recursos do aplicativo. Depois de instalado, abre pelo próprio ícone e não precisa de Expo Go, USB, QR code ou servidor no computador. O SQLite funciona no aparelho; a sincronização com Supabase usa a internet do celular.

## Gerar novamente no Windows

Requisitos: Node.js 22+, JDK 17 ou 21, Android SDK e dependências instaladas com `npm ci`. Configure `JAVA_HOME` e `ANDROID_HOME` caso estejam fora dos caminhos detectados pelo script. O `.env` é opcional: URL e chave Publishable habilitam a sincronização online; sem elas, SQLite e OCR local com ML Kit continuam disponíveis. A análise Gemini exige o Supabase configurado.

Na pasta `frontEnd`, execute:

```powershell
npm run build:apk
```

O arquivo final será `artifacts/VidaMais.apk`. A configuração padrão gera para Android **ARM64** (`arm64-v8a`), incluindo ML Kit e os fluxos atuais de captura de imagens, OCR e Gemini. Para incluir outras arquiteturas, execute o script com `-Arquiteturas 'armeabi-v7a,arm64-v8a,x86,x86_64'`; isso aumenta o tamanho e o tempo de compilação.

Release atual gerada em 09/11/2026: `artifacts/VidaMais.apk`, 41,346,827 bytes (aproximadamente 39.4 MiB), ABI `arm64-v8a`. O certificado de assinatura conferido tem SHA-256 `ed15cbdc048ed924c90d4d9d8ed0d80fc0636b4dc9ae29b185045f7e47630a85`; a release usa o mesmo certificado da versão anterior. O Manifest solicita câmera e acesso à internet, sem permissão ampla de leitura da galeria. A verificação criptográfica passou; isso não substitui a instalação e validação funcional em um aparelho.

Em workspaces Windows com caminho longo, o script monta uma cópia curta temporária e instala exatamente o `package-lock.json` para contornar o limite de caminho do Ninja. O APK resultante é copiado para `artifacts/` no projeto original. A cópia temporária é removida ao final.

A New Architecture do React Native está desativada no Android porque o módulo OCR ML Kit usa a interface nativa clássica e não declara validação com a arquitetura nova. A leitura real da câmera, seleção de imagens, consentimento e chamada Gemini devem ser confirmados no aparelho.

O Android Gradle Plugin pode baixar componentes do SDK na primeira compilação. O projeto nativo está em `android/` e inclui a configuração de assinatura. Não use `expo prebuild --clean` sem reaplicar e revisar essa configuração.

## Assinatura e atualizações

A pasta `.signing/` contém a chave e as credenciais de assinatura e é ignorada pelo Git. Guarde um backup privado dos dois arquivos. As próximas versões devem usar a mesma chave para poderem atualizar o aplicativo sem desinstalá-lo.

Após alterar código, gere e instale um novo APK. Essa versão não utiliza atualizações automáticas pelo servidor Expo.

## Instalar

Envie `VidaMais.apk` ao celular e abra-o para instalar, autorizando a instalação por essa origem quando o Android solicitar. Também é possível instalar por USB:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r .\artifacts\VidaMais.apk
& $adb shell am start -n br.com.vidamais.app/.MainActivity
```

O aplicativo instalado tem armazenamento e sessão próprios. Os cadastros feitos anteriormente dentro do Expo Go ou no navegador não são migrados automaticamente. A instalação do APK não remove esses cadastros anteriores.
