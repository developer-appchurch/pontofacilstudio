-- =========================================================================
-- SUPABASE POSTGRESQL SCHEMA COMPLETO (PONTOFÁCIL MULTI-TENANT)
-- Script 100% idempotente: pode ser executado no SQL Editor do Supabase
-- =========================================================================

-- 1. Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- 2. Tabela de Empresas
create table if not exists public.empresas (
    id uuid default uuid_generate_v4() primary key,
    nome text not null,
    cnpj text unique not null,
    email_contato text unique not null,
    codigo_acesso text not null,
    senha_dispositivo text not null,
    senha_gestor text not null,
    cidade text default 'Brasil',
    plano text default 'enterprise',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Garantir adição de colunas se tabela já existir previamente
alter table public.empresas add column if not exists email_contato text;
alter table public.empresas add column if not exists codigo_acesso text;
alter table public.empresas add column if not exists senha_dispositivo text;
alter table public.empresas add column if not exists senha_gestor text;
alter table public.empresas add column if not exists cidade text default 'Brasil';
alter table public.empresas add column if not exists plano text default 'enterprise';

-- 3. Tabela de Perfis de Usuário
create table if not exists public.perfis (
    id uuid default uuid_generate_v4() primary key,
    empresa_id uuid references public.empresas(id) on delete cascade not null,
    nome text not null,
    email text not null,
    role text default 'gestor' check (role in ('admin', 'gestor', 'colaborador')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_perfis_empresa on public.perfis (empresa_id);
create index if not exists idx_perfis_email on public.perfis (email);

-- 4. Tabela de Colaboradores
create table if not exists public.colaboradores (
    id uuid default uuid_generate_v4() primary key,
    empresa_id uuid references public.empresas(id) on delete cascade not null,
    nome text not null,
    cpf text not null,
    email text,
    cargo text not null,
    departamento text not null,
    jornada_inicio time not null default '08:00:00',
    jornada_fim time not null default '17:00:00',
    pin text not null default '1234',
    avatar text,
    fotos_faciais jsonb default '[]'::jsonb,
    status text check (status in ('ativo', 'ferias', 'afastado')) default 'ativo',
    tipo_contrato text check (tipo_contrato in ('CLT', 'PJ', 'Estágio')) default 'CLT',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unq_empresa_cpf unique (empresa_id, cpf)
);

alter table public.colaboradores add column if not exists fotos_faciais jsonb default '[]'::jsonb;

-- 5. Tabela de Registros de Ponto
create table if not exists public.registros_ponto (
    id uuid default uuid_generate_v4() primary key,
    empresa_id uuid references public.empresas(id) on delete cascade not null,
    colaborador_id uuid references public.colaboradores(id) on delete cascade not null,
    colaborador_nome text not null,
    data date not null default current_date,
    horario time not null,
    tipo text check (tipo in ('entrada', 'inicio_almoco', 'fim_almoco', 'saida')) not null,
    metodo text check (metodo in ('facial', 'cpf_pin', 'manual')) not null,
    status text not null,
    diferenca_minutos integer not null default 0,
    observacao text,
    localizacao text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_registros_empresa_data on public.registros_ponto (empresa_id, data);
create index if not exists idx_registros_colab on public.registros_ponto (empresa_id, colaborador_id);

-- 6. Tabela de Configurações de Jornada
create table if not exists public.configuracoes_jornada (
    id uuid default uuid_generate_v4() primary key,
    empresa_id uuid references public.empresas(id) on delete cascade unique not null,
    tolerancia_normal_minutos integer default 5,
    tolerancia_atraso_leve_minutos integer default 9,
    atraso_critico_minutos integer default 10,
    antecipacao_permitida_minutos integer default 15,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- DESABILITAR RLS (Row Level Security) em todas as tabelas para garantir
-- que inserções e cadastros via API e cliente funcionem sem restrições
-- =========================================================================
alter table public.empresas disable row level security;
alter table public.perfis disable row level security;
alter table public.colaboradores disable row level security;
alter table public.registros_ponto disable row level security;
alter table public.configuracoes_jornada disable row level security;

-- Inserir empresa padrão de demonstração se tabela estiver vazia
insert into public.empresas (id, nome, cnpj, email_contato, codigo_acesso, senha_dispositivo, senha_gestor, cidade)
values 
  ('11111111-1111-1111-1111-111111111111', 'Acme Corporation Brasil', '12.345.678/0001-90', 'gestor@acme.com.br', 'ACME2026', 'acme123', 'gestor123', 'São Paulo - SP')
on conflict (cnpj) do nothing;
