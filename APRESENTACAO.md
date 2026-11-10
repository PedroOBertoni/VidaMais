# Vida+ — apresentação do 2º bimestre

Abra [APRESENTACAO.html](APRESENTACAO.html) no navegador para apresentar os sete slides. Use as setas para navegar e o botão Tela cheia. A impressão do navegador permite exportar para PDF em paisagem.

## Slide 1 — Problema (45 segundos)

**Como acompanhar a validade dos medicamentos guardados em casa e encontrar suas informações de bula?**

O cadastro manual exige digitação e facilita esquecimentos. O Vida+ organiza a farmacinha e destaca medicamentos vencidos ou próximos de vencer.

## Slide 2 — Continuidade do projeto (45 segundos)

- React Native + Expo: aplicativo para smartphone.
- Expo SQLite: cadastro e consulta no próprio aparelho, inclusive sem internet.
- Supabase / PostgreSQL: sincronização dos registros do usuário.
- Evolução do 2º bimestre: várias imagens, OCR local com ML Kit e Gemini Vision complementar para lote, fabricação e validade.

## Slide 3 — Visão computacional (1 minuto)

1. O usuário adiciona imagens pela câmera ou galeria e pode recortar a região de interesse.
2. Embalagem e bula usam Google ML Kit no aparelho; validade e lote usam Gemini via Edge Function autenticada.
3. A análise aplica resultados ao cadastro e retorna automaticamente ao formulário.
4. O usuário confere os campos e o texto OCR original antes de salvar.

O reconhecimento de texto e a extração de campos são etapas diferentes. O nome é uma sugestão baseada no texto impresso, não uma identificação clínica. Se a validade estiver na lateral, uma segunda foto complementa os campos vazios. Datas sem rótulo de validade não são usadas para evitar confusão com fabricação.

## Slide 4 — Demonstração no smartphone (3 minutos)

Espelhar o celular e executar:

1. Abrir **Cadastrar medicamento → Ler embalagem** e adicionar fotos da frente e da lateral, combinando câmera e galeria.
2. Tocar **Analisar imagens**; mostrar o retorno automático ao cadastro, as sugestões de nome/laboratório e revisar os campos.
3. Abrir **Ler validade e lote**, explicar o consentimento antes do envio, selecionar/fotografar a impressão e analisar.
4. Mostrar a validade aplicada e lote/fabricação preservados no texto OCR. Abrir **Ver texto original** e conferir tudo contra a embalagem.
5. Em **Ler bula**, selecionar imagens de páginas e revisar as sugestões estruturadas. A bula inteira não é copiada automaticamente para Observações.
6. Salvar e abrir o registro. Mostrar a situação da validade e o texto OCR associado ao medicamento.

Não usar conteúdo fictício como se tivesse sido reconhecido pela câmera. Escolher antes uma caixa cuja impressão tenha sido validada no aparelho da apresentação.

## Slide 5 — Prova de SQLite e modo offline (1 minuto)

1. Desativar a internet antes de cadastrar outro medicamento manualmente ou pela leitura local de embalagem/bula.
2. Salvar e mostrar **Envio ao Supabase pendente** nos detalhes.
3. Fechar e abrir o app: medicamento, texto OCR e data de leitura continuam disponíveis.

O SQLite guarda `texto_ocr` e `leitura_em` na mesma linha do medicamento. O rastreador usa a validade revisada para calcular sua situação.

## Slide 6 — Prova de Supabase (1 minuto e 30 segundos)

1. Restaurar a internet. O fluxo Gemini de validade/lote requer conexão e consentimento quando ainda não autorizado.
2. Usar **Sincronizar** na tela inicial.
3. Mostrar **Sincronizado com Supabase** nos detalhes (reabrir a tela se necessário).
4. No painel Supabase, mostrar o registro da tabela `medicamentos`, incluindo `nome`, `validade`, `texto_ocr`, `leitura_em` e `sync_id`.

Consulta no SQL Editor:

```sql
select nome, validade, texto_ocr, leitura_em, sync_id
from public.medicamentos
where texto_ocr <> ''
order by updated_at desc;
```

O `sync_id` relaciona a linha local e a remota. As políticas RLS limitam os registros ao usuário autenticado.

## Slide 7 — Bula e conclusão (45 segundos)

Mostrar **Ver bula** com as informações cadastradas. O OCR sugere campos a partir das seções fotografadas; não gera conteúdo ausente das fotos nem consulta uma base farmacêutica.

Contribuição: menos digitação no cadastro, acompanhamento da validade e consulta organizada de informações, com funcionamento local e cópia online.

Tempo planejado: **8 minutos e 45 segundos**, com margem para trocas de tela.

## Preparação obrigatória antes da aula

- Aplicar [a migração OCR](backEnd/migracao-ocr.sql) no SQL Editor do Supabase.
- Instalar o APK atualizado no Android. O leitor OCR usa módulo nativo e não funciona no Expo Go nem no navegador.
- Confirmar que a Edge Function `analisar-validade` está publicada, autenticada e com o secret `GEMINI_API_KEY` configurado; nunca incluir a chave no APK.
- Preparar a autorização Gemini antes da demonstração e explicar que validade/lote envia apenas imagens selecionadas ou recortes após consentimento.
- Confirmar câmera autorizada, foco, iluminação e leitura da caixa escolhida.
- Confirmar autenticação anônima habilitada e uma sincronização completa.
- Testar fechar/reabrir offline e sincronizar após reconectar.
- Separar uma caixa com validade e a bula impressa; oculte dados pessoais de receitas.
- Preparar espelhamento por USB e carregador. Consultar [as instruções de USB](frontEnd/USB.md).
- Manter uma segunda embalagem já testada como alternativa para reflexos/foco.
- Abrir o painel Supabase antes da aula e deixar a tabela preparada.

## Critérios e evidências

| Critério | Evidência na demonstração |
|---|---|
| Visão computacional — 4,0 | Foto real → OCR no celular → texto reconhecido |
| Integração com o problema — 2,0 | Nome e validade preenchem o cadastro e alimentam o rastreador |
| SQLite — 1,5 | Registro com OCR continua disponível após reabrir sem internet |
| Supabase — 1,5 | Mesma leitura aparece nas colunas da tabela remota |
| Organização — 1,0 | Cadastro, consulta, edição, filtros, bula e estados de sincronização |
