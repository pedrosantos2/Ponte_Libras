-- Ponte Libras: quem confirmou o e-mail com o código.
-- Rode uma vez no Supabase, em SQL Editor → New query. Pode rodar de novo
-- depois de mudar este arquivo: ele recria tudo sem apagar as confirmações.
--
-- Por quê: "Confirm email" fica desligado para a pessoa entrar no painel logo
-- depois do cadastro. Assim o Supabase marca todo e-mail como confirmado
-- (email_confirmed_at) e esse campo não prova nada. Esta tabela guarda a
-- confirmação de verdade, que vai liberar a gravação de sinais.
--
-- Como a prova funciona:
-- 1. Toda sessão aberta com um código do e-mail (verifyOtp) traz o método
--    "otp" no token (claim amr), com a hora, assinado pelo Supabase. A pessoa
--    não consegue inventar esse token. Uma sessão aberta pelo Google também
--    prova, porque o Google já confirmou o e-mail.
-- 2. A prova precisa ser mais nova que a última troca de e-mail da conta
--    (senão um código do e-mail antigo confirmaria o novo).
-- 3. Como o cadastro não confirma o e-mail na hora, outra pessoa pode ter
--    criado a conta com este e-mail e escolhido a senha. Por isso, se a conta
--    tem senha, quem provou o e-mail precisa mostrar que sabe essa senha (ou
--    criar uma nova, o que desconecta as outras sessões).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.emails_confirmados (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  confirmado_em timestamptz not null default now()
);

alter table public.emails_confirmados enable row level security;

-- Cada pessoa só vê a própria linha. Não há política de insert nem de update:
-- só a função conferir_email grava.
drop policy if exists "ver a propria confirmacao" on public.emails_confirmados;
create policy "ver a propria confirmacao" on public.emails_confirmados
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Quando o e-mail de uma conta mudou pela última vez. Ninguém lê de fora (RLS
-- ligado e sem política).
create table if not exists public.trocas_de_email (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trocado_em timestamptz not null
);

alter table public.trocas_de_email enable row level security;

-- Trocou o e-mail: a confirmação antiga não vale para o novo
create or replace function public.ao_trocar_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    delete from public.emails_confirmados where user_id = new.id;
    insert into public.trocas_de_email (user_id, trocado_em)
    values (new.id, now())
    on conflict (user_id) do update set trocado_em = excluded.trocado_em;
  end if;
  return new;
end;
$$;

drop trigger if exists ao_trocar_email on auth.users;
create trigger ao_trocar_email
  after update of email on auth.users
  for each row execute function public.ao_trocar_email();

-- A versão antiga da função não tinha parâmetro
drop function if exists public.conferir_email();

-- Responde 'confirmado', 'falta-confirmar' (precisa digitar o código do
-- e-mail) ou 'falta-senha' (provou o e-mail, mas falta mostrar que sabe a
-- senha da conta). Registra a confirmação quando tem as provas.
create or replace function public.conferir_email(p_senha text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := auth.uid();
  v_email text;
  v_hash text;
  v_troca timestamptz;
  v_prova boolean;
  v_sabe_a_senha boolean := false;
begin
  if v_id is null then
    return 'falta-confirmar';
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
  from auth.users u where u.id = v_id;
  if v_email is null then
    return 'falta-confirmar';
  end if;

  if exists (
    select 1 from public.emails_confirmados c
    where c.user_id = v_id and lower(c.email) = lower(v_email)
  ) then
    return 'confirmado';
  end if;

  select t.trocado_em into v_troca from public.trocas_de_email t where t.user_id = v_id;

  v_prova :=
    -- 1. sessão aberta com um código mandado depois da última troca de e-mail
    exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m
      where m ->> 'method' in ('otp', 'magiclink', 'recovery')
        and (v_troca is null or to_timestamp((m ->> 'timestamp')::double precision) > v_troca)
    )
    -- 2. a sessão atual foi aberta pelo Google, e o Google confirmou este
    --    mesmo e-mail (só ter a identidade ligada não basta: uma sessão de
    --    senha, de quem criou a conta, não pode usar a prova do Google)
    or (
      exists (
        select 1
        from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m
        where m ->> 'method' = 'oauth'
      )
      and exists (
        select 1 from auth.identities i
        where i.user_id = v_id and i.provider = 'google' and lower(i.email) = lower(v_email)
      )
    );

  if not v_prova then
    return 'falta-confirmar';
  end if;

  -- 3. a senha da conta é de quem provou o e-mail
  if coalesce(v_hash, '') <> '' then
    if p_senha is not null then
      begin
        v_sabe_a_senha := extensions.crypt(p_senha, v_hash) = v_hash;
      exception when others then
        -- senha guardada num formato que o pgcrypto não lê: pede uma nova
        v_sabe_a_senha := false;
      end;
    end if;
    if not v_sabe_a_senha then
      return 'falta-senha';
    end if;
  end if;

  insert into public.emails_confirmados (user_id, email)
  values (v_id, v_email)
  on conflict (user_id) do update set email = excluded.email, confirmado_em = now();
  return 'confirmado';
end;
$$;

revoke all on function public.conferir_email(text) from public, anon;
grant execute on function public.conferir_email(text) to authenticated;

revoke all on function public.ao_trocar_email() from public, anon, authenticated;

-- Quando a gravação existir, a política da tabela de gravações pode exigir:
--   exists (select 1 from public.emails_confirmados c where c.user_id = (select auth.uid()))
-- (o gatilho acima apaga a linha quando o e-mail muda)
