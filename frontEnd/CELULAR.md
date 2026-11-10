# Abrir o Vida+ no Android

1. Instale o **Expo Go compatível com SDK 54**, disponível na [página oficial do Expo](https://expo.dev/go?sdkVersion=54&platform=android&device=true).
2. Conecte o celular à mesma rede Wi-Fi do computador.
3. Com o servidor Expo em execução, abra **Scan QR code** no Expo Go e escaneie [qrcode.png](qrcode.png).

Endereço desta sessão: `exp://192.168.2.6:8081`.

O QR code abre o projeto dentro do Expo Go. Não é um APK independente do Vida+; o computador precisa continuar ligado e com o servidor em execução.

O Expo Go serve para desenvolvimento e cadastro manual, mas não inclui o módulo nativo do ML Kit. Para câmera e OCR local de embalagem/bula, use o APK release ou outra build nativa. A análise Gemini é remota e precisa de consentimento, rede e Edge Function publicada; sua validação documentada é pela build Android. Consulte [OCR.md](OCR.md) e [GEMINI_VISION_SETUP.md](GEMINI_VISION_SETUP.md).

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

## Conferir recursos no aparelho

Com o APK instalado, teste o cadastro manual, Home/listagem, detalhe, edição, exclusão, Snackbar e sincronização na tabela `medicamentos` do Supabase. Depois faça um cadastro sem conexão à nuvem e reabra o aplicativo com conexão para enviar os dados pendentes. Os roteiros específicos de câmera/galeria, OCR e Gemini estão em [TESTES_FINAIS.md](../TESTES_FINAIS.md).

Ainda é necessário conferir no smartphone o foco da câmera, seleção de imagens, permissões, renderização do diálogo de exclusão e análise Gemini com uma embalagem real. A validação em Expo Go ou navegador não comprova esses fluxos nativos. Para usar no navegador, siga [WEB.md](WEB.md).
