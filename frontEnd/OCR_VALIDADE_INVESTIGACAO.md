# Investigation: OCR de validade e lote

Atualizado em 08/11/2026. Esta análise separa fatos observados no código de hipóteses sobre a embalagem física da Eurofarma, que ainda precisa ser testada com o APK novo.

## Causas comprovadas no código

- A câmera e a galeria entregam URIs locais ao serviço `reconhecerTexto`; o app não redimensionava nem transformava essas imagens antes do ML Kit. O ImagePicker usa `quality: 1`, a qualidade máxima configurada. A compressão já realizada pelo sensor/aplicativo da câmera do aparelho não pode ser inferida do código.
- No Android, a implementação instalada de `@react-native-ml-kit/text-recognition` usa `InputImage.fromFilePath` para URIs locais. A documentação do ML Kit documenta essa origem de imagem e também a rotação explícita para entradas bitmap/memória. O app não fazia tentativas em outras orientações do conteúdo da foto.
- A ponte nativa devolve `Text.text` e os blocos; o app consumia só o texto combinado. Se esse texto viesse vazio, `ocr.ts` lançava “Nenhum texto legível”, que a UI mostrava como falha técnica/parcial. A partir desta correção, texto vazio é classificado como “nenhum texto detectado”; exceções permanecem como falhas técnicas.
- O parser anterior aceitava um conjunto curto de rótulos e datas com separadores. Não interpretava de forma abrangente fabricação/validade em linhas separadas, abreviações farmacêuticas e códigos compactos. Não é possível afirmar pelo código que esse parser causou a ausência de texto visual; ele só atua depois do OCR.
- Não havia fixture da embalagem nem imagem física disponível no workspace. Portanto, tamanho de ponto, contraste, foco, perspectiva e compressão efetiva da foto Eurofarma não foram medidos.

## Hipóteses que exigem ensaio físico

- A impressão dot-matrix pode estar abaixo do tamanho de caractere reconhecível por causa da distância, foco, movimento ou do baixo contraste entre pontos e fundo.
- A perspectiva ou reflexo na parte inferior pode reduzir a legibilidade. O código não permite confirmar essas condições da fotografia usada.
- A rotação EXIF de uma imagem local é entregue ao ML Kit por `InputImage.fromFilePath`; o pacote não expõe metadados de orientação para a tela. A leitura em 90/180/270 graus e o mapeamento do recorte em fotos com EXIF precisam de conferência no Android real.
- Não existe benchmark visual das transformações usando a caixa da domperidona. Os testes automatizados verificam seleção de pipeline, parser e preservação de dados, não acurácia visual do ML Kit.

## Processamento implementado

1. Cada imagem é enviada ao ML Kit original primeiro, sem resize do app e sem sobrescrever o URI original.
2. No modo **Ler validade e lote**, se o original não trouxer uma validade rotulada, a pessoa pode arrastar um retângulo sobre a área de fabricação/validade/lote. `expo-image-manipulator` salva esse recorte como PNG sem perda JPEG e mantém a fotografia original na sessão.
3. O recorte é reconhecido como tentativa adicional. Se ainda não houver candidato rotulado, o app tenta 90°, 180° e 270°, parando quando uma orientação gera candidato. Os resultados da foto original e da orientação alternativa ficam identificados no texto OCR; linhas duplicadas são removidas. Uma falha em transformar a imagem não descarta um resultado já reconhecido.
4. Não foi adicionado grayscale, ajuste de contraste/brilho, redução de ruído, sharpen, limiarização ou correção de perspectiva. O `expo-image-manipulator` disponível oferece recorte/rotação, mas não essas operações. Evitamos adicionar processamento pesado que não foi medido em imagens reais. Ampliação digital foi evitada porque não recupera pontos ausentes e pode criar artefatos.

## Datas e segurança da interpretação

- Rótulos de validade: `VALIDADE`, `VAL`, `VENC`, `VENCIMENTO`, `EXP`, `EXPIRY`, `EXPIRACAO` e `V:`. Abreviação `V` exige dois-pontos/igual. `F`, `FAB`, `FABR`, `FABRICACAO` e `MFG` delimitam contexto de fabricação e nunca são usados como validade.
- Datas aceitas: `DD/MM/AAAA`, `DD/MM/AA`, `DD.MM.AAAA`, `DD-MM-AA`, `MM/AAAA`, `MM/AA` e formas compactas rotuladas `DDMMAAAA`, `MMAAAA` e `MMYY`.
- Em datas por mês/ano, usa-se o último dia do mês conforme regra do app, e a tela avisa para confirmar a embalagem.
- Confusões `O/Q/D→0`, `I/L/|→1`, `S→5` e `B→8` só são normalizadas dentro de um candidato já associado a rótulo de validade. A interface avisa quando essa correção foi usada.
- Datas impossíveis são recusadas. Código numérico de lote sem rótulo de validade não é data. A fabricação não vira validade e não se calcula prazo a partir dela. Se houver duas datas de validade distintas, nenhuma é escolhida automaticamente; o conflito aparece para revisão.

## Dados persistidos

Nenhuma tabela, coluna SQLite ou objeto PostgreSQL foi alterado. Imagens e recortes permanecem locais e temporários. O texto OCR original e as tentativas identificadas continuam preenchendo `texto_ocr`; `leitura_em` é atualizado após reconhecimento. O usuário continua revisando os campos, e campos não vazios não são sobrescritos.

## Como repetir o teste da domperidona Eurofarma

Instale o APK atualizado, abra **Novo medicamento > Ler validade e lote**, fotografe a parte inferior em foco, aproxime até os caracteres ficarem visíveis, e analise. Se a data não aparecer, use **Recortar data** para desenhar a região pontilhada e repita. O app então consulta o recorte e tenta as rotações faltantes. Compare o texto rotulado exibido por imagem com a embalagem antes de confirmar validade e lote. Registre também se a orientação e o recorte acompanham corretamente a foto.
