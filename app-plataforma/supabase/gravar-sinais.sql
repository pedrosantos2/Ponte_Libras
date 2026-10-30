-- Execute DEPOIS de confirmar-email.sql. Vídeos privados, até 10 MB.
-- Não há política de update/upsert: um clipe enviado não pode ser sobrescrito.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sinais-contribuidos', 'sinais-contribuidos', false, 10485760, array['video/webm', 'video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

drop policy if exists "consultar os proprios sinais" on storage.objects;
create policy "consultar os proprios sinais" on storage.objects
for select to authenticated using (
  bucket_id = 'sinais-contribuidos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
-- A equipe revisa os vídeos no painel administrativo do Supabase.
-- Não conceda acesso público ao bucket nem coloque service_role no front-end.
