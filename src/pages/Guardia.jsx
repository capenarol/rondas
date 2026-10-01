import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { leerTarjeta, nfcDisponible } from '../lib/nfc.js'

// Pantalla del guardia: elegir ronda del día y escanear los puntos.
export default function Guardia({ perfil }) {
  const [rondas, setRondas] = useState([])
  const [rondaSel, setRondaSel] = useState(null)
  const [ejecucion, setEjecucion] = useState(null)
  const [puntos, setPuntos] = useState([])        // ronda_puntos + datos del punto
  const [escaneados, setEscaneados] = useState({}) // punto_id -> escaneado_en
  const [mensaje, setMensaje] = useState('')
  const [escaneando, setEscaneando] = useState(false)

  // Cargar rondas del sitio del guardia.
  useEffect(() => {
    supabase.from('rondas')
      .select('id, nombre, turno')
      .eq('sitio_id', perfil.sitio_id)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setRondas(data || []))
  }, [perfil.sitio_id])

  // Al elegir una ronda: asegurar ejecución de hoy y cargar puntos + escaneos.
  async function abrirRonda(ronda) {
    setRondaSel(ronda)
    setMensaje('')

    // Puntos de la ronda (con nfc_uid del punto, para hacer el match).
    const { data: rp } = await supabase.from('ronda_puntos')
      .select('orden, hora_esperada, tolerancia_min, punto:puntos_control(id, nombre, nfc_uid)')
      .eq('ronda_id', ronda.id)
      .order('orden')
    setPuntos(rp || [])

    // Buscar ejecución de hoy; si no existe, crearla.
    let { data: ej } = await supabase.from('ejecuciones_ronda')
      .select('id')
      .eq('ronda_id', ronda.id)
      .eq('guardia_id', perfil.id)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!ej) {
      const ins = await supabase.from('ejecuciones_ronda')
        .insert({ ronda_id: ronda.id, guardia_id: perfil.id })
        .select('id')
        .single()
      ej = ins.data
    }
    setEjecucion(ej)

    if (ej) {
      const { data: regs } = await supabase.from('registros_escaneo')
        .select('punto_id, escaneado_en')
        .eq('ejecucion_id', ej.id)
      const mapa = {}
      for (const r of regs || []) mapa[r.punto_id] = r.escaneado_en
      setEscaneados(mapa)
    }
  }

  async function escanear() {
    if (!ejecucion) return
    setMensaje('')
    setEscaneando(true)
    try {
      const { serialNumber } = await leerTarjeta()
      const uid = (serialNumber || '').toLowerCase()

      // Buscar el punto de ESTA ronda cuyo nfc_uid coincide.
      const item = puntos.find(
        (p) => (p.punto.nfc_uid || '').toLowerCase() === uid
      )
      if (!item) {
        setMensaje('⚠️ Tarjeta no reconocida en esta ronda (UID ' + uid + ').')
        return
      }
      if (escaneados[item.punto.id]) {
        setMensaje('ℹ️ "' + item.punto.nombre + '" ya estaba registrado.')
        return
      }

      // Insertar. La hora la pone el servidor; el UNIQUE evita duplicados.
      const { error } = await supabase.from('registros_escaneo')
        .insert({
          ejecucion_id: ejecucion.id,
          punto_id: item.punto.id,
          guardia_id: perfil.id,
          nfc_uid: uid
        })
      if (error && error.code !== '23505') { // 23505 = unique_violation (duplicado)
        setMensaje('Error al registrar: ' + error.message)
        return
      }
      setEscaneados((prev) => ({ ...prev, [item.punto.id]: new Date().toISOString() }))
      setMensaje('✅ "' + item.punto.nombre + '" registrado.')
    } catch (err) {
      setMensaje(err.message || 'No se pudo escanear.')
    } finally {
      setEscaneando(false)
    }
  }

  if (!nfcDisponible()) {
    return (
      <div className="tarjeta">
        <h2>NFC no disponible</h2>
        <p>Esta app necesita <strong>Chrome en Android</strong> para leer tarjetas NFC.
           Abrila desde ese navegador en el celular.</p>
      </div>
    )
  }

  if (!rondaSel) {
    return (
      <div>
        <h2>Elegí tu ronda</h2>
        {rondas.length === 0 && <p>No hay rondas asignadas a tu sitio todavía.</p>}
        <ul className="lista">
          {rondas.map((r) => (
            <li key={r.id}>
              <button className="item" onClick={() => abrirRonda(r)}>
                <strong>{r.nombre}</strong>{r.turno ? ' · ' + r.turno : ''}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const total = puntos.length
  const hechos = puntos.filter((p) => escaneados[p.punto.id]).length

  return (
    <div>
      <button className="link" onClick={() => setRondaSel(null)}>← Volver</button>
      <h2>{rondaSel.nombre}</h2>
      <p className="progreso">{hechos} / {total} puntos</p>

      <button className="primario grande" onClick={escanear} disabled={escaneando}>
        {escaneando ? 'Acercá la tarjeta…' : 'Escanear punto'}
      </button>
      {mensaje && <p className="mensaje">{mensaje}</p>}

      <ul className="lista">
        {puntos.map((p) => (
          <li key={p.punto.id} className={escaneados[p.punto.id] ? 'ok' : ''}>
            <span className="orden">{p.orden}</span>
            <span className="nombre">{p.punto.nombre}</span>
            <span className="hora">
              {escaneados[p.punto.id]
                ? new Date(escaneados[p.punto.id]).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
                : (p.hora_esperada?.slice(0, 5) || '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
