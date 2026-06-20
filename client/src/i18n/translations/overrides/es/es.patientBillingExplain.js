// Patient-facing "Entender su factura" (GOÄ/PKV) — Spanish override.
// Non-binding guidance only. No legal advice, no final invoice review, no medical assessment.
export const esPatientBillingExplain = {
  title: "Entender su factura",
  subtitle: "Factura privada (GOÄ/PKV) explicada de forma clara – orientación sin compromiso",
  shortDescription:
    "Esta función le ayuda a comprender mejor una factura médica privada (GOÄ/PKV). Usted introduce los datos de su factura y nosotros explicamos las partidas incluidas en un lenguaje claro, señalando posibles preguntas. Se trata de una orientación sin compromiso, no de una comprobación de su factura.",

  disclaimerBanner:
    "Orientación sin compromiso. Esta función explica sus datos de forma clara e indica posibles preguntas. No constituye asesoramiento jurídico, ni una comprobación definitiva de la factura, ni información médica. En caso de duda, póngase en contacto con su consulta, su seguro médico privado o un asesoramiento cualificado.",
  privacyNote:
    "Sus datos no se guardan de forma permanente y se procesan únicamente para la explicación actual. Por favor, no introduzca nombres, fechas de nacimiento ni diagnósticos – bastan los datos de facturación (código, factor, cantidad, importe) o el simple texto de la factura.",
  resultNote:
    "La siguiente explicación se refiere únicamente a los datos que ha introducido. Es una orientación sin compromiso y no una valoración de si su factura es correcta o completa. Puede plantear los puntos pendientes de forma cortés a su consulta o a su seguro médico privado con las plantillas siguientes.",
  footerNote:
    "Orientación sin compromiso – no es asesoramiento jurídico ni una comprobación definitiva de la factura. En caso de duda, póngase en contacto con su consulta, su seguro médico privado o un asesoramiento cualificado.",

  inputModeFields: "Rellenar campos",
  inputModeText: "Pegar texto de la factura",

  fieldZiffer: "Código GOÄ",
  fieldZifferPlaceholder: "p. ej. 1, 3, 250",
  fieldFactor: "Factor de incremento",
  fieldFactorPlaceholder: "p. ej. 2,3",
  fieldCount: "Cantidad",
  fieldCountPlaceholder: "p. ej. 1",
  fieldAmount: "Importe (opcional)",
  fieldAmountPlaceholder: "p. ej. 21,45 €",
  fieldNote: "Su nota (opcional)",
  fieldNotePlaceholder: "p. ej. una indicación de la factura",
  pasteInvoiceLabel: "Pegar texto de la factura",
  pasteInvoicePlaceholder:
    "Pegue aquí las partidas de la factura – sin nombres, fechas de nacimiento ni diagnósticos",

  btnExplain: "Explicar los datos",
  btnAddRow: "Añadir otra partida",
  btnReset: "Restablecer los datos",
  btnDraftPractice: "Crear pregunta para la consulta",
  btnDraftInsurer: "Crear pregunta para el seguro",
  btnCopy: "Copiar texto",
  btnCopied: "Copiado",

  resultHeading: "Explicación de sus datos",
  catalogUnknownLabel: "No está en el resumen",
  result_noFindings:
    "Según los datos que ha introducido, no se han detectado puntos evidentes para preguntar. Es una orientación sin compromiso y no una confirmación de que la factura sea correcta o completa. Si tiene preguntas, su consulta o su seguro médico privado estarán encantados de ayudarle.",

  warn_unknown_goae_ziffer:
    "Este código no figura en nuestro resumen de referencia. Esto no significa que sea incorrecto – simplemente no puede explicarse aquí de forma automática. Puede consultarlo con su consulta o comprobarlo con el texto oficial de la GOÄ.",
  warn_invalid_factor:
    "No se ha podido leer el factor de esta partida. Por favor, revise la entrada (un número, p. ej. 2,3).",
  warn_invalid_count:
    "No se ha podido leer la cantidad de esta partida. Por favor, revise la entrada (un número entero a partir de 1).",
  warn_factor_requires_justification:
    "El factor indicado supera el máximo habitual (2,3). Un factor más alto es posible y suele ir acompañado de una breve justificación. Es un posible punto para preguntar – sin pronunciarse sobre su exactitud.",
  warn_justification_missing:
    "En sus datos no consta ninguna justificación de este factor más alto. Puede preguntar cortésmente la justificación a su consulta.",

  error_empty: "Por favor, introduzca al menos una partida o un texto de factura.",
  error_tooLong: "El texto introducido es demasiado largo. Por favor, redúzcalo a las partidas de facturación.",
  error_tooManyRows: "Ha introducido demasiadas partidas. Por favor, reduzca la cantidad.",
  error_rateLimited: "Demasiadas solicitudes en poco tiempo. Por favor, inténtelo de nuevo en unos minutos.",
  error_personalData:
    "Por favor, elimine los datos personales como nombres, fechas de nacimiento o diagnósticos. Bastan los datos de facturación.",
  error_generic: "No ha funcionado en este momento. Por favor, inténtelo de nuevo.",

  draftPractice_subject: "Consulta sobre mi factura [número de factura], [fecha de factura]",
  draftPractice_body:
    "Estimado equipo de la consulta:\n\nGracias por su factura. Me gustaría entenderla algo mejor y tengo una breve consulta:\n\n- Agradecería una breve explicación de la(s) partida(s) [código(s)].\n- En [código] figura un factor de [factor]; ¿podrían indicarme brevemente la justificación correspondiente?\n\nMi único objetivo es comprenderla mejor. Muchas gracias por su ayuda.\n\nAtentamente,\n[Nombre]",
  draftInsurer_subject: "Pregunta sobre el reembolso – factura [número de factura], [fecha de factura]",
  draftInsurer_body:
    "Estimados señores:\n\nEn relación con la factura médica adjunta, tengo una pregunta sobre el reembolso:\n\n- ¿Pueden confirmarme si la(s) partida(s) [código(s)] son reembolsables según mi póliza?\n- Si falta alguna información para la tramitación, les ruego me lo comuniquen.\n\nMuchas gracias por su atención.\n\nAtentamente,\n[Nombre], número de asegurado: [número]",

  entryCardTitle: "Entender su factura",
  entryCardSubtitle: "Factura privada (GOÄ/PKV) explicada de forma clara – orientación sin compromiso",
  backToDocuments: "Volver a los documentos de la consulta",
};
