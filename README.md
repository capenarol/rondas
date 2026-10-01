# Rondas de Guardias

App web (PWA) para registrar las rondas de vigilancia por **escaneo de tarjetas NFC**.
El guardia, logueado desde su celular Android, acerca el teléfono a una tarjeta fija en
cada punto del perímetro; el sistema guarda qué punto, a qué hora y qué guardia escaneó.
El encargado verifica desde un panel web que las rondas se cumplieron en horario.

- **Stack:** Vite + React + Supabase JS, PWA instalable.
- **Backend:** Supabase (PostgreSQL + Auth + RLS). Sin servidor propio.
- **Hosting:** Netlify.
- **NFC:** Web NFC API — **solo funciona en Chrome para Android, sobre HTTPS.**

## Roles

- **guardia** — escanea tarjetas y ve su ronda del día.
- **encargado** — supervisa y verifica las rondas del sitio (solo lectura).
- **admin** — configura sitios, puntos (tarjetas), rondas y usuarios.

En un sitio chico, una persona puede ser admin y encargado a la vez.

## Puesta en marcha (desarrollo)

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_ANON_KEY
npm run dev
```

> NFC no funciona en el navegador de escritorio. Para probar el escaneo hay que abrir
> la URL (deploy de Netlify o un túnel HTTPS) en **Chrome en Android**.

## Base de datos

1. Supabase Dashboard → **SQL Editor** → pegar y ejecutar `supabase/schema.sql`.
2. (Opcional) ejecutar `supabase/seed.sql` para crear el sitio inicial.
3. Crear tu usuario (desde la app o Auth → Add user) y promoverlo a `admin`
   con el bloque comentado al final de `seed.sql`.

El esquema incluye: 7 tablas, los 3 roles, políticas **RLS**, hora de escaneo puesta
por el **servidor**, **unicidad** por (ejecución, punto) para que el primer escaneo gane,
y la vista `vista_escaneos` que calcula el estado (a_tiempo / tarde / temprano) contra
la hora esperada ± tolerancia.

## Despliegue (Netlify)

- Sitio nuevo en el equipo **CAP**, conectado a este repo de GitHub.
- Variables de entorno en Netlify: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Build: `npm run build` · Publish: `dist` (ya configurado en `netlify.toml`).
- Subdominio sugerido: `rondas.estadiocds.uy` (DNS gestionado en Netlify).

## Estructura

```
supabase/schema.sql   Esquema completo (tablas, RLS, vista, triggers)
supabase/seed.sql     Datos iniciales y cómo crear el admin
src/lib/supabase.js   Cliente de Supabase
src/lib/nfc.js        Lectura de tarjetas (Web NFC)
src/pages/            Login, Guardia, Encargado, Admin
docs/BITACORA.md      Decisiones y estado del proyecto
```

Ver `docs/BITACORA.md` para el contexto completo, decisiones tomadas y próximos pasos.
