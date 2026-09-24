-- =====================================================================
-- Portal de Relatórios de Ensaio — Éllu Ambiental
-- Esquema Supabase: tabelas, RLS, Storage e validação pública
-- Rode inteiro no SQL Editor do Supabase (pode rodar de novo com segurança)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text,
  email_contato text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Um perfil por usuário do Auth. cliente_id NULL + papel 'cliente' = sem acesso a nada.
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  email       text,
  cliente_id  uuid references public.clientes(id) on delete set null,
  papel       text not null default 'cliente' check (papel in ('cliente','admin')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.relatorios (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  numero           text not null,                -- ex.: RE-2026-0123
  revisao          int  not null default 0,
  titulo           text,
  projeto          text,
  ponto_coleta     text,
  matriz           text,                         -- água superficial, efluente, solo...
  data_coleta      date,
  data_emissao     date not null default current_date,
  status           text not null default 'vigente'
                   check (status in ('vigente','substituido','cancelado')),
  motivo_revisao   text,
  arquivo_path     text not null,                -- caminho no bucket 'relatorios'
  arquivo_nome     text,
  tamanho_bytes    bigint,
  hash_sha256      text not null,                -- integridade do PDF
  codigo_validacao text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
  publicado_por    uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  unique (numero, revisao)
);
create index if not exists relatorios_cliente_idx on public.relatorios(cliente_id, data_emissao desc);

-- Rastreabilidade: quem visualizou/baixou o quê e quando
create table if not exists public.acessos_log (
  id           bigserial primary key,
  relatorio_id uuid references public.relatorios(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  acao         text not null check (acao in ('visualizar','download')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES (security definer evita recursão no RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin' and ativo);
$$;

create or replace function public.meu_cliente() returns uuid
language sql stable security definer set search_path = public as $$
  select p.cliente_id from perfis p
  join clientes c on c.id = p.cliente_id
  where p.id = auth.uid() and p.ativo and c.ativo;
$$;

-- Cria o perfil automaticamente quando um usuário é criado no Auth.
-- NUNCA confia em cliente_id/papel vindos do metadata do usuário.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ao publicar nova revisão, a anterior (mesmo número) vira 'substituido'
create or replace function public.marcar_substituido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update relatorios set status = 'substituido'
   where numero = new.numero and id <> new.id and revisao < new.revisao and status = 'vigente';
  return new;
end $$;

drop trigger if exists trg_marcar_substituido on public.relatorios;
create trigger trg_marcar_substituido after insert on public.relatorios
  for each row execute function public.marcar_substituido();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.clientes    enable row level security;
alter table public.perfis      enable row level security;
alter table public.relatorios  enable row level security;
alter table public.acessos_log enable row level security;

-- clientes
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select
  using (is_admin() or id = meu_cliente());
drop policy if exists clientes_admin on public.clientes;
create policy clientes_admin on public.clientes for all
  using (is_admin()) with check (is_admin());

-- perfis: cada um vê o próprio; admin vê e edita todos
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select
  using (id = auth.uid() or is_admin());
drop policy if exists perfis_admin on public.perfis;
create policy perfis_admin on public.perfis for all
  using (is_admin()) with check (is_admin());

-- relatorios: cliente vê os seus (exceto cancelados); admin tudo
drop policy if exists relatorios_select on public.relatorios;
create policy relatorios_select on public.relatorios for select
  using (is_admin() or (cliente_id = meu_cliente() and status <> 'cancelado'));
drop policy if exists relatorios_admin on public.relatorios;
create policy relatorios_admin on public.relatorios for all
  using (is_admin()) with check (is_admin());

-- acessos_log: usuário registra os próprios acessos; só admin lê
drop policy if exists log_insert on public.acessos_log;
create policy log_insert on public.acessos_log for insert
  with check (user_id = auth.uid());
drop policy if exists log_select on public.acessos_log;
create policy log_select on public.acessos_log for select using (is_admin());

-- ---------------------------------------------------------------------
-- 4. STORAGE (bucket privado; pasta = cliente_id)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatorios', 'relatorios', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists rel_storage_select on storage.objects;
create policy rel_storage_select on storage.objects for select
  using (bucket_id = 'relatorios'
         and (is_admin() or (storage.foldername(name))[1] = meu_cliente()::text));

drop policy if exists rel_storage_admin on storage.objects;
create policy rel_storage_admin on storage.objects for all
  using (bucket_id = 'relatorios' and is_admin())
  with check (bucket_id = 'relatorios' and is_admin());

-- ---------------------------------------------------------------------
-- 5. VALIDAÇÃO PÚBLICA (sem login) — só devolve dados mínimos
-- ---------------------------------------------------------------------
create or replace function public.validar_relatorio(p_codigo text)
returns table (numero text, revisao int, cliente text, data_emissao date,
               data_coleta date, status text, hash_sha256 text, revisao_vigente int)
language sql stable security definer set search_path = public as $$
  select r.numero, r.revisao, c.nome, r.data_emissao, r.data_coleta, r.status, r.hash_sha256,
         (select max(r2.revisao) from relatorios r2 where r2.numero = r.numero and r2.status <> 'cancelado')
  from relatorios r join clientes c on c.id = r.cliente_id
  where r.codigo_validacao = upper(trim(p_codigo));
$$;

create or replace function public.validar_por_hash(p_hash text)
returns table (numero text, revisao int, cliente text, data_emissao date,
               data_coleta date, status text, hash_sha256 text, revisao_vigente int)
language sql stable security definer set search_path = public as $$
  select r.numero, r.revisao, c.nome, r.data_emissao, r.data_coleta, r.status, r.hash_sha256,
         (select max(r2.revisao) from relatorios r2 where r2.numero = r.numero and r2.status <> 'cancelado')
  from relatorios r join clientes c on c.id = r.cliente_id
  where r.hash_sha256 = lower(trim(p_hash));
$$;

revoke all on function public.validar_relatorio(text) from public;
revoke all on function public.validar_por_hash(text)  from public;
grant execute on function public.validar_relatorio(text) to anon, authenticated;
grant execute on function public.validar_por_hash(text)  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. PRIMEIRO ADMIN
-- Crie seu usuário em Authentication > Users e depois rode:
--   update public.perfis set papel = 'admin' where email = 'seu.email@elluambiental.com.br';
-- ---------------------------------------------------------------------
