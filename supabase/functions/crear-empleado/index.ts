// Edge Function: crear-empleado
// Crea un usuario de login (guardia) con la service_role (del lado servidor).
// Solo un admin autenticado puede llamarla. El guardia entra con "usuario" (sin @):
// se guarda como usuario@rondas.local. Desplegada con Verify JWT = OFF; la función
// valida al que llama (getUser + rol admin). Deploy: Supabase Dashboard -> Edge Functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const authHeader = req.headers.get('Authorization') || ''

    // Verificar que quien llama sea admin.
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: ud } = await asUser.auth.getUser()
    const caller = ud && ud.user
    if (!caller) return json(401, { error: 'No autenticado' })

    const admin = createClient(url, serviceKey)
    const { data: perfilCaller } = await admin.from('perfiles').select('rol, sitio_id').eq('id', caller.id).single()
    if (!perfilCaller || perfilCaller.rol !== 'admin') return json(403, { error: 'Solo un admin puede crear empleados.' })

    const body = await req.json().catch(() => ({}))
    const usuario = String(body.usuario || '').trim().toLowerCase()
    const password = String(body.password || '')
    const nombre = String(body.nombre || '').trim() || usuario
    const sitio_id = body.sitio_id || perfilCaller.sitio_id
    if (!usuario || !password) return json(400, { error: 'Faltan usuario o contrasena.' })
    const email = usuario.indexOf('@') >= 0 ? usuario : usuario + '@rondas.local'

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nombre }
    })
    if (cErr) return json(400, { error: cErr.message })
    const uid = created.user.id

    const { error: pErr } = await admin.from('perfiles').upsert({
      id: uid, nombre, usuario, rol: 'guardia', sitio_id, activo: true
    })
    if (pErr) return json(400, { error: pErr.message })

    return json(200, { ok: true, id: uid, usuario })
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) })
  }
})
