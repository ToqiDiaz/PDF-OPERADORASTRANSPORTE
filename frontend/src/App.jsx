import { useState } from 'react'
import './App.css'

function App() {
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    licencia: '',
  })

  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [codigoGenerado, setCodigoGenerado] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    setMensaje('')
  }

  const obtenerNombreArchivo = (response) => {
    const disposition = response.headers.get('content-disposition')

    if (!disposition) {
      return 'Formulario_Operadora.pdf'
    }

    const match = disposition.match(/filename="?([^"]+)"?/)

    if (match && match[1]) {
      return match[1]
    }

    return 'Formulario_Operadora.pdf'
  }

  const obtenerCodigoDesdeNombre = (nombreArchivo) => {
    return nombreArchivo.replace('.pdf', '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMensaje('')
    setCodigoGenerado('')

    if (
      !formData.nombres.trim() ||
      !formData.apellidos.trim() ||
      !formData.licencia
    ) {
      setMensaje(
        'Por favor complete todos los campos obligatorios.'
      )
      return
    }

    try {
      setGenerando(true)

      const response = await fetch(
        'http://localhost:3001/api/generar-pdf',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => null)

        throw new Error(
          errorData?.error ||
            'No fue posible generar el documento.'
        )
      }

      const nombreArchivo = obtenerNombreArchivo(response)

      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)

      const enlace = document.createElement('a')

      enlace.href = url
      enlace.download = nombreArchivo

      document.body.appendChild(enlace)

      enlace.click()
      enlace.remove()

      window.URL.revokeObjectURL(url)

      const codigo =
        obtenerCodigoDesdeNombre(nombreArchivo)

      setCodigoGenerado(codigo)

      setMensaje(
        'Documento generado y descargado correctamente.'
      )
    } catch (error) {
      console.error(error)

      setMensaje(
        error.message ||
          'Ocurrió un problema al generar el PDF.'
      )
    } finally {
      setGenerando(false)
    }
  }

  const limpiarFormulario = () => {
    setFormData({
      nombres: '',
      apellidos: '',
      licencia: '',
    })

    setMensaje('')
    setCodigoGenerado('')
  }

  return (
    <div className="page">
      <div className="form-card">
        <div className="top-bar"></div>

        <div className="form-content">
          <header className="header">
            <div className="institution">
              MUNICIPIO DEL DISTRITO METROPOLITANO DE QUITO
            </div>

            <h1>
              Formulario de Operadoras de Transporte
            </h1>

            <p>
              Complete la información solicitada.
              Una vez validada, el sistema generará
              automáticamente el documento PDF.
            </p>
          </header>

          <form onSubmit={handleSubmit}>
            <h2 className="section-title">
              Datos del solicitante
            </h2>

            <div className="field">
              <label htmlFor="nombres">
                Nombres completos
                <span className="required"> *</span>
              </label>

              <input
                id="nombres"
                name="nombres"
                type="text"
                value={formData.nombres}
                onChange={handleChange}
                placeholder="Ingrese sus nombres completos"
                maxLength={100}
                autoComplete="given-name"
              />
            </div>

            <div className="field">
              <label htmlFor="apellidos">
                Apellidos completos
                <span className="required"> *</span>
              </label>

              <input
                id="apellidos"
                name="apellidos"
                type="text"
                value={formData.apellidos}
                onChange={handleChange}
                placeholder="Ingrese sus apellidos completos"
                maxLength={100}
                autoComplete="family-name"
              />
            </div>

            <div className="field">
              <label>
                Tipo de licencia
                <span className="required"> *</span>
              </label>

              <div className="license-options">
                {['A', 'B', 'C', 'D'].map((tipo) => (
                  <label
                    className="radio-option"
                    key={tipo}
                  >
                    <input
                      type="radio"
                      name="licencia"
                      value={tipo}
                      checked={
                        formData.licencia === tipo
                      }
                      onChange={handleChange}
                    />

                    <span>
                      Licencia tipo {tipo}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={generando}
            >
              {generando
                ? 'Generando documento...'
                : 'Generar y descargar PDF'}
            </button>
          </form>

          {mensaje && (
            <div
              className={
                codigoGenerado
                  ? 'success-box'
                  : 'message-box'
              }
            >
              <strong>{mensaje}</strong>

              {codigoGenerado && (
                <>
                  <p>
                    Código del documento:
                  </p>

                  <div className="document-code">
                    {codigoGenerado}
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={limpiarFormulario}
                  >
                    Generar otro formulario
                  </button>
                </>
              )}
            </div>
          )}

          <div className="security-note">
            <strong>
              Protección de información:
            </strong>{' '}
            Los datos ingresados se utilizan
            únicamente durante la generación
            del documento y no se almacenan
            en esta versión del sistema.
          </div>

          <div className="footer-form">
            Secretaría de Movilidad ·
            Distrito Metropolitano de Quito
          </div>
        </div>
      </div>
    </div>
  )
}

export default App