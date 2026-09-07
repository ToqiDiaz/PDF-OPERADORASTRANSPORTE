require('dotenv').config()

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

const {
  createClient,
} = require('@supabase/supabase-js')

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const app = express()

// Render asignará automáticamente PORT.
// Localmente seguirá usando 3001.
const PORT = process.env.PORT || 3001

/* =========================================================
   VARIABLES DE ENTORNO
========================================================= */

const SUPABASE_URL =
  process.env.SUPABASE_URL

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY

if (
  !SUPABASE_URL ||
  !SUPABASE_SECRET_KEY
) {
  console.error(
    'ERROR: faltan SUPABASE_URL o SUPABASE_SECRET_KEY.'
  )

  process.exit(1)
}

/* =========================================================
   CONEXIÓN SUPABASE
========================================================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

/* =========================================================
   CORS

   Por ahora permite:
   - React local
   - La URL pública que después pondremos en FRONTEND_URL
========================================================= */

const origenesPermitidos = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

if (process.env.FRONTEND_URL) {
  origenesPermitidos.push(
    process.env.FRONTEND_URL
  )
}

app.use(
  cors({
    origin: function (
      origin,
      callback
    ) {
      // Permite llamadas sin Origin
      // como Render Health Check.
      if (!origin) {
        return callback(
          null,
          true
        )
      }

      if (
        origenesPermitidos.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        )
      }

      console.warn(
        'Origen bloqueado por CORS:',
        origin
      )

      return callback(
        new Error(
          'Origen no permitido por CORS'
        )
      )
    },

    methods: [
      'GET',
      'POST',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
    ],

    exposedHeaders: [
      'Content-Disposition',
    ],
  })
)

/* =========================================================
   SEGURIDAD
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
)

app.use(
  express.json({
    limit: '30kb',
  })
)

const limiter = rateLimit({
  windowMs:
    60 * 1000,

  max: 20,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Demasiadas solicitudes. Intente nuevamente en unos minutos.',
  },
})

app.use(
  '/api',
  limiter
)

/* =========================================================
   PLANTILLA PDF

   Debe existir aquí:

   backend/
      plantillas/
         TESTplantilla_operadoras.pdf
========================================================= */

const TEMPLATE_PATH =
  path.join(
    __dirname,
    'plantillas',
    'TESTplantilla_operadoras.pdf'
  )

/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

function limpiarTexto(
  valor,
  maxLength = 200
) {
  if (
    typeof valor !==
    'string'
  ) {
    return ''
  }

  return valor
    .trim()
    .replace(
      /[<>]/g,
      ''
    )
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      maxLength
    )
}

/* =========================================================
   CONSECUTIVO
========================================================= */

function rellenarNumero(
  numero
) {
  return String(
    numero
  ).padStart(
    6,
    '0'
  )
}

/* =========================================================
   DIVIDIR TEXTO
========================================================= */

function dividirTexto({
  texto,
  fuente,
  fontSize,
  anchoMaximo,
}) {
  const palabras =
    texto.split(' ')

  const lineas = []

  let lineaActual = ''

  for (
    const palabra
    of palabras
  ) {
    const prueba =
      lineaActual
        ? `${lineaActual} ${palabra}`
        : palabra

    const ancho =
      fuente.widthOfTextAtSize(
        prueba,
        fontSize
      )

    if (
      ancho <=
      anchoMaximo
    ) {
      lineaActual =
        prueba
    } else {
      if (
        lineaActual
      ) {
        lineas.push(
          lineaActual
        )
      }

      lineaActual =
        palabra
    }
  }

  if (
    lineaActual
  ) {
    lineas.push(
      lineaActual
    )
  }

  return lineas
}

/* =========================================================
   TAMAÑO AUTOMÁTICO
========================================================= */

function calcularTamanoFuente({
  texto,
  fuente,
  anchoMaximo,
  maxFontSize = 11,
  minFontSize = 8,
}) {
  let size =
    maxFontSize

  while (
    size >
    minFontSize
  ) {
    const ancho =
      fuente.widthOfTextAtSize(
        texto,
        size
      )

    if (
      ancho <=
      anchoMaximo
    ) {
      return size
    }

    size -= 0.5
  }

  return minFontSize
}

/* =========================================================
   PÁRRAFOS
========================================================= */

function dibujarParrafo({
  page,
  texto,
  fuente,
  fontSize,
  x,
  y,
  anchoMaximo,
  lineHeight = 13,
  color = rgb(
    0.15,
    0.15,
    0.15
  ),
}) {
  const lineas =
    dividirTexto({
      texto,
      fuente,
      fontSize,
      anchoMaximo,
    })

  let posicionY = y

  for (
    const linea
    of lineas
  ) {
    page.drawText(
      linea,
      {
        x,
        y:
          posicionY,
        size:
          fontSize,
        font:
          fuente,
        color,
      }
    )

    posicionY -=
      lineHeight
  }

  return posicionY
}

/* =========================================================
   CAMPOS
========================================================= */

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
  page.drawText(
    etiqueta,
    {
      x,
      y,
      size: 9,
      font:
        fuenteBold,
      color: rgb(
        0.05,
        0.22,
        0.35
      ),
    }
  )

  let posicionY =
    y - 17

  const fontSize =
    calcularTamanoFuente({
      texto:
        valor,
      fuente:
        fuenteNormal,
      anchoMaximo:
        anchoTotal,
      maxFontSize:
        10.5,
      minFontSize:
        7.5,
    })

  const lineas =
    dividirTexto({
      texto:
        valor,
      fuente:
        fuenteNormal,
      fontSize,
      anchoMaximo:
        anchoTotal,
    })

  for (
    const linea
    of lineas
  ) {
    page.drawText(
      linea,
      {
        x,
        y:
          posicionY,
        size:
          fontSize,
        font:
          fuenteNormal,
        color: rgb(
          0.12,
          0.12,
          0.12
        ),
      }
    )

    posicionY -=
      fontSize + 3
  }

  return (
    posicionY - 12
  )
}

/* =========================================================
   RUTA PRINCIPAL
========================================================= */

app.get(
  '/',
  async (
    req,
    res
  ) => {
    const plantillaExiste =
      fs.existsSync(
        TEMPLATE_PATH
      )

    let supabaseOk =
      false

    try {
      const {
        error,
      } =
        await supabase
          .from(
            'solicitudes'
          )
          .select(
            'id'
          )
          .limit(
            1
          )

      supabaseOk =
        !error
    } catch (
      error
    ) {
      console.error(
        error
      )

      supabaseOk =
        false
    }

    res.send(`
      <!doctype html>

      <html lang="es">

      <head>

        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >

        <title>
          Sistema Operadoras
        </title>

      </head>

      <body
        style="
          font-family:Arial,sans-serif;
          background:#f4f6f8;
          padding:40px;
        "
      >

        <div
          style="
            max-width:700px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:12px;
            box-shadow:0 8px 25px rgba(0,0,0,.08);
          "
        >

          <h2
            style="
              color:#003B5C;
              margin-top:0;
            "
          >
            Sistema Operadoras de Transporte
          </h2>

          <p>
            Backend:
            <strong style="color:green;">
              FUNCIONANDO
            </strong>
          </p>

          <p>
            Plantilla institucional:
            <strong
              style="
                color:${
                  plantillaExiste
                    ? 'green'
                    : 'red'
                };
              "
            >
              ${
                plantillaExiste
                  ? 'ENCONTRADA'
                  : 'NO ENCONTRADA'
              }
            </strong>
          </p>

          <p>
            Supabase:
            <strong
              style="
                color:${
                  supabaseOk
                    ? 'green'
                    : 'red'
                };
              "
            >
              ${
                supabaseOk
                  ? 'CONECTADO'
                  : 'ERROR'
              }
            </strong>
          </p>

          <hr>

          <p>
            API:
          </p>

          <code>
            POST /api/generar-pdf
          </code>

        </div>

      </body>

      </html>
    `)
  }
)

/* =========================================================
   HEALTH CHECK PARA RENDER
========================================================= */

app.get(
  '/healthz',
  (
    req,
    res
  ) => {
    res
      .status(200)
      .json({
        status:
          'ok',

        servicio:
          'PDF Operadoras',

        fecha:
          new Date()
            .toISOString(),
      })
  }
)

/* =========================================================
   ESTADO API
========================================================= */

app.get(
  '/api/status',
  (
    req,
    res
  ) => {
    res.json({
      estado:
        'OK',

      plantilla:
        fs.existsSync(
          TEMPLATE_PATH
        )
          ? 'encontrada'
          : 'no encontrada',

      fecha:
        new Date()
          .toISOString(),
    })
  }
)

/* =========================================================
   GENERAR PDF
========================================================= */

app.post(
  '/api/generar-pdf',
  async (
    req,
    res
  ) => {
    try {

      /* ===================================================
         RECIBIR DATOS
      =================================================== */

      const compania =
        limpiarTexto(
          req.body.compania,
          200
        )

      const registroMunicipal =
        limpiarTexto(
          req.body.registro_municipal,
          100
        )

      const cedula =
        limpiarTexto(
          req.body.cedula,
          10
        )

      const nombres =
        limpiarTexto(
          req.body.nombres,
          150
        )

      const apellidos =
        limpiarTexto(
          req.body.apellidos,
          150
        )

      const licencia =
        limpiarTexto(
          req.body.licencia,
          2
        )

      const correo =
        limpiarTexto(
          req.body.correo,
          200
        )

      const telefono =
        limpiarTexto(
          req.body.telefono,
          30
        )

      /* ===================================================
         CAMPOS OBLIGATORIOS
      =================================================== */

      if (
        !compania ||
        !registroMunicipal ||
        !cedula ||
        !nombres ||
        !apellidos ||
        !licencia ||
        !correo ||
        !telefono
      ) {
        return res
          .status(400)
          .json({
            error:
              'Todos los campos son obligatorios.',
          })
      }

      /* ===================================================
         VALIDAR CÉDULA
      =================================================== */

      if (
        !/^\d{10}$/.test(
          cedula
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'La cédula debe contener exactamente 10 dígitos.',
          })
      }

      /* ===================================================
         VALIDAR LICENCIA
      =================================================== */

      if (
        ![
          'A',
          'B',
          'C',
          'D',
        ].includes(
          licencia
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Tipo de licencia no válido.',
          })
      }

      /* ===================================================
         VALIDAR CORREO
      =================================================== */

      const regexCorreo =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (
        !regexCorreo.test(
          correo
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Correo electrónico no válido.',
          })
      }

      /* ===================================================
         REGISTRAR EN SUPABASE
      =================================================== */

      const {
        data,
        error,
      } =
        await supabase
          .from(
            'solicitudes'
          )
          .insert([
            {
              compania,

              registro_municipal:
                registroMunicipal,

              cedula,

              nombres,

              apellidos,

              licencia,

              correo,

              telefono,
            },
          ])
          .select(
            'id'
          )
          .single()

      if (
        error
      ) {
        console.error(
          'Error Supabase:',
          error
        )

        return res
          .status(500)
          .json({
            error:
              'No fue posible registrar la solicitud.',
          })
      }

      const id =
        data.id

      const consecutivo =
        rellenarNumero(
          id
        )

      /* ===================================================
         PLANTILLA
      =================================================== */

      if (
        !fs.existsSync(
          TEMPLATE_PATH
        )
      ) {
        console.error(
          'Plantilla no encontrada:',
          TEMPLATE_PATH
        )

        return res
          .status(500)
          .json({
            error:
              'No se encontró la plantilla institucional.',
          })
      }

      const plantillaBytes =
        fs.readFileSync(
          TEMPLATE_PATH
        )

      const pdfDoc =
        await PDFDocument.load(
          plantillaBytes
        )

      const pages =
        pdfDoc.getPages()

      const page =
        pages[0]

      const {
        width,
        height,
      } =
        page.getSize()

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
         TÍTULO
      =================================================== */

      const titulo =
        'SOLICITUD DE REGISTRO DE OPERADORA DE TRANSPORTE'

      const tituloLineas =
        dividirTexto({
          texto:
            titulo,

          fuente:
            fuenteBold,

          fontSize:
            11.5,

          anchoMaximo:
            390,
        })

      let tituloY =
        height - 130

      for (
        const linea
        of tituloLineas
      ) {
        const ancho =
          fuenteBold
            .widthOfTextAtSize(
              linea,
              11.5
            )

        page.drawText(
          linea,
          {
            x:
              (
                width -
                ancho
              ) / 2,

            y:
              tituloY,

            size:
              11.5,

            font:
              fuenteBold,

            color:
              rgb(
                0.08,
                0.08,
                0.08
              ),
          }
        )

        tituloY -= 15
      }

      /* ===================================================
         CUERPO
      =================================================== */

      let currentY =
        tituloY - 26

      const margenIzquierdo =
        85

      const anchoContenido =
        width - 170

      const introduccion =
        'Por medio del presente, se registra la información correspondiente a la operadora de transporte y a la persona responsable que realiza la presente solicitud. La información consignada ha sido proporcionada mediante el formulario electrónico habilitado para el proceso correspondiente.'

      currentY =
        dibujarParrafo({
          page,

          texto:
            introduccion,

          fuente:
            fuenteNormal,

          fontSize:
            9.2,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoMaximo:
            anchoContenido,

          lineHeight:
            12.5,
        })

      currentY -= 18

      /* ===================================================
         DATOS OPERADORA
      =================================================== */

      page.drawText(
        '1. DATOS DE LA OPERADORA',
        {
          x:
            margenIzquierdo,

          y:
            currentY,

          size:
            10,

          font:
            fuenteBold,

          color:
            rgb(
              0.05,
              0.22,
              0.35
            ),
        }
      )

      currentY -= 23

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Nombre de la compañía',

          valor:
            compania,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Registro Municipal',

          valor:
            registroMunicipal,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      /* ===================================================
         DATOS SOLICITANTE
      =================================================== */

      page.drawText(
        '2. DATOS DEL SOLICITANTE',
        {
          x:
            margenIzquierdo,

          y:
            currentY,

          size:
            10,

          font:
            fuenteBold,

          color:
            rgb(
              0.05,
              0.22,
              0.35
            ),
        }
      )

      currentY -= 23

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Número de cédula',

          valor:
            cedula,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Nombres completos',

          valor:
            nombres,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Apellidos completos',

          valor:
            apellidos,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

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

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Correo electrónico',

          valor:
            correo,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      currentY =
        dibujarCampo({
          page,

          etiqueta:
            'Teléfono',

          valor:
            telefono,

          fuenteNormal,

          fuenteBold,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoTotal:
            anchoContenido,
        })

      /* ===================================================
         DECLARACIÓN
      =================================================== */

      currentY -= 2

      page.drawText(
        '3. DECLARACIÓN',
        {
          x:
            margenIzquierdo,

          y:
            currentY,

          size:
            10,

          font:
            fuenteBold,

          color:
            rgb(
              0.05,
              0.22,
              0.35
            ),
        }
      )

      currentY -= 22

      const declaracion =
        'Declaro que la información proporcionada en el presente documento es verdadera y corresponde a los datos registrados por el solicitante. Asimismo, autorizo su utilización para los fines administrativos y técnicos relacionados con el proceso correspondiente.'

      currentY =
        dibujarParrafo({
          page,

          texto:
            declaracion,

          fuente:
            fuenteNormal,

          fontSize:
            9,

          x:
            margenIzquierdo,

          y:
            currentY,

          anchoMaximo:
            anchoContenido,

          lineHeight:
            12,
        })

      /* ===================================================
         FIRMA
      =================================================== */

      currentY -= 45

      if (
        currentY < 125
      ) {
        currentY = 125
      }

      page.drawLine({
        start: {
          x:
            width / 2 -
            110,

          y:
            currentY,
        },

        end: {
          x:
            width / 2 +
            110,

          y:
            currentY,
        },

        thickness:
          0.7,

        color:
          rgb(
            0.35,
            0.35,
            0.35
          ),
      })

      const nombreFirma =
        `${nombres} ${apellidos}`

      const firmaSize =
        calcularTamanoFuente({
          texto:
            nombreFirma,

          fuente:
            fuenteNormal,

          anchoMaximo:
            220,

          maxFontSize:
            9,

          minFontSize:
            7,
        })

      const lineasFirma =
        dividirTexto({
          texto:
            nombreFirma,

          fuente:
            fuenteNormal,

          fontSize:
            firmaSize,

          anchoMaximo:
            220,
        })

      let firmaY =
        currentY - 15

      for (
        const linea
        of lineasFirma
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
              (
                width -
                ancho
              ) / 2,

            y:
              firmaY,

            size:
              firmaSize,

            font:
              fuenteNormal,

            color:
              rgb(
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
            (
              width -
              anchoEtiqueta
            ) / 2,

          y:
            firmaY - 2,

          size:
            8,

          font:
            fuenteNormal,

          color:
            rgb(
              0.35,
              0.35,
              0.35
            ),
        }
      )

      /* ===================================================
         METADATOS
      =================================================== */

      pdfDoc.setTitle(
        `Solicitud Operadora ${consecutivo}`
      )

      pdfDoc.setAuthor(
        'Secretaría de Movilidad'
      )

      pdfDoc.setSubject(
        'Solicitud de registro de operadora de transporte'
      )

      pdfDoc.setCreator(
        'Sistema Operadoras de Transporte'
      )

      /* ===================================================
         DESCARGA

         El PDF NO se guarda.
      =================================================== */

      const pdfBytes =
        await pdfDoc.save()

      const nombreArchivo =
        `SOLICITUD_OPERADORA_${consecutivo}.pdf`

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
        'Cache-Control',
        'no-store'
      )

      res.send(
        Buffer.from(
          pdfBytes
        )
      )

    } catch (
      error
    ) {
      console.error(
        'Error general:',
        error
      )

      if (
        !res.headersSent
      ) {
        res
          .status(500)
          .json({
            error:
              'No fue posible generar el documento.',
          })
      }
    }
  }
)

/* =========================================================
   ERROR CORS
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    if (
      err.message ===
      'Origen no permitido por CORS'
    ) {
      return res
        .status(403)
        .json({
          error:
            'Origen no autorizado.',
        })
    }

    next(err)
  }
)

/* =========================================================
   404
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    res
      .status(404)
      .json({
        error:
          'Ruta no encontrada.',
      })
  }
)

/* =========================================================
   INICIAR SERVIDOR

   Compatible con:
   - Windows local
   - Render
========================================================= */

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      '========================================'
    )

    console.log(
      'Sistema Operadoras de Transporte'
    )

    console.log(
      `Servidor iniciado en puerto ${PORT}`
    )

    console.log(
      fs.existsSync(
        TEMPLATE_PATH
      )
        ? 'Plantilla encontrada ✓'
        : 'Plantilla NO encontrada ✗'
    )

    console.log(
      SUPABASE_URL
        ? 'Supabase configurado ✓'
        : 'Supabase NO configurado ✗'
    )

    console.log(
      '========================================'
    )
  }
)