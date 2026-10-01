import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { leerTarjeta, nfcDisponible } from '../lib/nfc.js'

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' })
const hhmm = (t) => (t || '').slice(0, 5)

// Pantalla del guardia: sus rondas programadas del día; escanea los puntos.
export default function Guardia({ perfil }) {
  const [pases, setPases] = useState([])
  const [sel, setSel] = useState(null)       // pase seleccionado (con numero)
  const [ejecucion, setEjecucion] = useState(null)
  const [puntos, setPuntos] = useState([])
  const [escaneados, setEscaneados] = useState({})
  const [mensaje, setMensaje] = useState('')
  const [escaneando, setEscaneando] = useState(false)

  useEffect(() => {
    supabase.from('programacion')
      .select('id, hora_inicio, ronda:rondas(id, nombre)')
      .eq('guardia_id', perfil.id).eq('activo', true)
      .order('hora_inicio')
      .then(({ data }) => setPases((data || []).map((p, i) => ({ ...p, numero: i + 1 }))))
  }, [perfil.id])

  async function abrir(pase) {
    setSel(pase); setMensaje('')
    const fecha = hoy()

    const { data: rp } = await supabase.from('ronda_puntos')
      .select('orden, punto:puntos_control(id, nombre, nfc_uid)')
      .eq('ronda_id', pase.ronda?.id).order('orden')
    setPuntos(rp || [])

    let { data: eje } = await supabase.from('ejecuciones_ronda')
      .select('id').eq('programacion_id', pase.id)
      .eq('guardia_id', perfil.id).eq('fecha', fecha).maybeSingle()
    if (!eje) {
      const ins = await supabase.from('ejecuciones_ronda')
        .insert({ ronda_id: pase.ronda?.id, guardia_id: perfil.id, programacion_id: pase.id,
                  numero: pase.numero, hora_inicio: pase.hora_inicio, fecha })
        .select('id').single()
      eje = ins.data
    }
    setEjecucion(eje)
    if (eje) {
      const { data: regs } = await supabase.from('registros_escaneo')
        .select('punto_id, escaneado_en').eq('ejecucion_id', eje.id)
      const m = {}; for (const r of regs || []) m[r.punto_id] = r.escaneado_en
      setEscaneados(m)
    }
  }

  async function escanear() {
    if (!ejecucion) return
    setMensaje(''); setEscaneando(true)
    try {
      const { serialNumber } = await leerTarjeta()
      const uid = (serialNumber || '').toLowerCase()
      const item = puntos.find((p) => (p.punto.nfc_uid || '').toLowerCase() === uid)
      if (!item) { setMensaje('⚠️ Tarjeta no reconocida en esta ronda (UID ' + uid + ').'); return }
      if (escaneados[item.punto.id]) { setMensaje('ℹ️ "' + item.punto.nombre + '" ya estaba registrado.'); return }
      const { error } = await supabase.from('registros_escaneo')
        .insert({ ejecucion_id: ejecucion.id, punto_id: item.punto.id, guardia_id: perfil.id, nfc_uid: uid })
      if (error && error.code !== '23505') { setMensaje('Error al registrar: ' + error.message); return }
      setEscaneados((prev) => ({ ...prev, [item.punto.id]: new Date().toISOString() }))
      setMensaje('✅ "' + item.punto.nombre + '" registrado.')
    } catch (err) {
      setMensaje(err.message || 'No se pudo escanear.')
    } finally { setEscaneando(false) }
  }

  if (!nfcDisponible()) {
    return (
      <div className="tarjeta">
        <h2>NFC no disponible</h2>
        <p>Esta app necesita <strong>Chrome en Android</strong> para leer tarjetas. Abrila desde el celular.</p>
      </div>
    )
  }

  if (!sel) {
    return (
      <div>
        <h2>Tus rondas de hoy</h2>
        {pases.length === 0 && <p>No tenés rondas programadas. Avisá al encargado.</p>}
        <ul className="lista">
          {pases.map((p) => (
            <li key={p.id}>
              <span className="orden">{p.numero}</span>
              <span className="nombre"><strong>{hhmm(p.hora_inicio)}</strong> · {p.ronda?.nombre}</span>
              <button className="chico" onClick={() => abrir(p)}>Abrir</button>
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
      <button className="link" onClick={() => { setSel(null); setEjecucion(null) }}>← Volver</button>
      <h2>Ronda {sel.numero} · {hhmm(sel.hora_inicio)}</h2>
      <p className="hora">{sel.ronda?.nombre} — {hechos} / {total} puntos</p>

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
                : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
