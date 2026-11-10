# Investigação do OCR de validade e lote

Atualizado em 09/11/2026. Este documento registra a limitação observada no ML Kit com impressão industrial pontilhada e o fluxo de produção implementado depois dessa investigação.

## Estado atual do produto

- **Embalagem e bula:** Google ML Kit reconhece texto localmente no APK.
- **Validade e lote:** o app usa a Supabase Edge Function `analisar-validade`, que chama `gemini-3.5-flash-lite` pelo endpoint `v1beta/models/gemini-3.5-flash-lite:generateContent`.
- A interface usa o botão **Analisar imagens** para todos os fluxos e aceita múltiplas fotos da câmera e galeria, com pré-visualização, remoção e recorte da área de validade.
- No fluxo Gemini, imagem/recorte só é enviado depois do consentimento explícito. O app aplica os resultados ao cadastro e fecha o seletor quando uma resposta válida chega; se todas falharem, mantém o seletor aberto para nova tentativa.
- Uma validade digitada manualmente ou marcada como confiável é preservada. Lote, fabricação e linhas transcritas são guardados em `texto_ocr`; `leitura_em` registra a análise. As fotografias não são armazenadas no Supabase.
- A função limita a imagem a 3 MiB, aceita JPEG/PNG/WebP, restringe chamadas a 5 por usuário por minuto e interrompe a chamada do provedor após 12 segundos. A autenticação JWT permanece obrigatória.

A arquitetura, o consentimento, o deployment e o diagnóstico estão em [GEMINI_VISION_SETUP.md](GEMINI_VISION_SETUP.md). O guia para usar os fluxos está em [OCR.md](OCR.md).

## Limites do reconhecimento visual

O primeiro teste de uma embalagem Eurofarma de domperidona mostrou texto industrial difícil para o ML Kit convencional. Não havia fotografia física dessa embalagem disponível no workspace, portanto tamanho dos pontos, contraste, foco, perspectiva, reflexos e compressão da câmera não foram medidos pelo código. O Gemini foi adicionado como rota específica para validade/lote; não existe benchmark automatizado que prove sua acurácia com toda embalagem real.

O resultado confirmado no ambiente de desenvolvimento foi uma chamada autenticada à função com imagem sintética pequena e resposta JSON estruturada. A função respondeu HTTP 200. Esse teste prova a conexão com o provedor, mas não substitui o teste visual com a caixa física no smartphone.

## Interpretação e salvaguardas

- O prompt pede somente transcrição visível, considera rótulos como `L`, `F`, `V`, `FAB`, `VAL` e `EXP` e proíbe deduzir validade a partir da fabricação.
- A resposta Gemini valida lote, fabricação, validade, incertezas e avisos. Datas inválidas ou conflitos devem ser conferidos antes de salvar.
- A validade é preenchida somente se não houver valor manual/confiável protegido. Os campos de embalagem e bula são preenchidos sem substituir conteúdo digitado.
- O texto OCR pode ser consultado por **Ver texto original** no cadastro/detalhe. O resumo da análise não deve ser tratado como aconselhamento médico nem como identificação clínica.
- As imagens não são enviadas automaticamente: o app mostra a finalidade e pede autorização antes do uso da IA. A autorização pode ficar restrita à sessão, ser lembrada no dispositivo ou ser revogada.

## Ensaio físico recomendado

1. Instale [o APK ARM64 atualizado](APK.md) e habilite internet.
2. Abra **Ler validade e lote**, fotografe mais de uma face ou escolha imagens da galeria e confira as miniaturas.
3. Selecione **Recortar data** para enquadrar a impressão pontilhada, quando isso ajudar.
4. Aceite o consentimento e toque **Analisar imagens**. A tela deve retornar ao formulário com validade e texto OCR aplicados.
5. Compare validade, lote e fabricação com a embalagem; confira os campos incertos e abra **Ver texto original**.
6. Edite a validade manualmente, analise outra imagem e confirme que o valor manual foi preservado.
7. Salve offline e confira `texto_ocr`/`leitura_em`; depois sincronize e confirme os mesmos valores no Supabase.

Não marque a acurácia em smartphone como validada até executar esse ensaio com embalagem real. Os testes unitários verificam parsing, roteamento, preservação de campos e tratamento de falha; não avaliam foco, qualidade óptica nem acurácia do modelo sobre uma caixa específica.
