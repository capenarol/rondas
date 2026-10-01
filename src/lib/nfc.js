// Envoltorio de la Web NFC API (solo Chrome en Android, sobre HTTPS).

export function nfcDisponible() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

// Lee UNA tarjeta y devuelve { serialNumber, records }.
// Rechaza si NFC no está disponible, el usuario no da permiso, o hay timeout.
export async function leerTarjeta({ timeoutMs = 20000 } = {}) {
  if (!nfcDisponible()) {
    throw new Error('Este dispositivo o navegador no soporta NFC (usá Chrome en Android).')
  }

  const reader = new NDEFReader()
  const controller = new AbortController()

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Tiempo de espera agotado. Acercá la tarjeta e intentá de nuevo.'))
    }, timeoutMs)

    reader.onreading = (event) => {
      clearTimeout(timer)
      controller.abort()
      const records = []
      for (const rec of event.message.records) {
        try {
          if (rec.recordType === 'text') {
            const dec = new TextDecoder(rec.encoding || 'utf-8')
            records.push({ tipo: 'text', valor: dec.decode(rec.data) })
          } else if (rec.recordType === 'url') {
            const dec = new TextDecoder()
            records.push({ tipo: 'url', valor: dec.decode(rec.data) })
          }
        } catch (_) { /* registro ilegible: se ignora */ }
      }
      resolve({ serialNumber: event.serialNumber || null, records })
    }

    reader.onreadingerror = () => {
      clearTimeout(timer)
      controller.abort()
      reject(new Error('No se pudo leer la tarjeta. Probá de nuevo.'))
    }

    reader.scan({ signal: controller.signal }).catch((err) => {
      clearTimeout(timer)
      // NotAllowedError = permiso denegado
      reject(err)
    })
  })
}
