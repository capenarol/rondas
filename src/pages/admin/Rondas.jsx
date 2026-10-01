import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

// Rondas = recorridos: puntos ordenados (sin hora ni tolerancia).
export default function Rondas({ perfil }) {
  const [rondas, setRondas] = useState([])
  const [sel, setSel] = useState(null)
  const [items, setItems] = useState([])
  const [puntos, setPuntos] = useState([])
  const [nombre, setNombre] = useState('')
  const [addPunto, setAddPunto] = useState('')
  const [msg, setMsg] = useState('')

  async function cargarRondas() {
    const { data } = await supabase.from('rondas')
      .select('id, nombre, turno').eq('sitio_id', perfil.sitio_id).order('nombre')
    setRondas(data || [])
  }
  async function cargarPuntos() {
    const { data } = await supabase.from('puntos_control')
      .select('id, nombre').eq('sitio_id', perfil.sitio_id).eq('activo', true).order('orden')
    setPuntos(data || [])
  }
  async function cargarItems(rondaId) {
    const { data } = await supabase.from('ronda_puntos')
      .select('id, orden, punto:puntos_control(id, nombre)')
      .eq('ronda_id', rondaId).order('orden')
    setItems(data || [])
  }
  useEffect(() => { cargarRondas(); cargarPuntos() }, [perfil.sitio_id])
  useEffect(() => { if (sel) cargarItems(sel.id); else setItems([]) }, [sel])

  async function crearRonda(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { data, error } = await supabase.from('rondas')
      .insert({ sitio_id: perfil.sitio_id, nombre: nombre.trim() })
      .select('id, nombre, turno').single()
    if (error) { setMsg('Error: ' + error.message); return }
    setNombre(''); setMsg(''); await cargarRondas(); setSel(data)
  }

  async function agregarItem(e) {
    e.preventDefault()
    if (!sel || !addPunto) return
    const orden = items.reduce((m, i) => Math.max(m, i.orden), 0) + 1
    const { error } = await supabase.from('ronda_puntos')
      .insert({ ronda_id: sel.id, punto_id: addPunto, orden })
    if (error) { setMsg(error.code === '23505' ? 'Ese punto ya está en la ronda.' : 'Error: ' + error.message); return }
    setAddPunto(''); setMsg(''); cargarItems(sel.id)
  }
  async function quitarItem(item) {
    await supabase.from('ronda_puntos').delete().eq('id', item.id)
    cargarItems(sel.id)
  }

  const disponibles = puntos.filter((p) => !items.some((i) => i.punto?.id === p.id))

  return (
    <div>
      <h2>Recorridos</h2>
      <p className="hora">Un recorrido es el orden de los puntos a visitar. Las rondas (hora + recorrido) se asignan a cada guardia en la pestaña Empleados.</p>
      <form className="fila" onSubmit={crearRonda}>
        <input placeholder="Nombre del recorrido (ej. Perímetro)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="primario" type="submit">Crear</button>
      </form>

      <ul className="lista">
        {rondas.map((r) => (
          <li key={r.id} className={sel?.id === r.id ? 'ok' : ''}>
            <span className="nombre">{r.nombre}</span>
            <button className="chico" onClick={() => setSel(sel?.id === r.id ? null : r)}>
              {sel?.id === r.id ? 'Cerrar' : 'Editar'}
            </button>
          </li>
        ))}
        {rondas.length === 0 && <p>Creá tu primer recorrido arriba.</p>}
      </ul>

      {sel && (
        <div className="detalle">
          <h3>Puntos de "{sel.nombre}" (en orden)</h3>
          {disponibles.length > 0 ? (
            <form className="fila" onSubmit={agregarItem}>
              <select value={addPunto} onChange={(e) => setAddPunto(e.target.value)}>
                <option value="">Agregar punto…</option>
                {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <button className="primario" type="submit">Agregar</button>
            </form>
          ) : <p className="hora">Todos los puntos del sitio ya están en esta ronda.</p>}
          {msg && <p className="mensaje">{msg}</p>}
          <ul className="lista">
            {items.map((i) => (
              <li key={i.id}>
                <span className="orden">{i.orden}</span>
                <span className="nombre">{i.punto?.nombre}</span>
                <button className="link" onClick={() => quitarItem(i)}>Quitar</button>
              </li>
            ))}
            {items.length === 0 && <p>Agregá los puntos de este recorrido.</p>}
          </ul>
        </div>
      )}
    </div>
  )
}
