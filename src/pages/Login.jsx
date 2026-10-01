import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { emailDesdeUsuario } from '../lib/auth.js'

// Login con usuario (sin @) + contraseña. El usuario se mapea a un email interno.
export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: emailDesdeUsuario(usuario),
      password
    })
    setCargando(false)
    if (error) setError('Usuario o contraseña incorrectos.')
  }

  return (
    <div className="centro">
      <form className="tarjeta" onSubmit={entrar}>
        <h1>Rondas de Guardias</h1>
        <label>Usuario
          <input type="text" value={usuario} autoComplete="username"
                 autoCapitalize="none" autoCorrect="off" spellCheck="false"
                 onChange={(e) => setUsuario(e.target.value)} required />
        </label>
        <label>Contraseña
          <input type="password" value={password} autoComplete="current-password"
                 onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primario" type="submit" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
