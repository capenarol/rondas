# Bitácora del proyecto — Rondas de Guardias

Documento de contexto para retomar el proyecto en cualquier sesión nueva.
Última actualización: 2026-10-01.

## Qué es

App para registrar que los guardias hacen las rondas: escanean tarjetas NFC ubicadas
en el perímetro; se guarda punto + hora (del servidor) + guardia. El encargado verifica.

## Infraestructura (cuentas del cliente — org/equipo "CAP")

- **Supabase:** organización `CAP` (plan Free, máx. 2 proyectos). El proyecto de esta app
  es **`rondas`** (ID `mxdthjnnivqpnswaowgn`, región us-east-2). Era el proyecto por
  defecto, estaba vacío; se renombró y se reutiliza. El otro proyecto, `matriculas`, es
  de otra app y no se toca.
- **Netlify:** equipo `CAP` (plan Free). Ya existe el sitio `estadiocds.uy` (deploy desde
  GitHub) y el DNS del dominio `estadiocds.uy` se gestiona en Netlify. Para esta app se
  crea un **sitio nuevo e independiente** con subdominio `rondas.estadiocds.uy`.
- **GitHub:** repo `rondas` (cuenta conectada a Netlify).

## Decisiones tomadas

- **Solo Android.** Web NFC API solo existe en Chrome/Android. iPhone no (Safari no soporta).
- **Sin GPS.** Los puntos están muy cerca entre sí; la ubicación sería poco confiable.
  La presencia se valida porque hay que acercar el teléfono a la tarjeta física fija.
- **Sin respaldo QR por ahora.** Solo NFC. Queda como idea futura.
- **Login:** email + contraseña para todos (Supabase Auth).
- **3 roles:** guardia / encargado / admin (ver README).
- **Tolerancia ±:** cada punto de la ronda tiene hora esperada y tolerancia en minutos.
- **Primer escaneo gana:** UNIQUE (ejecucion_id, punto_id); los repetidos se ignoran.
- **Hora del servidor:** trigger fuerza `escaneado_en = now()` (no se confía en el reloj
  del celular).
- **Escala:** un solo sitio por ahora, pero el modelo soporta varios (posible 2.º lugar
  más adelante si el uso funciona).

## Modelo de datos (resumen)

`sitios` → `puntos_control` (tarjetas NFC), `rondas`, `perfiles` (usuarios con rol).
`rondas` ⇄ `puntos_control` vía `ronda_puntos` (hora_esperada, tolerancia_min).
Al ejecutar: `ejecuciones_ronda` (ronda+guardia+fecha) → `registros_escaneo` (inmutables).
Detalle completo en `supabase/schema.sql`.

## Despliegue (en producción)

- **Supabase** `rondas` (ID `mxdthjnnivqpnswaowgn`): esquema aplicado.
- **GitHub** `capenarol/rondas`: push manda a producción. Script `subir.bat` en la raíz
  hace add+commit+push.
- **Netlify** sitio `rondas-cap`: `rondas-cap.netlify.app` y `rondas.estadiocds.uy`
  (cubierto por el cert wildcard `*.estadiocds.uy`). Variables `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY` (publishable key) cargadas en Netlify.

## Login por usuario (sin email)

Supabase Auth exige email. Se usa un email interno sintético: el usuario `juan` se guarda
como `juan@rondas.local` y el login le agrega `@rondas.local` de forma invisible
(`src/lib/auth.js`). Nadie usa correo real. El admin quedó como `admin@rondas.local`.

## Estado actual (fases)

- [x] Fase 0 — Setup: repo, esquema de BD, scaffold Vite+React+PWA, netlify.toml, deploy.
- [x] Fase 1 — Auth y roles: login por usuario + ruteo por rol.
- [x] Fase 2 — Escaneo NFC y registro: pantalla del guardia funcionando.
- [~] Fase 3 — Panel admin: Puntos (alta + asignar tarjeta por escaneo) y Rondas
  (crear, elegir puntos, hora y tolerancia) HECHO. Falta **gestión de usuarios**
  (alta de guardias) desde el panel.
- [ ] Fase 4 — Reportes (export CSV/PDF), modo offline del escaneo, pulido PWA.

## Pendiente clave: alta de usuarios desde el panel

Crear usuarios de Auth desde el frontend no es seguro (requiere service_role). Opciones:
una **Edge Function** de Supabase con la service_role key que cree el usuario
(`juan@rondas.local`) + su perfil con rol/sitio, llamada desde el panel admin; o seguir
creándolos con SQL / Dashboard por ahora. Mientras tanto, el alta de admin/guardias se hace
con los bloques SQL de `supabase/seed.sql` y los que están en el historial de la sesión.

## Capturar el UID de una tarjeta

Ya no se hace a mano: en el panel admin → Puntos, botón **Escanear** lee la tarjeta y
guarda el UID en el punto. (El UID es el `serialNumber` de la Web NFC API, en minúsculas.)

## Plan de referencia

Documento de planificación (Claude Doc):
https://claude.ai/code/artifact/f2404329-9740-47d7-8d3c-06e4ffc386d4
