import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const hhmm = (t) => (t || '').slice(0, 5)
const horaReal = (ts) => ts ? new Date(ts).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }) : '—'

// Reporte por empleado y día: cada ronda (N° + hora de inicio) y la hora marcada en cada punto.
export default function Reporte({ perfil }) {
  const [empleados, setEmpleados] = useState([])
  const [guardia, setGuardia] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [pases, setPases] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase.from('perfiles').select('id, nombre')
      .eq('rol', 'guardia').eq('sitio_id', perfil.sitio_id).order('nombre')
      .then(({ data }) => setEmpleados(data || []))
  }, [perfil.sitio_id])

  useEffect(() => {
    if (!guardia) { setPases([]); return }
    construir()
  }, [guardia, fecha])

  async function construir() {
    setCargando(true)
    // Programación (pases) del guardia, ordenada por hora.
    const { data: prog } = await supabase.from('programacion')
      .select('id, hora_inicio, ronda:rondas(id, nombre)')
      .eq('guardia_id', guardia).eq('activo', true).order('hora_inicio')

    // Ejecuciones del guardia en la fecha.
    const { data: ejs } = await supabase.from('ejecuciones_ronda')
      .select('id, programacion_id')
      .eq('guardia_id', guardia).eq('fecha', fecha)
    const ejePorProg = {}
    for (const e of ejs || []) ejePorProg[e.programacion_id] = e.id

    const resultado = []
    for (const [idx, p] of (prog || []).entries()) {
      const ejeId = ejePorProg[p.id] || null
      const { data: rp } = await supabase.from('ronda_puntos')
        .select('orden, punto:puntos_control(id, nombre)')
        .eq('ronda_id', p.ronda?.id).order('orden')
      let marcas = {}
      if (ejeId) {
        const { data: regs } = await supabase.from('registros_escaneo')
          .select('punto_id, escaneado_en').eq('ejecucion_id', ejeId)
        for (const r of regs || []) marcas[r.punto_id] = r.escaneado_en
      }
      resultado.push({
        numero: idx + 1,
        hora_inicio: p.hora_inicio,
        ronda: p.ronda?.nombre,
        realizada: !!ejeId,
        puntos: (rp || []).map((x) => ({
          nombre: x.punto?.nombre,
          marca: marcas[x.punto?.id] || null
        }))
      })
    }
    setPases(resultado)
    setCargando(false)
  }

  return (
    <div>
      <h2>Reporte</h2>
      <div className="fila">
        <select value={guardia} onChange={(e) => setGuardia(e.target.value)}>
          <option value="">Elegí un empleado…</option>
          {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      {cargando && <p>Cargando…</p>}
      {!cargando && guardia && pases.length === 0 && <p>Este empleado no tiene rondas programadas.</p>}

      {pases.map((p) => (
        <div key={p.numero} className={'pase' + (p.realizada ? '' : ' pendiente')}>
          <h3>Ronda {p.numero} · {hhmm(p.hora_inicio)} <small className="hora">{p.ronda}{p.realizada ? '' : ' · no realizada'}</small></h3>
          <ul className="lista">
            {p.puntos.map((pt, i) => (
              <li key={i} className={pt.marca ? 'ok' : ''}>
                <span className="nombre">{pt.nombre}</span>
                <span className="hora">{horaReal(pt.marca)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
