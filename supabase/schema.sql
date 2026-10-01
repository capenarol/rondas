-- =====================================================================
-- RONDAS DE GUARDIAS — Esquema de base de datos (Supabase / PostgreSQL)
-- =====================================================================
-- Proyecto: control de rondas de vigilancia por escaneo de tarjetas NFC.
-- Pensado para un (1) sitio al inicio, pero el modelo soporta varios.
--
-- Cómo aplicarlo:
--   Supabase Dashboard -> SQL Editor -> pegar este archivo -> Run.
--   Es idempotente en lo posible (usa IF NOT EXISTS / CREATE OR REPLACE).
--
-- Roles de la app (columna perfiles.rol):
--   guardia   -> escanea tarjetas, ve su propia ronda del día
--   encargado -> supervisa y verifica las rondas del sitio (solo lectura)
--   admin     -> configura sitios, puntos, rondas y usuarios
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Extensiones y tipos
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    create type public.rol_usuario as enum ('guardia', 'encargado', 'admin');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- 1) Tablas
-- ---------------------------------------------------------------------

-- Sitios (lugares a cuidar). Al inicio hay uno solo.
create table if not exists public.sitios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  direccion   text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Perfiles: 1 a 1 con los usuarios de Supabase Auth.
create table if not exists public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text,
  rol         public.rol_usuario not null default 'guardia',
  sitio_id    uuid references public.sitios (id) on delete set null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Puntos de control: cada tarjeta NFC fija en el perímetro.
create table if not exists public.puntos_control (
  id          uuid primary key default gen_random_uuid(),
  sitio_id    uuid not null references public.sitios (id) on delete cascade,
  nombre      text not null,
  nfc_uid     text,                 -- UID físico del chip (anti-clonado)
  orden       int  not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);
-- El UID de una tarjeta es único dentro del sitio (si está cargado).
create unique index if not exists puntos_control_sitio_uid_uq
  on public.puntos_control (sitio_id, nfc_uid)
  where nfc_uid is not null;

-- Rondas: plantilla reutilizable (qué puntos, en qué turno).
create table if not exists public.rondas (
  id          uuid primary key default gen_random_uuid(),
  sitio_id    uuid not null references public.sitios (id) on delete cascade,
  nombre      text not null,
  turno       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Puntos de una ronda, con hora esperada y tolerancia (± minutos).
create table if not exists public.ronda_puntos (
  id             uuid primary key default gen_random_uuid(),
  ronda_id       uuid not null references public.rondas (id) on delete cascade,
  punto_id       uuid not null references public.puntos_control (id) on delete cascade,
  orden          int  not null default 0,
  hora_esperada  time not null,
  tolerancia_min int  not null default 10,
  unique (ronda_id, punto_id)
);

-- Ejecución: una ronda concreta realizada por un guardia en una fecha.
create table if not exists public.ejecuciones_ronda (
  id          uuid primary key default gen_random_uuid(),
  ronda_id    uuid not null references public.rondas (id) on delete cascade,
  guardia_id  uuid not null references public.perfiles (id) on delete cascade,
  fecha       date not null default (now() at time zone 'America/Montevideo')::date,
  created_at  timestamptz not null default now(),
  -- Una sola ejecución por ronda, guardia y día.
  unique (ronda_id, guardia_id, fecha)
);

-- Registros de escaneo: inmutables. La hora la pone el servidor (now()).
create table if not exists public.registros_escaneo (
  id            uuid primary key default gen_random_uuid(),
  ejecucion_id  uuid not null references public.ejecuciones_ronda (id) on delete cascade,
  punto_id      uuid not null references public.puntos_control (id) on delete cascade,
  guardia_id    uuid not null references public.perfiles (id) on delete cascade,
  nfc_uid       text,
  escaneado_en  timestamptz not null default now(),
  -- DEDUPE: el primer escaneo de un punto en una ejecución gana;
  -- los repetidos se rechazan por esta restricción (insert ... on conflict do nothing).
  unique (ejecucion_id, punto_id)
);

-- ---------------------------------------------------------------------
-- 2) Hora de servidor forzada en los escaneos
--    Aunque el cliente mande otra cosa, escaneado_en = now().
-- ---------------------------------------------------------------------
create or replace function public.forzar_hora_servidor()
returns trigger
language plpgsql
as $$
begin
  new.escaneado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_forzar_hora_servidor on public.registros_escaneo;
create trigger trg_forzar_hora_servidor
  before insert on public.registros_escaneo
  for each row execute function public.forzar_hora_servidor();

-- ---------------------------------------------------------------------
-- 3) Helpers de rol/sitio (SECURITY DEFINER para evitar recursión en RLS)
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.mi_sitio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sitio_id from public.perfiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 4) Alta automática de perfil al crear un usuario en Auth
--    (rol por defecto 'guardia'; el admin luego ajusta rol/sitio)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5) Vista de verificación para el encargado
--    Calcula el estado de cada escaneo contra la ventana esperada,
--    en horario local (America/Montevideo).
-- ---------------------------------------------------------------------
create or replace view public.vista_escaneos as
select
  r.id                                   as registro_id,
  e.id                                   as ejecucion_id,
  e.fecha,
  ro.sitio_id,
  ro.id                                  as ronda_id,
  ro.nombre                              as ronda,
  p.id                                   as punto_id,
  p.nombre                               as punto,
  rp.orden                               as orden,
  rp.hora_esperada,
  rp.tolerancia_min,
  g.nombre                               as guardia,
  r.escaneado_en,
  (r.escaneado_en at time zone 'America/Montevideo')::time as hora_real,
  case
    when (r.escaneado_en at time zone 'America/Montevideo')::time
         < (rp.hora_esperada - make_interval(mins => rp.tolerancia_min))
      then 'temprano'
    when (r.escaneado_en at time zone 'America/Montevideo')::time
         > (rp.hora_esperada + make_interval(mins => rp.tolerancia_min))
      then 'tarde'
    else 'a_tiempo'
  end                                    as estado
from public.registros_escaneo r
join public.ejecuciones_ronda e on e.id = r.ejecucion_id
join public.rondas ro          on ro.id = e.ronda_id
join public.puntos_control p   on p.id = r.punto_id
left join public.ronda_puntos rp on rp.ronda_id = ro.id and rp.punto_id = r.punto_id
join public.perfiles g         on g.id = r.guardia_id;

-- ---------------------------------------------------------------------
-- 6) Row Level Security
-- ---------------------------------------------------------------------
alter table public.sitios            enable row level security;
alter table public.perfiles          enable row level security;
alter table public.puntos_control    enable row level security;
alter table public.rondas            enable row level security;
alter table public.ronda_puntos      enable row level security;
alter table public.ejecuciones_ronda enable row level security;
alter table public.registros_escaneo enable row level security;

-- --- SITIOS ---------------------------------------------------------
drop policy if exists sitios_select on public.sitios;
create policy sitios_select on public.sitios
  for select to authenticated
  using (id = public.mi_sitio() or public.mi_rol() = 'admin');

drop policy if exists sitios_admin on public.sitios;
create policy sitios_admin on public.sitios
  for all to authenticated
  using (public.mi_rol() = 'admin')
  with check (public.mi_rol() = 'admin');

-- --- PERFILES -------------------------------------------------------
drop policy if exists perfiles_select_propio on public.perfiles;
create policy perfiles_select_propio on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.mi_rol() = 'admin'
    or (public.mi_rol() = 'encargado' and sitio_id = public.mi_sitio())
  );

drop policy if exists perfiles_update_propio on public.perfiles;
create policy perfiles_update_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles
  for all to authenticated
  using (public.mi_rol() = 'admin')
  with check (public.mi_rol() = 'admin');

-- --- PUNTOS_CONTROL -------------------------------------------------
drop policy if exists puntos_select on public.puntos_control;
create policy puntos_select on public.puntos_control
  for select to authenticated
  using (sitio_id = public.mi_sitio() or public.mi_rol() = 'admin');

drop policy if exists puntos_admin on public.puntos_control;
create policy puntos_admin on public.puntos_control
  for all to authenticated
  using (public.mi_rol() = 'admin')
  with check (public.mi_rol() = 'admin');

-- --- RONDAS ---------------------------------------------------------
drop policy if exists rondas_select on public.rondas;
create policy rondas_select on public.rondas
  for select to authenticated
  using (sitio_id = public.mi_sitio() or public.mi_rol() = 'admin');

drop policy if exists rondas_admin on public.rondas;
create policy rondas_admin on public.rondas
  for all to authenticated
  using (public.mi_rol() = 'admin')
  with check (public.mi_rol() = 'admin');

-- --- RONDA_PUNTOS ---------------------------------------------------
drop policy if exists ronda_puntos_select on public.ronda_puntos;
create policy ronda_puntos_select on public.ronda_puntos
  for select to authenticated
  using (
    exists (
      select 1 from public.rondas ro
      where ro.id = ronda_puntos.ronda_id
        and (ro.sitio_id = public.mi_sitio() or public.mi_rol() = 'admin')
    )
  );

drop policy if exists ronda_puntos_admin on public.ronda_puntos;
create policy ronda_puntos_admin on public.ronda_puntos
  for all to authenticated
  using (public.mi_rol() = 'admin')
  with check (public.mi_rol() = 'admin');

-- --- EJECUCIONES_RONDA ----------------------------------------------
-- El guardia crea/lee sus ejecuciones; encargado y admin leen todo el sitio.
drop policy if exists ejec_select on public.ejecuciones_ronda;
create policy ejec_select on public.ejecuciones_ronda
  for select to authenticated
  using (
    guardia_id = auth.uid()
    or public.mi_rol() = 'admin'
    or (
      public.mi_rol() = 'encargado'
      and exists (
        select 1 from public.rondas ro
        where ro.id = ejecuciones_ronda.ronda_id and ro.sitio_id = public.mi_sitio()
      )
    )
  );

drop policy if exists ejec_insert_guardia on public.ejecuciones_ronda;
create policy ejec_insert_guardia on public.ejecuciones_ronda
  for insert to authenticated
  with check (
    guardia_id = auth.uid()
    and exists (
      select 1 from public.rondas ro
      where ro.id = ejecuciones_ronda.ronda_id and ro.sitio_id = public.mi_sitio()
    )
  );

-- --- REGISTROS_ESCANEO ----------------------------------------------
-- Inmutables: insert (propio) y select; sin update ni delete para nadie.
drop policy if exists reg_select on public.registros_escaneo;
create policy reg_select on public.registros_escaneo
  for select to authenticated
  using (
    guardia_id = auth.uid()
    or public.mi_rol() = 'admin'
    or (
      public.mi_rol() = 'encargado'
      and exists (
        select 1 from public.ejecuciones_ronda e
        join public.rondas ro on ro.id = e.ronda_id
        where e.id = registros_escaneo.ejecucion_id and ro.sitio_id = public.mi_sitio()
      )
    )
  );

drop policy if exists reg_insert_guardia on public.registros_escaneo;
create policy reg_insert_guardia on public.registros_escaneo
  for insert to authenticated
  with check (
    guardia_id = auth.uid()
    and exists (
      select 1 from public.ejecuciones_ronda e
      where e.id = registros_escaneo.ejecucion_id and e.guardia_id = auth.uid()
    )
  );

-- (No se definen políticas de UPDATE/DELETE: con RLS activo, quedan prohibidas.)

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================
