-- =====================================================================
-- Datos iniciales (opcional). Ejecutar DESPUÉS de schema.sql.
-- =====================================================================

-- 1) Crear el sitio inicial (ajustá nombre y dirección).
insert into public.sitios (nombre, direccion)
select 'Sitio principal', 'Dirección del lugar'
where not exists (select 1 from public.sitios);

-- 2) Convertir TU usuario en admin y asignarlo al sitio.
--    Primero creá tu usuario desde la app (o Auth -> Add user), y luego
--    reemplazá el email de abajo y ejecutá este bloque.
--
-- update public.perfiles p
--   set rol = 'admin',
--       sitio_id = (select id from public.sitios order by created_at limit 1)
-- from auth.users u
-- where u.id = p.id
--   and u.email = 'TU_EMAIL_ACA';
