-- Execute uma vez no SQL Editor do projeto Supabase existente.
begin;
alter table public.medicamentos add column if not exists texto_ocr text not null default '';
alter table public.medicamentos add column if not exists leitura_em text not null default '';
notify pgrst, 'reload schema';
commit;

-- Conferir depois de cadastrar pela câmera e sincronizar:
-- select nome, validade, texto_ocr, leitura_em, sync_id from public.medicamentos
-- where texto_ocr <> '' order by updated_at desc;
