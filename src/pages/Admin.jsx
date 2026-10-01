import Encargado from './Encargado.jsx'

// Admin: por ahora ve la verificación (como el encargado) y tendrá
// el ABM de sitios, puntos (tarjetas), rondas y usuarios en la Fase 3.
export default function Admin({ perfil }) {
  return (
    <div>
      <div className="aviso">
        <strong>Configuración (Fase 3):</strong> acá va el alta/baja de tarjetas NFC
        y su orden, las plantillas de ronda (hora esperada y tolerancia) y la gestión
        de usuarios. Lo construimos en la siguiente fase.
      </div>
      <Encargado perfil={perfil} />
    </div>
  )
}
