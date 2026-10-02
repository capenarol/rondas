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
- [x] Fase 3 — Panel admin con pestañas: Reporte, Empleados (alta/baja + programación),
  Rondas (recorridos = puntos ordenados) y Puntos (alta + asignar tarjeta por escaneo).
- [ ] Fase 4 — Export CSV/PDF del reporte, modo offline del escaneo, pulido PWA,
  cambio de contraseña en la app.

## Terminología (importante)

- **Recorrido** = orden de los puntos NFC a visitar (ruta A, ruta B…). En la BD es la tabla
  `rondas` + `ronda_puntos` (nombre heredado; en la UI se muestra como "Recorridos").
- **Ronda** = lo que el supervisor asigna al guardia: *hora + recorrido* (00:00 ruta A, 01:00
  ruta B…). En la BD es la tabla `programacion`. En la UI: pestaña Empleados → "Rondas de X".
  (Si algún día conviene, se pueden renombrar las tablas; por ahora solo cambian las etiquetas.)

## Modelo refinado (migración 02)

- **Recorrido** (tabla `rondas`) = puntos ordenados. Sin hora ni tolerancia por punto.
- **programacion** (tabla nueva): por empleado, filas {ronda, hora_inicio}. El "número de
  ronda" se deriva ordenando por hora. El guardia ve sus pases del día (número + hora).
- **ejecuciones_ronda**: ahora con `programacion_id`, `numero`, `hora_inicio`; una por
  pase y día. El margen de tiempo NO se calcula: el encargado/admin lo juzga en el reporte.
- **Reporte** (admin y encargado): por empleado + día, cada pase (N° + hora de inicio) y la
  hora real marcada en cada punto.
- `perfiles.usuario` guarda el usuario (sin @) para mostrarlo en el panel.

## Alta de empleados: Edge Function

Función `crear-empleado` desplegada en Supabase (Edge Functions), Verify JWT = OFF, valida
internamente que el llamador sea admin. Crea el usuario `usuario@rondas.local` (confirmado)
con la service_role y deja el perfil como guardia del sitio. Fuente en
`supabase/functions/crear-empleado/index.ts`. El panel Empleados la llama vía
`supabase.functions.invoke('crear-empleado')`. La **baja** desactiva (perfiles.activo=false).

## Capturar el UID de una tarjeta

Ya no se hace a mano: en el panel admin → Puntos, botón **Escanear** lee la tarjeta y
guarda el UID en el punto. (El UID es el `serialNumber` de la Web NFC API, en minúsculas.)

## Revisión del sistema (2026-10-02)

Estado: el circuito completo funciona de punta a punta en mobile.
- Auth por usuario + 3 roles; ruteo por rol; RLS en todas las tablas; Edge Function que
  valida admin. La hora de escaneo la pone el servidor; dedupe por (ejecución, punto);
  primer escaneo gana. Fechas calculadas en zona America/Montevideo.
- Alta/baja/eliminación de guardias, recorridos y puntos; programación de rondas por guardia.
- CORS de la Edge Function corregido (incluye `x-client-info`): el alta de empleados ya
  funciona desde el navegador.
- Mobile: targets táctiles ≥44px, listas que se apilan, formularios en columna, tabla con
  scroll horizontal; el reporte usa listas (no tablas anchas).

## Pendientes / mejoras (futuro)

1. **Edición** in situ: hoy se crea/elimina pero no se editan nombres de recorrido/punto ni
   la hora de una ronda (hay que borrar y recrear). Agregar edición inline.
2. **Cambio de contraseña** dentro de la app (hoy solo desde Supabase → Auth).
3. **Modo offline** del escaneo: encolar escaneos sin señal y sincronizar (Fase 4).
4. **Export** del reporte a CSV/PDF (Fase 4).
5. **Reporte del día / todos los guardias** para el encargado (hoy es por empleado + fecha).
6. **Limpieza**: `src/pages/Encargado.jsx` y la vista `vista_escaneos` ya no se usan (los
   reemplazó el Reporte nuevo). Se pueden eliminar.
7. Mostrar mensajes de carga/vacío más ricos y confirmaciones visuales (hoy hay básicos).

## Notas de despliegue

- **Frontend**: se publica con `subir.bat` (git push → Netlify redeploya). Sitio **público**.
- **Base de datos**: `schema.sql` + `migracion_02_programacion.sql` ya aplicados en Supabase
  (NO se redeployan con git; se corren en el SQL Editor si se recrea el proyecto).
- **Edge Function**: `crear-empleado` ya desplegada (Verify JWT OFF). Si se recrea, subir el
  código de `supabase/functions/crear-empleado/index.ts` desde Dashboard → Edge Functions.

## Plan de referencia

Documento de planificación (Claude Doc):
https://claude.ai/code/artifact/f2404329-9740-47d7-8d3c-06e4ffc386d4
