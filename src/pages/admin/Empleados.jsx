import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

// Alta/baja de empleados (guardias) + su programación de rondas con hora.
export default function Empleados({ perfil }) {
  const [empleados, setEmpleados] = useState([])
  const [rondas, setRondas] = useState([])
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [creando, setCreando] = useState(false)
  const [sel, setSel] = useState(null)

  async function cargar() {
    const { data } = await supabase.from('perfiles')
      .select('id, nombre, usuario, activo')
      .eq('rol', 'guardia').eq('sitio_id', perfil.sitio_id)
      .order('nombre')
    setEmpleados(data || [])
  }
  async function cargarRondas() {
    const { data } = await supabase.from('rondas')
      .select('id, nombre').eq('sitio_id', perfil.sitio_id).eq('activo', true).order('nombre')
    setRondas(data || [])
  }
  useEffect(() => { cargar(); cargarRondas() }, [perfil.sitio_id])

  async function alta(e) {
    e.preventDefault()
    if (!nombre.trim() || !usuario.trim() || !password) { setMsg('Completá nombre, usuario y contraseña.'); return }
    setMsg(''); setCreando(true)
    const { data, error } = await supabase.functions.invoke('crear-empleado', {
      body: { nombre: nombre.trim(), usuario: usuario.trim(), password, sitio_id: perfil.sitio_id }
    })
    setCreando(false)
    if (error || data?.error) {
      setMsg('Error: ' + (data?.error || error.message || 'no se pudo crear'))
      return
    }
    setNombre(''); setUsuario(''); setPassword(''); setMsg('✅ Empleado creado.'); cargar()
  }

  async function toggleActivo(emp) {
    await supabase.from('perfiles').update({ activo: !emp.activo }).eq('id', emp.id)
    cargar()
  }

  return (
    <div>
      <h2>Empleados (guardias)</h2>

      <form className="tarjeta-form" onSubmit={alta}>
        <div className="fila">
          <input placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="fila">
          <input placeholder="Usuario (sin @)" value={usuario} autoCapitalize="none"
                 onChange={(e) => setUsuario(e.target.value)} />
          <input placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="primario" type="submit" disabled={creando}>
          {creando ? 'Creando…' : 'Dar de alta'}
        </button>
      </form>
      {msg && <p className="mensaje">{msg}</p>}

      <ul className="lista">
        {empleados.map((e) => (
          <li key={e.id} className={e.activo ? '' : 'inactivo'}>
            <span className="nombre">
              {e.nombre}
              <br /><small className="hora">usuario: {e.usuario || '—'}{e.activo ? '' : ' · (baja)'}</small>
            </span>
            <button className="link" onClick={() => toggleActivo(e)}>{e.activo ? 'Dar de baja' : 'Reactivar'}</button>
            <button className="chico" onClick={() => setSel(sel?.id === e.id ? null : e)}>
              {sel?.id === e.id ? 'Cerrar' : 'Rondas'}
            </button>
          </li>
        ))}
        {empleados.length === 0 && <p>Todavía no hay empleados. Dalos de alta arriba.</p>}
      </ul>

      {sel && <Programacion empleado={sel} rondas={rondas} />}
    </div>
  )
}

// Programación de un empleado: qué ronda y a qué hora.
function Programacion({ empleado, rondas }) {
  const [filas, setFilas] = useState([])
  const [addRonda, setAddRonda] = useState('')
  const [addHora, setAddHora] = useState('00:00')
  const [msg, setMsg] = useState('')

  async function cargar() {
    const { data } = await supabase.from('programacion')
      .select('id, hora_inicio, ronda:rondas(id, nombre)')
      .eq('guardia_id', empleado.id).eq('activo', true)
      .order('hora_inicio')
    setFilas(data || [])
  }
  useEffect(() => { cargar() }, [empleado.id])

  async function agregar(e) {
    e.preventDefault()
    if (!addRonda || !addHora) return
    const { error } = await supabase.from('programacion')
      .insert({ guardia_id: empleado.id, ronda_id: addRonda, hora_inicio: addHora })
    if (error) { setMsg('Error: ' + error.message); return }
    setAddRonda(''); setMsg(''); cargar()
  }
  async function quitar(f) {
    await supabase.from('programacion').delete().eq('id', f.id)
    cargar()
  }

  return (
    <div className="detalle">
      <h3>Rondas de {empleado.nombre} (hora + recorrido)</h3>
      {rondas.length === 0 ? (
        <p className="hora">Primero creá al menos un recorrido en la pestaña "Rondas".</p>
      ) : (
        <form className="fila" onSubmit={agregar}>
          <select value={addRonda} onChange={(e) => setAddRonda(e.target.value)}>
            <option value="">Recorrido…</option>
            {rondas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <input type="time" value={addHora} onChange={(e) => setAddHora(e.target.value)} />
          <button className="primario" type="submit">Agregar</button>
        </form>
      )}
      {msg && <p className="mensaje">{msg}</p>}
      <ul className="lista">
        {filas.map((f, idx) => (
          <li key={f.id}>
            <span className="orden">{idx + 1}</span>
            <span className="nombre">{f.hora_inicio?.slice(0, 5)} · {f.ronda?.nombre}</span>
            <button className="link" onClick={() => quitar(f)}>Quitar</button>
          </li>
        ))}
        {filas.length === 0 && <p>Sin rondas programadas. Agregá hora + recorrido.</p>}
      </ul>
    </div>
  )
}
