import { useState } from 'react'
import Puntos from './admin/Puntos.jsx'
import Rondas from './admin/Rondas.jsx'
import Empleados from './admin/Empleados.jsx'
import Reporte from './admin/Reporte.jsx'

// Panel de admin con pestañas.
export default function Admin({ perfil }) {
  const [vista, setVista] = useState('reporte')
  const tab = (id, label) => (
    <button className={vista === id ? 'tab activa' : 'tab'} onClick={() => setVista(id)}>{label}</button>
  )
  return (
    <div>
      <div className="tabs">
        {tab('reporte', 'Reporte')}
        {tab('empleados', 'Empleados')}
        {tab('rondas', 'Rondas')}
        {tab('puntos', 'Puntos')}
      </div>
      {vista === 'reporte' && <Reporte perfil={perfil} />}
      {vista === 'empleados' && <Empleados perfil={perfil} />}
      {vista === 'rondas' && <Rondas perfil={perfil} />}
      {vista === 'puntos' && <Puntos perfil={perfil} />}
    </div>
  )
}
