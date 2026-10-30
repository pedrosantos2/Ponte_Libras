-- Amplia a coleta para sugestões; mantém login, confirmação e isolamento.
-- O nome sugerido fica em user_metadata.nome_sugerido, fora do caminho.
begin;
drop policy if exists "contribuir sinais com email confirmado" on storage.objects;
create policy "contribuir sinais com email confirmado" on storage.objects
for insert to authenticated with check (
  bucket_id = 'sinais-contribuidos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = any(array[
    'OI', 'OI_ACENO', 'GOSTAR', 'LARANJA', 'ABACAXI', 'BANANA', 'MORANGO',
    'ACONTECER', 'AMARELO', 'BANHEIRO', 'MEDO', 'BOM', '_NOVO'
  ])
  and array_length(storage.foldername(name), 1) = 2
  and lower(storage.extension(name)) in ('webm', 'mp4')
  and exists (select 1 from public.emails_confirmados c where c.user_id = (select auth.uid()))
);

commit;
