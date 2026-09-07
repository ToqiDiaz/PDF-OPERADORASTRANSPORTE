import { useState } from 'react'
import './App.css'

function App() {
  const [formData, setFormData] = useState({
    compania: '',
    registro_municipal: '',
    cedula: '',
    nombres: '',
    apellidos: '',
    licencia: '',
    correo: '',
    telefono: '',
  })

  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [codigoGenerado, setCodigoGenerado] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target

    let nuevoValor = value

    if (name === 'cedula') {
      nuevoValor = value.replace(/\D/g, '').slice(0, 10)
    }

    if (name === 'telefono') {
      nuevoValor = value
        .replace(/[^\d+\-\s]/g, '')
        .slice(0, 30)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nuevoValor,
    }))

    setMensaje('')
    setTipoMensaje('')
  }

  const obtenerNombreArchivo = (response) => {
    const disposition =
      response.headers.get('content-disposition')

    if (!disposition) {
      return 'SOLICITUD_OPERADORA.pdf'
    }

    const match =
      disposition.match(/filename="?([^"]+)"?/)

    return match?.[1] || 'SOLICITUD_OPERADORA.pdf'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMensaje('')
    setTipoMensaje('')
    setCodigoGenerado('')

    const camposObligatorios = [
      formData.compania,
      formData.registro_municipal,
      formData.cedula,
      formData.nombres,
      formData.apellidos,
      formData.licencia,
      formData.correo,
      formData.telefono,
    ]

    if (
      camposObligatorios.some(
        (campo) => !campo.trim()
      )
    ) {
      setMensaje(
        'Por favor complete todos los campos obligatorios.'
      )
      setTipoMensaje('error')
      return
    }

    if (!/^\d{10}$/.test(formData.cedula)) {
      setMensaje(
        'La cédula debe contener exactamente 10 dígitos.'
      )
      setTipoMensaje('error')
      return
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.correo
      )
    ) {
      setMensaje(
        'Ingrese un correo electrónico válido.'
      )
      setTipoMensaje('error')
      return
    }

    try {
      setGenerando(true)

      const response = await fetch(
        'https://pdf-operadoras-backendv1.onrender.com/api/generar-pdf',
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

      const nombreArchivo =
        obtenerNombreArchivo(response)

      const blob =
        await response.blob()

      const url =
        window.URL.createObjectURL(blob)

      const enlace =
        document.createElement('a')

      enlace.href = url
      enlace.download = nombreArchivo

      document.body.appendChild(enlace)

      enlace.click()
      enlace.remove()

      window.URL.revokeObjectURL(url)

      setCodigoGenerado(
        nombreArchivo.replace('.pdf', '')
      )

      setMensaje(
        'Documento generado y descargado correctamente.'
      )

      setTipoMensaje('success')
    } catch (error) {
      console.error(
        'Error generando documento:',
        error
      )

      setMensaje(
        error.message ||
          'No fue posible conectarse con el servidor.'
      )

      setTipoMensaje('error')
    } finally {
      setGenerando(false)
    }
  }

  const limpiarFormulario = () => {
    setFormData({
      compania: '',
      registro_municipal: '',
      cedula: '',
      nombres: '',
      apellidos: '',
      licencia: '',
      correo: '',
      telefono: '',
    })

    setMensaje('')
    setTipoMensaje('')
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
              Complete la información solicitada. Una vez
              validada, el sistema registrará la solicitud y
              generará automáticamente el documento PDF para
              su descarga.
            </p>
          </header>

          <form onSubmit={handleSubmit}>
            <h2 className="section-title">
              Datos de la operadora
            </h2>

            <div className="field">
              <label htmlFor="compania">
                Nombre de la compañía / operadora
                <span className="required"> *</span>
              </label>

              <input
                id="compania"
                name="compania"
                type="text"
                value={formData.compania}
                onChange={handleChange}
                placeholder="Ej. Compañía de Transporte Ejemplo S.A."
                maxLength={200}
              />
            </div>

            <div className="field">
              <label htmlFor="registro_municipal">
                Registro Municipal
                <span className="required"> *</span>
              </label>

              <input
                id="registro_municipal"
                name="registro_municipal"
                type="text"
                value={formData.registro_municipal}
                onChange={handleChange}
                placeholder="Ingrese el número de Registro Municipal"
                maxLength={100}
              />
            </div>

            <h2 className="section-title">
              Datos del solicitante
            </h2>

            <div className="field">
              <label htmlFor="cedula">
                Número de cédula
                <span className="required"> *</span>
              </label>

              <input
                id="cedula"
                name="cedula"
                type="text"
                inputMode="numeric"
                value={formData.cedula}
                onChange={handleChange}
                placeholder="Ej. 1712345678"
                maxLength={10}
              />

              <small className="field-help">
                Ingrese exactamente 10 dígitos.
              </small>
            </div>

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
                maxLength={150}
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
                maxLength={150}
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

            <div className="field">
              <label htmlFor="correo">
                Correo electrónico
                <span className="required"> *</span>
              </label>

              <input
                id="correo"
                name="correo"
                type="email"
                value={formData.correo}
                onChange={handleChange}
                placeholder="Ej. responsable@operadora.com"
                maxLength={200}
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="telefono">
                Teléfono de contacto
                <span className="required"> *</span>
              </label>

              <input
                id="telefono"
                name="telefono"
                type="tel"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="Ej. 0999999999"
                maxLength={30}
                autoComplete="tel"
              />
            </div>

            <div className="declaration-box">
              <strong>
                Declaración
              </strong>

              <p>
                Declaro que la información proporcionada en
                este formulario es verdadera y corresponde a
                los datos registrados por la operadora y el
                solicitante.
              </p>
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={generando}
            >
              {generando
                ? 'Registrando y generando documento...'
                : 'Generar y descargar PDF'}
            </button>
          </form>

          {mensaje && (
            <div
              className={
                tipoMensaje === 'success'
                  ? 'success-box'
                  : 'message-box'
              }
            >
              <strong>
                {mensaje}
              </strong>

              {codigoGenerado && (
                <>
                  <p>
                    Documento generado:
                  </p>

                  <div className="document-code">
                    {codigoGenerado}
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={limpiarFormulario}
                  >
                    Registrar otra solicitud
                  </button>
                </>
              )}
            </div>
          )}

          <div className="security-note">
            <strong>
              Protección de información:
            </strong>{' '}
            Los datos registrados serán utilizados para la
            gestión de la solicitud. El archivo PDF se genera
            únicamente para descarga y no se almacena
            permanentemente en esta versión del sistema.
          </div>

          <div className="footer-form">
            Secretaría de Movilidad · Distrito
            Metropolitano de Quito
          </div>
        </div>
      </div>
    </div>
  )
}

export default App