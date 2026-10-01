import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Panel del encargado (solo lectura): verificar los escaneos.
export default function Encargado({ perfil }) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    setCargando(true)
    supabase.from('vista_escaneos')
      .select('registro_id, ronda, punto, guardia, hora_esperada, hora_real, estado, escaneado_en')
      .eq('fecha', fecha)
      .order('escaneado_en', { ascending: true })
      .then(({ data }) => { setFilas(data || []); setCargando(false) })
  }, [fecha])

  return (
    <div>
      <h2>Verificación de rondas</h2>
      <label>Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>

      {cargando && <p>Cargando…</p>}
      {!cargando && filas.length === 0 && <p>No hay escaneos para esta fecha.</p>}

      {filas.length > 0 && (
        <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Ronda</th><th>Punto</th><th>Guardia</th><th>Esperada</th><th>Real</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.registro_id}>
                <td>{f.ronda}</td>
                <td>{f.punto}</td>
                <td>{f.guardia}</td>
                <td>{f.hora_esperada?.slice(0, 5)}</td>
                <td>{f.hora_real?.slice(0, 5)}</td>
                <td><span className={'estado estado-' + f.estado}>{f.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
