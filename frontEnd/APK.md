# VidaMais independente para Android

O APK de release inclui o código JavaScript e os recursos do aplicativo. Depois de instalado, abre pelo próprio ícone e não precisa de Expo Go, USB, QR code ou servidor no computador. O SQLite funciona no aparelho; a sincronização com Supabase usa a internet do celular.

## Gerar novamente no Windows

Requisitos: Node.js 22+, JDK 17 ou 21, Android SDK e dependências instaladas com `npm ci`. Configure `JAVA_HOME` e `ANDROID_HOME` caso estejam fora dos caminhos detectados pelo script. O `.env` é opcional: URL e chave Publishable habilitam a sincronização online; sem elas, SQLite e OCR continuam disponíveis.

Na pasta `frontEnd`, execute:

```powershell
npm run build:apk
```

O arquivo final será `artifacts/VidaMais.apk`. A configuração padrão gera para Android **ARM64**, arquitetura do Samsung SM-G781B usado nos testes anteriores. Para incluir outras arquiteturas, execute o script com `-Arquiteturas 'armeabi-v7a,arm64-v8a,x86,x86_64'`; isso aumenta o tamanho e o tempo de compilação.

Build release confirmado em 07/11/2026: APK de aproximadamente 99 MiB, assinado com o certificado privado VidaMais. O Manifest final solicita câmera e acesso à internet, sem permissões de armazenamento externo. A verificação criptográfica da assinatura passou; isso não substitui a instalação e validação funcional em um aparelho.

Em workspaces Windows com caminho longo, o script monta uma cópia curta temporária e instala exatamente o `package-lock.json` para contornar o limite de caminho do Ninja. O APK resultante é copiado para `artifacts/` no projeto original. A cópia temporária é removida ao final.

A New Architecture do React Native está desativada no Android porque o módulo OCR ML Kit usa a interface nativa clássica e não declara validação com a arquitetura nova. O APK foi compilado nessa configuração; a leitura real da câmera ainda deve ser confirmada no aparelho da apresentação.

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
