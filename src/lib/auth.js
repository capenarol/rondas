// Los usuarios entran con un "usuario" simple (sin @).
// Supabase Auth necesita un email por detrás, así que mapeamos
// usuario -> usuario@DOMINIO. Si alguien escribe un email completo, se respeta.

export const USUARIO_DOMINIO = 'rondas.local'

export function emailDesdeUsuario(entrada) {
  const v = (entrada || '').trim().toLowerCase()
  if (!v) return v
  return v.includes('@') ? v : `${v}@${USUARIO_DOMINIO}`
}
