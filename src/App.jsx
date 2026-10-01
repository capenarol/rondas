import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Guardia from './pages/Guardia.jsx'
import Reporte from './pages/admin/Reporte.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  const [cargando, setCargando] = useState(true)
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setPerfil(null); return }
    supabase
      .from('perfiles')
      .select('id, nombre, rol, sitio_id, activo')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setPerfil(data))
  }, [session])

  async function salir() {
    await supabase.auth.signOut()
  }

  if (cargando) return <div className="centro">Cargando…</div>
  if (!session) return <Login />

  if (!perfil) return <div className="centro">Cargando perfil…</div>

  if (perfil.activo === false) {
    return (
      <Shell perfil={perfil} salir={salir}>
        <p>Tu usuario está desactivado. Contactá al administrador.</p>
      </Shell>
    )
  }

  return (
    <Shell perfil={perfil} salir={salir}>
      {perfil.rol === 'admin' && <Admin perfil={perfil} />}
      {perfil.rol === 'encargado' && <Reporte perfil={perfil} />}
      {perfil.rol === 'guardia' && <Guardia perfil={perfil} />}
    </Shell>
  )
}

function Shell({ perfil, salir, children }) {
  return (
    <div className="app">
      <header className="barra">
        <strong>Rondas</strong>
        <span className="rol">{perfil?.nombre || ''} · {perfil?.rol}</span>
        <button className="link" onClick={salir}>Salir</button>
      </header>
      <main className="contenido">{children}</main>
    </div>
  )
}
