import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { leerTarjeta, nfcDisponible } from '../lib/nfc.js'
import Encargado from './Encargado.jsx'

// Panel de admin: puntos (con escaneo), rondas y verificación.
export default function Admin({ perfil }) {
  const [vista, setVista] = useState('puntos')
  return (
    <div>
      <div className="tabs">
        <button className={vista === 'puntos' ? 'tab activa' : 'tab'} onClick={() => setVista('puntos')}>Puntos</button>
        <button className={vista === 'rondas' ? 'tab activa' : 'tab'} onClick={() => setVista('rondas')}>Rondas</button>
        <button className={vista === 'verif' ? 'tab activa' : 'tab'} onClick={() => setVista('verif')}>Verificación</button>
      </div>
      {vista === 'puntos' && <Puntos perfil={perfil} />}
      {vista === 'rondas' && <Rondas perfil={perfil} />}
      {vista === 'verif' && <Encargado perfil={perfil} />}
    </div>
  )
}

// ---------------------------------------------------------------- PUNTOS
function Puntos({ perfil }) {
  const [puntos, setPuntos] = useState([])
  const [nombre, setNombre] = useState('')
  const [msg, setMsg] = useState('')
  const [scanId, setScanId] = useState(null)

  async function cargar() {
    const { data } = await supabase.from('puntos_control')
      .select('id, nombre, nfc_uid, orden, activo')
      .eq('sitio_id', perfil.sitio_id)
      .order('orden')
    setPuntos(data || [])
  }
  useEffect(() => { cargar() }, [perfil.sitio_id])

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const orden = puntos.reduce((m, p) => Math.max(m, p.orden), 0) + 1
    const { error } = await supabase.from('puntos_control')
      .insert({ sitio_id: perfil.sitio_id, nombre: nombre.trim(), orden })
    if (error) { setMsg('Error: ' + error.message); return }
    setNombre(''); setMsg('✅ Punto agregado.'); cargar()
  }

  async function escanear(punto) {
    setMsg(''); setScanId(punto.id)
    try {
      const { serialNumber } = await leerTarjeta()
      const uid = (serialNumber || '').toLowerCase()
      if (!uid) { setMsg('No se pudo leer el UID de la tarjeta.'); return }
      const { error } = await supabase.from('puntos_control')
        .update({ nfc_uid: uid }).eq('id', punto.id)
      if (error) {
        setMsg(error.code === '23505'
          ? '⚠️ Esa tarjeta ya está asignada a otro punto.'
          : 'Error: ' + error.message)
        return
      }
      setMsg('✅ Tarjeta asignada a "' + punto.nombre + '".')
      cargar()
    } catch (err) {
      setMsg(err.message || 'No se pudo escanear.')
    } finally {
      setScanId(null)
    }
  }

  async function quitarTarjeta(punto) {
    await supabase.from('puntos_control').update({ nfc_uid: null }).eq('id', punto.id)
    cargar()
  }

  return (
    <div>
      <h2>Puntos de control</h2>
      {!nfcDisponible() && (
        <p className="aviso">Para escanear y asignar tarjetas, abrí esta pantalla en <strong>Chrome en Android</strong>.</p>
      )}

      <form className="fila" onSubmit={agregar}>
        <input placeholder="Nombre del punto (ej. Entrada)" value={nombre}
               onChange={(e) => setNombre(e.target.value)} />
        <button className="primario" type="submit">Agregar</button>
      </form>

      {msg && <p className="mensaje">{msg}</p>}

      <ul className="lista">
        {puntos.map((p) => (
          <li key={p.id} className={p.nfc_uid ? 'ok' : ''}>
            <span className="orden">{p.orden}</span>
            <span className="nombre">
              {p.nombre}
              <br />
              <small className="hora">{p.nfc_uid ? 'UID: ' + p.nfc_uid : '— sin tarjeta —'}</small>
            </span>
            {p.nfc_uid && <button className="link" onClick={() => quitarTarjeta(p)}>Quitar</button>}
            <button className="chico" onClick={() => escanear(p)} disabled={scanId === p.id || !nfcDisponible()}>
              {scanId === p.id ? 'Acercá…' : (p.nfc_uid ? 'Reasignar' : 'Escanear')}
            </button>
          </li>
        ))}
        {puntos.length === 0 && <p>Agregá tu primer punto de control arriba.</p>}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- RONDAS
function Rondas({ perfil }) {
  const [rondas, setRondas] = useState([])
  const [sel, setSel] = useState(null)
  const [items, setItems] = useState([])
  const [puntos, setPuntos] = useState([])
  const [nombre, setNombre] = useState('')
  const [turno, setTurno] = useState('')
  const [addPunto, setAddPunto] = useState('')
  const [addHora, setAddHora] = useState('22:00')
  const [addTol, setAddTol] = useState(10)
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
      .select('id, orden, hora_esperada, tolerancia_min, punto:puntos_control(id, nombre)')
      .eq('ronda_id', rondaId).order('orden')
    setItems(data || [])
  }
  useEffect(() => { cargarRondas(); cargarPuntos() }, [perfil.sitio_id])
  useEffect(() => { if (sel) cargarItems(sel.id); else setItems([]) }, [sel])

  async function crearRonda(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { data, error } = await supabase.from('rondas')
      .insert({ sitio_id: perfil.sitio_id, nombre: nombre.trim(), turno: turno.trim() || null })
      .select('id, nombre, turno').single()
    if (error) { setMsg('Error: ' + error.message); return }
    setNombre(''); setTurno(''); setMsg(''); await cargarRondas(); setSel(data)
  }

  async function agregarItem(e) {
    e.preventDefault()
    if (!sel || !addPunto) return
    const orden = items.reduce((m, i) => Math.max(m, i.orden), 0) + 1
    const { error } = await supabase.from('ronda_puntos')
      .insert({ ronda_id: sel.id, punto_id: addPunto, hora_esperada: addHora,
                tolerancia_min: Number(addTol) || 10, orden })
    if (error) { setMsg(error.code === '23505' ? 'Ese punto ya está en la ronda.' : 'Error: ' + error.message); return }
    setAddPunto(''); setMsg(''); cargarItems(sel.id)
  }

  async function guardarItem(item, campo, valor) {
    await supabase.from('ronda_puntos').update({ [campo]: valor }).eq('id', item.id)
    cargarItems(sel.id)
  }
  async function quitarItem(item) {
    await supabase.from('ronda_puntos').delete().eq('id', item.id)
    cargarItems(sel.id)
  }

  const disponibles = puntos.filter((p) => !items.some((i) => i.punto?.id === p.id))

  return (
    <div>
      <h2>Rondas</h2>

      <form className="fila" onSubmit={crearRonda}>
        <input placeholder="Nombre (ej. Ronda nocturna)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input placeholder="Turno (opcional)" value={turno} onChange={(e) => setTurno(e.target.value)} />
        <button className="primario" type="submit">Crear</button>
      </form>

      <ul className="lista">
        {rondas.map((r) => (
          <li key={r.id} className={sel?.id === r.id ? 'ok' : ''}>
            <span className="nombre">{r.nombre}{r.turno ? ' · ' + r.turno : ''}</span>
            <button className="chico" onClick={() => setSel(sel?.id === r.id ? null : r)}>
              {sel?.id === r.id ? 'Cerrar' : 'Editar puntos'}
            </button>
          </li>
        ))}
        {rondas.length === 0 && <p>Creá tu primera ronda arriba.</p>}
      </ul>

      {sel && (
        <div className="detalle">
          <h3>Puntos de "{sel.nombre}"</h3>

          {disponibles.length > 0 && (
            <form className="fila" onSubmit={agregarItem}>
              <select value={addPunto} onChange={(e) => setAddPunto(e.target.value)}>
                <option value="">Agregar punto…</option>
                {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input type="time" value={addHora} onChange={(e) => setAddHora(e.target.value)} />
              <input type="number" min="0" style={{ width: 70 }} value={addTol}
                     onChange={(e) => setAddTol(e.target.value)} title="Tolerancia (min)" />
              <button className="primario" type="submit">Agregar</button>
            </form>
          )}

          {msg && <p className="mensaje">{msg}</p>}

          <ul className="lista">
            {items.map((i) => (
              <li key={i.id}>
                <span className="orden">{i.orden}</span>
                <span className="nombre">{i.punto?.nombre}</span>
                <input type="time" defaultValue={(i.hora_esperada || '').slice(0, 5)}
                       onBlur={(e) => guardarItem(i, 'hora_esperada', e.target.value)} />
                <input type="number" min="0" style={{ width: 60 }} defaultValue={i.tolerancia_min}
                       onBlur={(e) => guardarItem(i, 'tolerancia_min', Number(e.target.value) || 0)}
                       title="± min" />
                <button className="link" onClick={() => quitarItem(i)}>Quitar</button>
              </li>
            ))}
            {items.length === 0 && <p>Esta ronda no tiene puntos todavía.</p>}
          </ul>
          <p className="hora">La hora es la esperada para el escaneo; la tolerancia es el margen ± en minutos.</p>
        </div>
      )}
    </div>
  )
}
