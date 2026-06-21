/** Sections 8–15 — ES */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Plazos de conservación",
    blocks: [
      {
        type: "p",
        text:
          "Por regla general, MedScoutX no conserva de forma permanente en el servidor historiales de chat, síntomas ni imágenes. Los contenidos relacionados con la salud se almacenan solo de forma local en su dispositivo (p. ej. LocalStorage) y pueden eliminarse en cualquier momento.",
      },
      {
        type: "ul",
        items: [
          "Datos de cuenta: correo electrónico, hash de contraseña e idioma se conservan mientras exista la cuenta. Tras eliminar la cuenta, estos datos se borran o anonimizan, salvo obligaciones legales de conservación.",
          "Datos de chat y síntomas: no se almacenan en el servidor; permanecen solo en su dispositivo y se eliminan por completo cuando usa «Nueva conversación» o «Borrar historial».",
          "Subidas de imágenes: se procesan brevemente para enviarlas al servicio de IA y luego se descartan; no hay almacenamiento permanente.",
          "Registros técnicos / registros del servidor: para operación, seguridad y análisis de errores, los servicios de alojamiento suelen guardar registros técnicos (marca de tiempo, IP truncada, detalles del error) durante unos 14–30 días. Estos datos no se vinculan a su perfil ni se usan con fines publicitarios.",
          "Datos locales (LocalStorage, almacenamiento de la app): historiales, ajustes (idioma, accesibilidad) permanecen en el dispositivo y pueden eliminarse mediante «Borrar historial» o la configuración del dispositivo.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Seguridad",
    blocks: [
      {
        type: "p",
        text:
          "Aplicamos medidas técnicas y organizativas adecuadas para proteger sus datos frente a pérdida, alteración, acceso no autorizado u otros usos indebidos, en particular:",
      },
      {
        type: "p",
        text:
          "El tratamiento de sus datos de salud solo tiene lugar tras su consentimiento explícito en el primer uso de las funciones correspondientes (chat de síntomas, mapa corporal, análisis de imágenes) mediante casilla de verificación y confirmación. Puede retirar este consentimiento en cualquier momento en los ajustes de la aplicación.",
      },
      {
        type: "ul",
        items: [
          "cifrado del transporte (TLS/HTTPS),",
          "restricciones de acceso y sistemas de roles/permisos,",
          "minimización de datos y pseudonimización cuando es posible,",
          "actualizaciones periódicas de los sistemas.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Niños y adolescentes",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX no está dirigida a menores de 16 años. Los menores deberían usar la aplicación solo con el consentimiento de quien ejerce la patria potestad. Si tenemos conocimiento de que se han tratado datos de un menor de 16 años sin ese consentimiento, los eliminaremos.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Sus derechos (derechos del interesado)",
    blocks: [
      {
        type: "p",
        text:
          "En el marco del RGPD, usted dispone en particular de los siguientes derechos:",
      },
      {
        type: "ul",
        items: [
          "Acceso (art. 15 RGPD): información sobre qué datos personales tratamos sobre usted.",
          "Rectificación (art. 16 RGPD): corrección de datos inexactos o completar datos incompletos.",
          "Supresión (art. 17 RGPD): solicitar el borrado, salvo obligaciones legales de conservación.",
          "Limitación (art. 18 RGPD): solicitar la limitación del tratamiento.",
          "Portabilidad (art. 20 RGPD): recibir sus datos en un formato estructurado y de uso común.",
          "Oposición (art. 21 RGPD): oponerse al tratamiento basado en interés legítimo, atendiendo a su situación particular.",
          "Retirada del consentimiento (art. 7, apartado 3 RGPD): retirar en cualquier momento un consentimiento prestado, con efectos para el futuro.",
          "Reclamación (art. 77 RGPD): presentar una reclamación ante una autoridad de control competente.",
        ],
      },
      {
        type: "p",
        text:
          "Para ejercer sus derechos, puede contactarnos en los datos de contacto indicados arriba.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies y LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX no utiliza cookies de seguimiento con fines publicitarios. Para funciones de comodidad puede utilizarse almacenamiento local en su dispositivo, por ejemplo:",
      },
      {
        type: "ul",
        items: [
          "guardar su idioma,",
          "almacenamiento opcional del historial de chat,",
          "opciones de accesibilidad (p. ej. tamaño de fuente).",
        ],
      },
      {
        type: "p",
        text:
          "Puede eliminar estos datos mediante las funciones de la aplicación o la configuración del dispositivo o del navegador.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Permisos de la aplicación",
    blocks: [
      {
        type: "p",
        text:
          "Según el uso, MedScoutX puede solicitar los siguientes permisos en su dispositivo:",
      },
      {
        type: "ul",
        items: [
          "Cámara / archivos: para tomar o seleccionar imágenes para el análisis. Es opcional y puede revocarse en los ajustes del sistema.",
          "Almacenamiento: para procesar archivos de imagen o datos temporales.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX no accede a sus contenidos sin su acción y no envía datos en segundo plano a terceros que no sean necesarios para el funcionamiento de la aplicación.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Indicaciones sobre el tratamiento mediante IA",
    blocks: [
      {
        type: "ul",
        items: [
          "Sus textos y, en su caso, imágenes se procesan de forma automatizada para generar indicaciones y sugerencias.",
          "La IA puede equivocarse o interpretar mal una situación. Revise los resultados de forma crítica y úselos solo como orientación.",
          "No envíe nombres ni datos identificativos de terceros; evite datos personales innecesarios.",
          "El uso de la aplicación no sustituye la orientación médica personal, el diagnóstico o el tratamiento por profesionales sanitarios.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Sin decisiones automatizadas en el sentido del art. 22 RGPD",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX no establece diagnósticos ni adopta decisiones automatizadas que produzcan efectos jurídicos o similares significativos. Los contenidos generados por IA sirven únicamente para la preparación estructurada y la documentación de su información y no sustituyen el asesoramiento médico. En situaciones médicamente relevantes se le pedirá que consulte a un profesional sanitario.",
      },
    ],
  },
];
