/** Sections 1–7 — ES */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Responsable del tratamiento",
    blocks: [
      {
        type: "p",
        text:
          "Esta política de privacidad explica cómo la aplicación MedScoutX trata los datos personales.",
      },
      {
        type: "address",
        lineStrong: "Responsable del tratamiento en el sentido del RGPD",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Alemania",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "Correo electrónico", dd: "contact@medscoutx.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Teléfono", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. ¿De qué se trata?",
    blocks: [
      {
        type: "p",
        text:
          "Este documento describe cómo MedScoutX trata sus datos personales cuando usted:",
      },
      {
        type: "ul",
        items: [
          "instala la aplicación y crea una cuenta,",
          "introduce de forma estructurada información para una consulta médica y, opcionalmente, la prepara como PDF,",
          "introduce síntomas mediante el chat de texto,",
          "selecciona regiones corporales en el mapa corporal,",
          "sube imágenes (p. ej. fotos de la piel o imágenes médicas).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX no es una herramienta de diagnóstico o tratamiento y no sustituye el examen médico ni la orientación profesional. La aplicación ayuda a preparar y documentar de forma estructurada su propia información antes de citas médicas. Si genera un PDF solo de forma local sin transmisión, se aplican las indicaciones especiales descritas en ese contexto.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Categorías de datos personales",
    blocks: [
      {
        type: "p",
        text:
          "Según el uso de la aplicación, pueden tratarse las siguientes categorías de datos personales:",
      },
      {
        type: "ul",
        items: [
          "Datos de cuenta: dirección de correo, posiblemente nombre o identificador, hash de contraseña (no en texto claro), idioma.",
          "Datos relacionados con la salud: entradas de texto sobre síntomas, respuestas en el chat de síntomas, selección de regiones corporales en el mapa, información sanitaria en campos de texto libre.",
          "Datos de imagen: imágenes que usted sube (p. ej. cambios en la piel, fotos de zonas corporales u otras zonas relevantes para la salud). MedScoutX utiliza estas imágenes para describir hallazgos visibles relevantes, pero no para un diagnóstico médico autónomo.",
          "Datos de uso y registros: marcas de tiempo de solicitudes, registros técnicos de errores, posiblemente dirección IP truncada, información del navegador/dispositivo, sistema operativo, versión de la aplicación.",
          "Datos de suscripción y contractuales (si utiliza un abono de pago): plan contratado, duración, estado, información técnica de compra (vía App Store / Play Store). Los datos de pago completos (p. ej. números de tarjeta) no los almacena MedScoutX, sino que los trata el proveedor de pagos de la plataforma.",
          "Datos locales en su dispositivo: p. ej. historial de chat almacenado localmente o ajustes (idioma, accesibilidad) en LocalStorage o mecanismos comparables.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Finalidades del tratamiento",
    blocks: [
      {
        type: "ul",
        items: [
          "Prestación de funciones de la aplicación: inicio de sesión, registro, gestión de cuenta y funciones principales de MedScoutX.",
          "Chat de síntomas y preguntas de seguimiento asistidas por IA: tratamiento de sus entradas de texto para ofrecer preguntas e indicaciones útiles para una mayor aclaración.",
          "Mapa corporal: asignación de las regiones seleccionadas a preguntas e indicaciones de IA adecuadas.",
          "Análisis de imágenes: tratamiento de las imágenes subidas para describir hallazgos visibles relevantes y sugerir posibles pasos (p. ej. aclaración médica). No se realiza un diagnóstico automático en sentido médico-jurídico.",
          "Estabilidad y seguridad: análisis de errores, detección de abusos, protección de sistemas y datos.",
          "Requisitos legales: cumplimiento de obligaciones legales (p. ej. documentación de medidas de seguridad informática, plazos de conservación).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Bases jurídicas (RGPD)",
    blocks: [
      {
        type: "p",
        text:
          "Según el caso, nos basamos en las siguientes bases jurídicas:",
      },
      {
        type: "ul",
        items: [
          "Art. 6, apartado 1, letra b) RGPD — ejecución del contrato: para prestar funciones técnicas como registro, inicio de sesión y gestión de la cuenta.",
          "Art. 6, apartado 1, letra f) RGPD — interés legítimo: seguridad de los sistemas informáticos, análisis de errores y detección de abusos.",
          "Art. 6, apartado 1, letra c) RGPD — obligación legal: cuando existan obligaciones legales de conservación (p. ej. obligaciones fiscales relacionadas con suscripciones).",
          "Art. 9, apartado 2, letra a) RGPD — consentimiento explícito: base principal para el tratamiento de datos de salud, incluidos síntomas introducidos voluntariamente, selección en el mapa corporal y subida/análisis de imágenes. Antes del primer uso se solicita consentimiento explícito (casilla y confirmación). Puede retirar el consentimiento en cualquier momento con efectos para el futuro.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Encargados del tratamiento y comunicación a terceros",
    blocks: [
      {
        type: "p",
        text:
          "Para determinadas funciones, MedScoutX recurre a proveedores como encargados del tratamiento en el sentido del art. 28 RGPD. Las principales categorías son:",
      },
      {
        type: "ul",
        items: [
          "Proveedores de alojamiento (UE): un proveedor cloud europeo suministra infraestructura para servidores y bases de datos (p. ej. Render.com con ubicación en la UE).",
          "Proveedor de IA — OpenAI (EE. UU.): para el tratamiento por IA de sus textos, datos de imagen e información del mapa corporal, MedScoutX utiliza servicios de OpenAI LLC (San Francisco, EE. UU.). Los contenidos se transmiten cifrados, se procesan y se eliminan tras el tratamiento.",
          "Proveedores de correo electrónico: un proveedor técnico envía correos del sistema (p. ej. verificación).",
        ],
      },
      {
        type: "p",
        text:
          "Todos los encargados están vinculados contractualmente conforme al art. 28 RGPD y tratan los datos solo siguiendo nuestras instrucciones. No hay comunicación de sus datos con fines publicitarios o de marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Transferencias a terceros países",
    blocks: [
      {
        type: "p",
        text:
          "Al utilizar las funciones de IA de MedScoutX, los contenidos (textos, síntomas, datos de imagen, etc.) se transfieren al proveedor de IA OpenAI LLC en EE. UU. Esta transferencia constituye una transferencia a un tercer país en el sentido del RGPD.",
      },
      {
        type: "p",
        text:
          "Para garantizar un nivel de protección adecuado, la transferencia se basa en las cláusulas contractuales tipo de la UE (art. 46 RGPD) y en medidas técnicas y organizativas adicionales (cifrado en tránsito, tratamiento breve, supresión tras la respuesta del servicio de IA).",
      },
      {
        type: "p_link",
        before: "Puede encontrar más información en la documentación de privacidad de OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
