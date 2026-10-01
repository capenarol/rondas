import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { leerTarjeta, nfcDisponible } from '../lib/nfc.js'
import Encargado from './Encargado.jsx'

// Panel de admin: gestión de puntos (con escaneo de tarjetas) + verificación.
export default function Admin({ perfil }) {
  const [vista, setVista] = useState('puntos')
  return (
    <div>
      <div className="tabs">
        <button className={vista === 'puntos' ? 'tab activa' : 'tab'} onClick={() => setVista('puntos')}>Puntos</button>
        <button className={vista === 'verif' ? 'tab activa' : 'tab'} onClick={() => setVista('verif')}>Verificación</button>
      </div>
      {vista === 'puntos' ? <Puntos perfil={perfil} /> : <Encargado perfil={perfil} />}
    </div>
  )
}

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
            {p.nfc_uid && (
              <button className="link" onClick={() => quitarTarjeta(p)}>Quitar</button>
            )}
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
