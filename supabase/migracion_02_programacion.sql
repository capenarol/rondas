-- =====================================================================
-- Migración 02: rondas sin hora/tolerancia por punto + programación por
-- empleado (qué ronda y a qué hora de inicio) + pases en las ejecuciones.
-- Ejecutar DESPUÉS de schema.sql. Es idempotente.
-- =====================================================================

-- 0) Guardar el "usuario" (sin @) en el perfil, para mostrarlo en el panel.
alter table public.perfiles add column if not exists usuario text;

-- 1) Rondas = solo puntos ordenados: hora/tolerancia pasan a opcionales.
alter table public.ronda_puntos alter column hora_esperada  drop not null;
alter table public.ronda_puntos alter column tolerancia_min drop not null;

-- 2) Programación: qué ronda hace cada guardia y a qué hora de inicio.
create table if not exists public.programacion (
  id          uuid primary key default gen_random_uuid(),
  guardia_id  uuid not null references public.perfiles (id) on delete cascade,
  ronda_id    uuid not null references public.rondas (id)   on delete cascade,
  hora_inicio time not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists programacion_guardia_idx on public.programacion (guardia_id);

-- 3) Ejecuciones: ligar al pase programado + guardar número y hora de inicio.
alter table public.ejecuciones_ronda add column if not exists programacion_id uuid references public.programacion (id) on delete set null;
alter table public.ejecuciones_ronda add column if not exists numero int;
alter table public.ejecuciones_ronda add column if not exists hora_inicio time;

-- Quitar la restricción vieja (una por ronda/guardia/día) y permitir varios pases.
alter table public.ejecuciones_ronda drop constraint if exists ejecuciones_ronda_ronda_id_guardia_id_fecha_key;
create unique index if not exists ejecuciones_prog_fecha_uq
  on public.ejecuciones_ronda (programacion_id, fecha)
  where programacion_id is not null;

-- 4) RLS de programación
alter table public.programacion enable row level security;

drop policy if exists prog_select on public.programacion;
create policy prog_select on public.programacion
  for select to authenticated
  using (
    guardia_id = auth.uid()
    or public.mi_rol() = 'admin'
    or (public.mi_rol() = 'encargado' and exists (
          select 1 from public.perfiles g
          where g.id = programacion.guardia_id and g.sitio_id = public.mi_sitio()))
  );

drop policy if exists prog_admin on public.programacion;
create policy prog_admin on public.programacion
  for all to authenticated
  using (public.mi_rol() = 'admin')
  with check (public.mi_rol() = 'admin');

-- =====================================================================
-- FIN MIGRACIÓN 02
-- =====================================================================
