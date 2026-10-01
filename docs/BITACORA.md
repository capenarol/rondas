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

## Estado actual (fases)

- [x] Fase 0 — Setup: repo, esquema de BD, scaffold Vite+React+PWA, netlify.toml.
- [ ] Fase 1 — Auth y roles (login + ruteo por rol: hecho en el scaffold; falta pulir).
- [ ] Fase 2 — Escaneo NFC y registro (pantalla del guardia: base hecha; probar con tarjetas).
- [ ] Fase 3 — Panel del encargado + ABM de sitios/puntos/rondas/usuarios (admin).
- [ ] Fase 4 — Reportes (export CSV/PDF), modo offline del escaneo, pulido PWA.

## Pendientes inmediatos

1. Ejecutar `supabase/schema.sql` en el proyecto `rondas`.
2. Cargar `VITE_SUPABASE_ANON_KEY` (Supabase → Settings → API Keys) en `.env.local` y Netlify.
3. Crear el sitio en Netlify conectado al repo + subdominio.
4. Crear usuario admin y cargar un sitio, un par de puntos (con el UID de tus tarjetas de
   prueba) y una ronda de prueba para escanear.

## Cómo obtener el UID de una tarjeta para cargarla

En la pantalla del guardia, al escanear una tarjeta no reconocida, la app muestra el UID.
Ese valor se carga en `puntos_control.nfc_uid` del punto correspondiente (en Fase 3 habrá
pantalla; por ahora se puede cargar desde el Table Editor de Supabase).

## Plan de referencia

Documento de planificación (Claude Doc):
https://claude.ai/code/artifact/f2404329-9740-47d7-8d3c-06e4ffc386d4
