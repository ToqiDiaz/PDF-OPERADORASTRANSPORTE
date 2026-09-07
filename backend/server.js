const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const fs = require('fs')
const path = require('path')

const {
  PDFDocument,
  StandardFonts,
  rgb,
} = require('pdf-lib')

const app = express()
const PORT = 3001

/* =========================================================
   SEGURIDAD
========================================================= */

app.use(helmet())

app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    exposedHeaders: ['Content-Disposition'],
  })
)

app.use(express.json({ limit: '30kb' }))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', limiter)

/* =========================================================
   RUTA DE LA PLANTILLA
========================================================= */

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'plantillas',
  'TESTplantilla_operadoras.pdf'
)

/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

function limpiarTexto(valor, maxLength = 200) {
  if (typeof valor !== 'string') {
    return ''
  }

  return valor
    .trim()
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
}

function generarCodigo() {
  const ahora = new Date()
  const year = ahora.getFullYear()

  const random = Math.floor(
    1000 + Math.random() * 9000
  )

  return `IT-SM-DMITM-${year}-${random}`
}

function dividirTexto({
  texto,
  fuente,
  fontSize,
  anchoMaximo,
}) {
  const palabras = texto.split(' ')
  const lineas = []

  let lineaActual = ''

  for (const palabra of palabras) {
    const prueba =
      lineaActual.length === 0
        ? palabra
        : `${lineaActual} ${palabra}`

    const ancho =
      fuente.widthOfTextAtSize(
        prueba,
        fontSize
      )

    if (ancho <= anchoMaximo) {
      lineaActual = prueba
    } else {
      if (lineaActual) {
        lineas.push(lineaActual)
      }

      lineaActual = palabra
    }
  }

  if (lineaActual) {
    lineas.push(lineaActual)
  }

  return lineas
}

function calcularTamanoFuente({
  texto,
  fuente,
  anchoMaximo,
  maxFontSize = 11,
  minFontSize = 8,
}) {
  let size = maxFontSize

  while (size > minFontSize) {
    const ancho =
      fuente.widthOfTextAtSize(
        texto,
        size
      )

    if (ancho <= anchoMaximo) {
      return size
    }

    size -= 0.5
  }

  return minFontSize
}

function dibujarParrafo({
  page,
  texto,
  fuente,
  fontSize,
  x,
  y,
  anchoMaximo,
  lineHeight = 14,
  color = rgb(0.15, 0.15, 0.15),
}) {
  const lineas = dividirTexto({
    texto,
    fuente,
    fontSize,
    anchoMaximo,
  })

  let posicionY = y

  for (const linea of lineas) {
    page.drawText(linea, {
      x,
      y: posicionY,
      size: fontSize,
      font: fuente,
      color,
    })

    posicionY -= lineHeight
  }

  return posicionY
}

function dibujarCampo({
  page,
  etiqueta,
  valor,
  fuenteNormal,
  fuenteBold,
  x,
  y,
  anchoTotal,
}) {
  page.drawText(etiqueta, {
    x,
    y,
    size: 9,
    font: fuenteBold,
    color: rgb(0.05, 0.22, 0.35),
  })

  const yValor = y - 17

  const size =
    calcularTamanoFuente({
      texto: valor,
      fuente: fuenteNormal,
      anchoMaximo: anchoTotal,
      maxFontSize: 11,
      minFontSize: 8,
    })

  const lineas =
    dividirTexto({
      texto: valor,
      fuente: fuenteNormal,
      fontSize: size,
      anchoMaximo: anchoTotal,
    })

  let posicionY = yValor

  for (const linea of lineas) {
    page.drawText(linea, {
      x,
      y: posicionY,
      size,
      font: fuenteNormal,
      color: rgb(0.12, 0.12, 0.12),
    })

    posicionY -= size + 4
  }

  return posicionY - 15
}

/* =========================================================
   RUTA PRINCIPAL
========================================================= */

app.get('/', (req, res) => {
  const plantillaExiste =
    fs.existsSync(TEMPLATE_PATH)

  res.send(`
    <html>
      <head>
        <title>Servidor PDF Operadoras</title>
      </head>

      <body style="
        font-family: Arial, sans-serif;
        background:#f4f6f8;
        padding:40px;
      ">

        <div style="
          max-width:700px;
          margin:auto;
          background:white;
          padding:30px;
          border-radius:12px;
          box-shadow:0 8px 25px rgba(0,0,0,.08);
        ">

          <h2 style="
            color:#003B5C;
            margin-top:0;
          ">
            Servidor PDF Operadoras
          </h2>

          <p>
            Estado del servidor:
            <strong style="color:green;">
              FUNCIONANDO
            </strong>
          </p>

          <p>
            Plantilla institucional:
            <strong style="
              color:${plantillaExiste ? 'green' : 'red'};
            ">
              ${plantillaExiste ? 'ENCONTRADA' : 'NO ENCONTRADA'}
            </strong>
          </p>

          <p>
            Ruta utilizada:
          </p>

          <code style="
            display:block;
            background:#f3f3f3;
            padding:12px;
            border-radius:6px;
          ">
            ${TEMPLATE_PATH}
          </code>

          <p style="margin-top:20px;">
            Endpoint disponible:
          </p>

          <code>
            POST /api/generar-pdf
          </code>

        </div>

      </body>
    </html>
  `)
})

/* =========================================================
   STATUS
========================================================= */

app.get('/api/status', (req, res) => {
  res.json({
    estado: 'OK',
    servicio: 'Generador PDF Operadoras',
    plantilla:
      fs.existsSync(TEMPLATE_PATH)
        ? 'encontrada'
        : 'no encontrada',
    rutaPlantilla: TEMPLATE_PATH,
    fecha: new Date().toISOString(),
  })
})

/* =========================================================
   GENERAR PDF
========================================================= */

app.post(
  '/api/generar-pdf',
  async (req, res) => {
    try {
      /* ===================================================
         DATOS DEL FORMULARIO
      =================================================== */

      const nombres = limpiarTexto(
        req.body.nombres,
        150
      )

      const apellidos = limpiarTexto(
        req.body.apellidos,
        150
      )

      const licencia = limpiarTexto(
        req.body.licencia,
        2
      )

      /* ===================================================
         VALIDACIONES
      =================================================== */

      if (!nombres) {
        return res.status(400).json({
          error:
            'Debe ingresar los nombres completos.',
        })
      }

      if (!apellidos) {
        return res.status(400).json({
          error:
            'Debe ingresar los apellidos completos.',
        })
      }

      if (
        !['A', 'B', 'C', 'D'].includes(
          licencia
        )
      ) {
        return res.status(400).json({
          error:
            'Debe seleccionar un tipo de licencia válido.',
        })
      }

      /* ===================================================
         VALIDAR EXISTENCIA DE PLANTILLA
      =================================================== */

      if (!fs.existsSync(TEMPLATE_PATH)) {
        console.error(
          'Plantilla no encontrada:',
          TEMPLATE_PATH
        )

        return res.status(500).json({
          error:
            'No se encontró la plantilla institucional.',
        })
      }

      /* ===================================================
         LEER PLANTILLA
      =================================================== */

      const plantillaBytes =
        fs.readFileSync(TEMPLATE_PATH)

      const pdfDoc =
        await PDFDocument.load(
          plantillaBytes
        )

      const pages =
        pdfDoc.getPages()

      const page = pages[0]

      const {
        width,
        height,
      } = page.getSize()

      /* ===================================================
         FUENTES
      =================================================== */

      const fuenteNormal =
        await pdfDoc.embedFont(
          StandardFonts.Helvetica
        )

      const fuenteBold =
        await pdfDoc.embedFont(
          StandardFonts.HelveticaBold
        )

      /* ===================================================
         CÓDIGO
      =================================================== */

      const codigo = generarCodigo()

      /* ===================================================
         CÓDIGO EN CAJA SUPERIOR DERECHA
      =================================================== */

      const codigoSize =
        calcularTamanoFuente({
          texto: codigo,
          fuente: fuenteBold,
          anchoMaximo: 90,
          maxFontSize: 7,
          minFontSize: 5.5,
        })

      const anchoCodigo =
        fuenteBold.widthOfTextAtSize(
          codigo,
          codigoSize
        )

      page.drawText(codigo, {
        x:
          width - 88 - anchoCodigo / 2,
        y:
          height - 73,
        size: codigoSize,
        font: fuenteBold,
        color: rgb(0.08, 0.08, 0.08),
      })

      /* ===================================================
         TÍTULO
      =================================================== */

      const titulo =
        'SOLICITUD DE REGISTRO DE OPERADORA DE TRANSPORTE'

      const tituloLineas =
        dividirTexto({
          texto: titulo,
          fuente: fuenteBold,
          fontSize: 11.5,
          anchoMaximo: 390,
        })

      let tituloY =
        height - 130

      for (const linea of tituloLineas) {
        const ancho =
          fuenteBold.widthOfTextAtSize(
            linea,
            11.5
          )

        page.drawText(linea, {
          x:
            (width - ancho) / 2,
          y: tituloY,
          size: 11.5,
          font: fuenteBold,
          color: rgb(
            0.08,
            0.08,
            0.08
          ),
        })

        tituloY -= 15
      }

      /* ===================================================
         CUERPO PRINCIPAL
      =================================================== */

      let currentY =
        tituloY - 28

      const margenIzquierdo = 85
      const anchoContenido =
        width - 170

      const introduccion =
        'Por medio del presente, el/la solicitante registra la información correspondiente para iniciar el proceso de revisión de datos asociados a la operadora de transporte. La información consignada en este documento ha sido proporcionada mediante el formulario electrónico habilitado por la Secretaría de Movilidad y será utilizada para los fines administrativos y técnicos correspondientes.'

      currentY =
        dibujarParrafo({
          page,
          texto: introduccion,
          fuente: fuenteNormal,
          fontSize: 9.3,
          x: margenIzquierdo,
          y: currentY,
          anchoMaximo:
            anchoContenido,
          lineHeight: 13,
        })

      currentY -= 22

      /* ===================================================
         SECCIÓN 1
      =================================================== */

      page.drawText(
        '1. DATOS DEL SOLICITANTE',
        {
          x: margenIzquierdo,
          y: currentY,
          size: 10,
          font: fuenteBold,
          color: rgb(
            0.05,
            0.22,
            0.35
          ),
        }
      )

      currentY -= 25

      currentY =
        dibujarCampo({
          page,
          etiqueta:
            'Nombres completos',
          valor: nombres,
          fuenteNormal,
          fuenteBold,
          x: margenIzquierdo,
          y: currentY,
          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,
          etiqueta:
            'Apellidos completos',
          valor: apellidos,
          fuenteNormal,
          fuenteBold,
          x: margenIzquierdo,
          y: currentY,
          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,
          etiqueta:
            'Tipo de licencia',
          valor:
            `Licencia tipo ${licencia}`,
          fuenteNormal,
          fuenteBold,
          x: margenIzquierdo,
          y: currentY,
          anchoTotal:
            anchoContenido,
        })

      /* ===================================================
         SECCIÓN 2
      =================================================== */

      currentY -= 5

      page.drawText(
        '2. DECLARACIÓN',
        {
          x: margenIzquierdo,
          y: currentY,
          size: 10,
          font: fuenteBold,
          color: rgb(
            0.05,
            0.22,
            0.35
          ),
        }
      )

      currentY -= 25

      const declaracion =
        'Declaro que la información proporcionada en el presente documento es verdadera y corresponde a los datos registrados por el solicitante. Asimismo, autorizo su utilización para los fines administrativos y técnicos relacionados con el proceso correspondiente.'

      currentY =
        dibujarParrafo({
          page,
          texto: declaracion,
          fuente: fuenteNormal,
          fontSize: 9.3,
          x: margenIzquierdo,
          y: currentY,
          anchoMaximo:
            anchoContenido,
          lineHeight: 13,
        })

      /* ===================================================
         TEXTO FINAL
      =================================================== */

      currentY -= 18

      const textoFinal =
        'Para constancia de la información registrada, el/la solicitante suscribe el presente documento.'

      currentY =
        dibujarParrafo({
          page,
          texto: textoFinal,
          fuente: fuenteNormal,
          fontSize: 9.3,
          x: margenIzquierdo,
          y: currentY,
          anchoMaximo:
            anchoContenido,
          lineHeight: 13,
        })

      /* ===================================================
         FIRMA
      =================================================== */

      currentY -= 55

      if (currentY < 125) {
        currentY = 125
      }

      const lineaInicio =
        width / 2 - 110

      const lineaFin =
        width / 2 + 110

      page.drawLine({
        start: {
          x: lineaInicio,
          y: currentY,
        },
        end: {
          x: lineaFin,
          y: currentY,
        },
        thickness: 0.7,
        color: rgb(
          0.35,
          0.35,
          0.35
        ),
      })

      const nombreFirma =
        `${nombres} ${apellidos}`

      const firmaSize =
        calcularTamanoFuente({
          texto: nombreFirma,
          fuente: fuenteNormal,
          anchoMaximo: 220,
          maxFontSize: 9,
          minFontSize: 7,
        })

      const lineasFirma =
        dividirTexto({
          texto: nombreFirma,
          fuente: fuenteNormal,
          fontSize: firmaSize,
          anchoMaximo: 220,
        })

      let firmaY =
        currentY - 15

      for (
        const linea of lineasFirma
      ) {
        const ancho =
          fuenteNormal
            .widthOfTextAtSize(
              linea,
              firmaSize
            )

        page.drawText(
          linea,
          {
            x:
              (width - ancho) / 2,
            y: firmaY,
            size: firmaSize,
            font: fuenteNormal,
            color: rgb(
              0.20,
              0.20,
              0.20
            ),
          }
        )

        firmaY -=
          firmaSize + 2
      }

      const etiquetaFirma =
        'Firma del solicitante'

      const anchoEtiqueta =
        fuenteNormal
          .widthOfTextAtSize(
            etiquetaFirma,
            8
          )

      page.drawText(
        etiquetaFirma,
        {
          x:
            (width - anchoEtiqueta) /
            2,
          y:
            firmaY - 2,
          size: 8,
          font: fuenteNormal,
          color: rgb(
            0.35,
            0.35,
            0.35
          ),
        }
      )

      /* ===================================================
         METADATOS DEL DOCUMENTO
      =================================================== */

      pdfDoc.setTitle(
        `Solicitud ${codigo}`
      )

      pdfDoc.setAuthor(
        'Secretaría de Movilidad'
      )

      pdfDoc.setSubject(
        'Solicitud de registro de operadora de transporte'
      )

      pdfDoc.setCreator(
        'Sistema PDF Operadoras'
      )

      /* ===================================================
         GENERAR PDF FINAL
      =================================================== */

      const pdfBytes =
        await pdfDoc.save()

      const nombreArchivo =
        `${codigo}.pdf`

      res.setHeader(
        'Content-Type',
        'application/pdf'
      )

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreArchivo}"`
      )

      res.setHeader(
        'Content-Length',
        pdfBytes.length
      )

      res.setHeader(
        'X-Content-Type-Options',
        'nosniff'
      )

      res.send(
        Buffer.from(pdfBytes)
      )

    } catch (error) {
      console.error(
        'Error generando PDF:',
        error
      )

      if (!res.headersSent) {
        res.status(500).json({
          error:
            'No fue posible generar el documento.',
        })
      }
    }
  }
)

/* =========================================================
   RUTA NO ENCONTRADA
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    error:
      'Ruta no encontrada.',
  })
})

/* =========================================================
   INICIAR SERVIDOR
========================================================= */

app.listen(PORT, () => {
  console.log(
    '=========================================='
  )

  console.log(
    'Servidor PDF Operadoras iniciado'
  )

  console.log(
    `Servidor: http://localhost:${PORT}`
  )

  console.log(
    'Plantilla utilizada:'
  )

  console.log(
    TEMPLATE_PATH
  )

  console.log(
    fs.existsSync(TEMPLATE_PATH)
      ? 'PLANTILLA ENCONTRADA ✓'
      : 'PLANTILLA NO ENCONTRADA ✗'
  )

  console.log(
    '=========================================='
  )
})