# Abrir o Vida+ no Android

1. Instale o **Expo Go compatível com SDK 54**, disponível na [página oficial do Expo](https://expo.dev/go?sdkVersion=54&platform=android&device=true).
2. Conecte o celular à mesma rede Wi-Fi do computador.
3. Com o servidor Expo em execução, abra **Scan QR code** no Expo Go e escaneie [qrcode.png](qrcode.png).

Endereço desta sessão: `exp://192.168.2.6:8081`.

O QR code abre o projeto dentro do Expo Go. Não é um APK independente do Vida+; o computador precisa continuar ligado e com o servidor em execução.

## Iniciar novamente

Na pasta `frontEnd`:

```powershell
npx expo start --lan --port 8081 --max-workers 1
```

Se o IP do computador mudar, use o novo endereço exibido pelo Expo para gerar o QR novamente:

```powershell
node scripts/gerar-qrcode.cjs exp://NOVO_IP:8081
```

A configuração pública do Supabase está em `.env`, que é ignorado pelo Git.

## Conferir no aparelho

Cadastre um medicamento, abra seus detalhes e a bula, edite e exclua. Confira as mudanças na tabela `medicamentos` do Supabase. Depois faça um cadastro sem conexão à nuvem e reabra o aplicativo com conexão para enviar os dados pendentes.

Já foram validados TypeScript, os sete testes de datas, a geração do bundle Android e o fluxo completo no Chrome com SQLite real e Supabase, incluindo a correção da altura dos filtros. Ainda é necessário conferir a execução nativa no celular. Para usar no navegador, siga [WEB.md](WEB.md).
