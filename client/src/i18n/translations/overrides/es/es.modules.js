/** Spanish — symptom check, image, body map, settings privacy, doctor contacts */
export default {
  settingsPrivacy: {
    heading: "Exportación y eliminación de datos",
    intro:
      "Exporte o elimine desde su cuenta los datos MedScoutX relacionados con Pre-Visit.",
    exportTitle: "Exportación",
    exportHelp:
      "Descarga un archivo JSON estructurado: perfil, contactos, perfiles de centro (sin secretos), preparativos, cronologías, seguimientos y metadatos de auditoría.",
    exportButton: "Exportar mis datos",
    exporting: "Preparando exportación…",
    exportDone: "Descarga iniciada.",
    exportError: "No se pudo completar la exportación. Inténtelo más tarde.",
    dangerTitle: "Eliminar datos MedScoutX almacenados",
    dangerHelp:
      "Elimina preparativos Pre-Visit, cronologías, contactos, perfiles de centro de su propiedad (incl. destinos QR), membresías y seguimiento asociado. El inicio de sesión sigue activo.",
    dangerPhraseLabel: "Escriba exactamente la frase de confirmación:",
    dangerPhraseHint: "Frase de confirmación:",
    dangerPlaceholder: "DELETE_MY_MEDSCOUTX_DATA",
    deleteButton: "Eliminar mis datos almacenados",
    deleting: "Eliminando…",
    deleteConfirmError: "La frase de confirmación no coincide.",
    deleteSuccess:
      "Se han eliminado los datos Pre-Visit de MedScoutX. Su cuenta sigue activa.",
    deleteError: "No se pudo completar la eliminación. Inténtelo más tarde.",
    backStart: "Volver al inicio",
    legalLinksTitle: "Documentación legal y herramientas de cuenta",
    legalLinksIntro:
      "Privacidad, condiciones y enlaces para exportar o eliminar datos en MedScoutX.",
    linkPrivacy: "Política de privacidad",
    linkImprint: "Aviso legal",
    linkTerms: "Términos y condiciones",
    linkAccountPrivacyHub: "Privacidad en la cuenta y eliminación Pre-Visit",
  },
  settingsDoctorContacts: {
    pageTitle: "MedScoutX — Contactos clínicos",
    heading: "Contactos clínicos",
    intro:
      "Gestione los contactos para compartir su preparación antes de la consulta. Solo usted puede ver estas entradas.",
    backHome: "Volver al inicio",
    backPatientHub: "Volver al espacio del paciente",
    retryLoad: "Reintentar",
    addContact: "Añadir contacto",
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    deleteConfirm:
      "¿Eliminar este contacto de forma permanente? Las selecciones locales en una preparación abierta se mantienen hasta que las cambie.",
    empty: "Sin contactos. Añada, por ejemplo, su centro o facultativo.",
    loadingContacts: "Cargando…",
    loadError: "No se han podido cargar los contactos.",
    saveError: "No se ha podido guardar el contacto.",
    saveErrorName: "Introduzca un nombre válido.",
    saveErrorEmail: "Introduzca una dirección de correo válida.",
    deleteError: "No se ha podido eliminar el contacto.",
    fieldDoctorName: "Nombre del profesional",
    fieldPracticeName: "Centro / clínica",
    fieldSpecialty: "Especialidad",
    fieldEmail: "Correo electrónico",
    fieldPhone: "Teléfono (opcional)",
    fieldAddress: "Dirección (opcional)",
    fieldNote: "Nota (opcional)",
    requiredHint: "Los campos obligatorios están indicados.",
    cardAria: "Contacto clínico",
    linkEmail: "Enviar correo",
    linkPhone: "Llamar",
    linkAddress: "Cómo llegar",
  },
  symptomCheck: {
    pageTitle: "Revisión guiada de síntomas — MedScoutX",
    heading: "Revisión guiada de síntomas",
    subtitle:
      "Ordene síntomas y contexto antes de una consulta médica, con orientación general. No proporciona diagnóstico ni recomendaciones terapéuticas.",
    chipPrimary: "Revisión guiada",
    chipSecondary: "Preparación de la consulta",
    storeSafetyNotice:
      "MedScoutX no proporciona diagnóstico médico, no sustituye el asesoramiento clínico y no es un servicio de urgencias. Ante síntomas agudos o gravemente preocupantes, contacte de inmediato con emergencias o con un profesional sanitario.",
    consentTitle: "Antes de continuar",
    consentCheckbox:
      "Entiendo que esta función no es para urgencias, no ofrece diagnóstico ni recomendaciones de tratamiento y no evalúa la gravedad. El texto del chat puede guardarse en este dispositivo hasta que lo borre; al enviar un mensaje, el texto se procesa en servidores MedScoutX y proveedores de IA según la Política de privacidad. La voz solo se envía cuando pulso grabar.",
    consentContinue: "Continuar",
    consentPrivacyLink: "Política de privacidad",
    hintsTitle: "Consejos para describir lo que nota",
    hintsIntro:
      "Detalles breves y concretos le ayudan a preparar su propio resumen para la consulta médica.",
    hintDuration: "¿Desde cuándo lo nota?",
    hintLocation: "¿En qué zona lo percibe?",
    hintSeverity:
      "¿Qué intensidad tiene para usted (por ejemplo de 1 a 10)?",
    hintAssociated:
      "¿Desea añadir sueño, actividad, fiebre u otros datos?",
    newChat: "Nueva conversación",
    newChatAria: "Iniciar una conversación nueva",
    clearHistory: "Borrar historial",
    clearHistoryAria: "Borrar el historial guardado en este dispositivo",
    chatTitle: "Conversación",
    chatIntro:
      "Preguntas neutras y, si procede, un resumen estructurado para sus notas — no es una valoración clínica.",
    placeholderEmpty: "Aún no hay mensajes. Por ejemplo podría empezar con:",
    placeholderExample:
      "«Desde ayer dolor agudo en la zona lumbar al inclinarme.»",
    thinking: "Preparando respuesta…",
    analyzingAvoided: "Preparando respuesta…",
    inputLabel: "Su descripción con sus propias palabras",
    inputPlaceholder:
      "Describa lo que nota — lugar, duración, intensidad, desencadenantes, etc.",
    maxCharsLabel: "Máx. {{max}} caracteres",
    sendAria: "Enviar mensaje",
    offlineError:
      "Sin conexión. La revisión guiada de síntomas requiere red.",
    offlineBadge: "Sin conexión",
    serverError: "Algo salió mal. Inténtelo más tarde.",
    copyConversation: "Copiar conversación",
    downloadTxt: "Descargar como texto",
    copyDone: "Copiado al portapapeles.",
    copyFail: "No se pudo copiar — seleccione el texto manualmente.",
    speakAria: "Leer respuesta en voz alta",
    micNotice:
      "Micrófono: la grabación solo comienza al pulsar y termina al pulsar detener.",
    voiceStart: "Iniciar entrada de voz",
    voiceStop: "Detener entrada de voz",
    voiceMicError: "Micrófono no disponible.",
    voiceTxError: "No se pudo transcribir.",
    statusReady: "Listo",
    assistantLabel: "Asistente",
    userLabel: "Usted",
    accountDataHint:
      "Exportación y eliminación de datos guardados (cuando esté disponible):",
    accountDataLink: "Privacidad y datos",
  },
  imageAnalysis: {
    pageTitle: "Descripción estructurada de imágenes — MedScoutX",
    heading: "Descripción estructurada de imágenes",
    subtitle:
      "Organice lo visible en una imagen para preparar la consulta médica. No es diagnóstico ni valoración clínica.",
    chipPrimary: "Imagen aportada por el paciente",
    chipSecondary: "Preparación de la consulta",
    storeDisclaimer:
      "MedScoutX no ofrece diagnóstico a partir de imágenes ni sustituye la exploración clínica. Solo ayuda a ordenar imágenes que usted aporta de cara al encuentro médico.",
    emergencyNote:
      "Ante síntomas agudos o situaciones potencialmente graves, contacte de inmediato con emergencias o un profesional sanitario.",
    storageNote:
      "La vista previa permanece en este dispositivo durante la sesión. El chat puede guardarse localmente hasta que lo borre. La imagen no se conserva de forma permanente salvo que usted lo decida explícitamente.",
    consentTitle: "Antes de subir la imagen",
    consentCheckbox:
      "Confirmo que la imagen puede tratarse para generar una descripción estructurada (incluido el envío a servidores MedScoutX y proveedores de IA, según la Política de privacidad).",
    consentContinue: "Continuar",
    consentPrivacyLink: "Política de privacidad",
    panelUploadTitle: "Elegir imagen",
    panelUploadIntro:
      "Galería, cámara puntual o webcam solo tras pulsar. Nada se envía hasta que envíe un mensaje.",
    uploadGallery: "Elegir de la galería",
    uploadCamera: "Hacer o elegir foto",
    uploadWebcam: "Usar webcam",
    webcamExplainer:
      "La cámara solo se activa tras pulsar; no hay grabación en segundo plano.",
    removeImage: "Quitar imagen",
    removeImageAria: "Quitar la imagen seleccionada de la vista previa",
    previewAlt: "Imagen seleccionada para descripción estructurada",
    previewCaption: "Vista previa — no es valoración médica",
    previewEmpty: "Aún no hay imagen seleccionada",
    processingNote:
      "Las descripciones se basan en la imagen y en lo que usted indica — no constituyen diagnóstico.",
    newChat: "Restablecer todo",
    newChatAria: "Borrar imagen, chat e hilo local en este dispositivo",
    clearHistory: "Borrar solo el chat",
    clearHistoryAria: "Borrar texto guardado solo en este dispositivo",
    chatTitle: "Conversación",
    chatIntro:
      "Añada contexto en tono neutro. Las respuestas son apuntes para la consulta, sin interpretación clínica autónoma.",
    placeholderEmpty:
      "Sin mensajes. Tras seleccionar imagen quizá pueda escribir:",
    placeholderExample: "«Describa con palabras simples lo que cambia o se ve.»",
    loadingText: "Creando descripción estructurada…",
    questionLabel: "Pregunta o contexto",
    questionPlaceholder:
      "Añada contexto o pida una descripción neutra y estructurada…",
    maxCharsLabel: "Máx. {{max}} caracteres",
    sendAria: "Enviar para generar descripción estructurada",
    inputDisabledHint:
      "Seleccione imagen y confirme consentimiento antes de enviar.",
    needImageWarning: "Seleccione una imagen antes de enviar.",
    webcamTitle: "Foto con webcam",
    webcamIntro:
      "Encadre el motivo y capture. La transmisión se detiene al capturar o cancelar.",
    webcamCapture: "Capturar foto",
    webcamCancel: "Cancelar",
    cameraDenied: "Acceso denegado a la cámara o no disponible.",
    offlineError: "Sin conexión. Este paso requiere red.",
    serverError: "Algo salió mal. Inténtelo más tarde.",
    speakAria: "Leer respuesta en voz alta",
    statusReady: "Listo",
    offlineBadge: "Sin conexión",
    micNotice:
      "El audio solo se envía cuando graba voluntariamente; no se almacena automáticamente.",
    voiceStart: "Iniciar entrada de voz",
    voiceStop: "Detener entrada de voz",
    voiceMicError: "Micrófono no disponible.",
    voiceTxError: "No se pudo transcribir.",
    accountDataHint:
      "Exportación y borrado de datos de cuenta (si se ofrecen):",
    accountDataLink: "Privacidad y datos",
    userLabel: "Usted",
    assistantLabel: "Nota estructurada",
  },
  bodyMap: {
    start: {
      pageTitle: "Mapa corporal — MedScoutX",
      title: "Mapa corporal",
      subtitle:
        "Marque regiones y prepare observaciones ante la consulta médica. No es diagnóstico ni exploración médica.",
      chip1: "Localización",
      chip2: "Preparación de la consulta",
      storeDisclaimer:
        "El mapa corporal solo sirve para marcar zonas visualmente y preparar información para una consulta médica. No se derivan valoraciones médicas automáticas de las marcas.",
      emergencyNote:
        "Si hay síntomas agudos graves, contacte de inmediato con emergencias o un profesional sanitario.",
      consentTitle: "Antes de usar el mapa corporal",
      consentCheckbox:
        "Entiendo que el mapa no diagnostica ni valora urgencias; el chat puede guardarse en este dispositivo hasta borrarlo; al enviar mensajes el texto circula por servidores MedScoutX e IA como indica la Política de privacidad.",
      consentContinue: "Continuar",
      consentPrivacyLink: "Política de privacidad",
      panelTitle: "Elija vista",
      hint:
        "Cambie entre frente y espalda. Estos controles pueden usarse con teclado y lectores de pantalla.",
      open: "Abrir selector de vista",
      close: "Cerrar selector de vista",
      frontAria: "Abrir mapa — frente",
      frontTitle: "Frente",
      frontText: "Tórax, abdomen, cara, cara anterior de brazos y piernas.",
      backAria: "Abrir mapa — espalda",
      backTitle: "Espalda",
      backText: "Espalda, nuca, hombros, cara posterior de brazos y piernas.",
      footer:
        "Puede cambiar de vista más tarde. El chat de una zona se guarda en este dispositivo hasta borrarlo.",
    },
    mapFront: {
      pageTitle: "Mapa corporal — frente — MedScoutX",
      heading: "Mapa corporal — frente",
      inlineDisclaimer:
        "Pulse una zona para continuar con notas neutras — no es exploración médica.",
      backToHub: "Volver al inicio del mapa",
      backToHubAria: "Volver a la introducción del mapa corporal",
      diagramAria: "Diagrama corporal frontal; pulse una región.",
    },
    mapBack: {
      pageTitle: "Mapa corporal — espalda — MedScoutX",
      heading: "Mapa corporal — espalda",
      inlineDisclaimer:
        "Pulse una región para tomar notas neutras — no es exploración médica.",
      backToHub: "Volver al inicio del mapa",
      backToHubAria: "Volver a la introducción del mapa corporal",
      diagramAria: "Diagrama corporal de espalda; pulse una región.",
    },
    chat: {
      pageTitle: "Notas de región corporal — MedScoutX",
      title: "Notas para la región seleccionada",
      subtitle:
        "Describa con sus palabras lo que percibe; recibirá preguntas neutras para ordenar sus notas — sin juicio clínico automático.",
      chip1: "Mapa corporal",
      chip2: "Localización",
      sectionChat: "Conversación",
      chatHeading: "Describir en esta zona",
      chatIntro:
        "Comparte sensaciones u observaciones que elija registrar. Esto no reemplaza el examen de un facultativo.",
      placeholderEmpty:
        "Primero elija una región en el mapa; después describa por ejemplo:",
      placeholderExample:
        "«Varios días tensión en hombro derecho al levantar el brazo.»",
      loadingLine: "Preparando respuesta…",
      serverError: "Algo salió mal. Inténtelo más tarde.",
      httpError: "La solicitud falló. Inténtelo más tarde.",
      inputLabel: "Su descripción en esta región",
      inputPlaceholder:
        "Calidad de la sensación, duración, desencadenantes, con sus palabras…",
      maxCharsLabel: "Máx. {{max}} caracteres",
      sendAria: "Enviar mensaje",
      organHintIntro: "Mantenga el relato unido a la zona marcada.",
      organHintExample: "Ejemplo: «En mi {{region}}…»",
      organHintOutro:
        "Para temas que no dependan de esta región, use mejor la revisión guiada general de síntomas.",
      btnNewChat: "Reiniciar flujo del mapa",
      btnNewChatTitle: "Borrar chat y volver al inicio del mapa",
      btnClearHistory: "Borrar solo chat",
      btnClearHistoryTitle: "Borrar mensajes locales de este chat",
      speakAria: "Leer en voz alta",
      micNotice:
        "Solo hay grabación de voz tras pulsar el micrófono — no hay escucha permanente.",
      voiceStart: "Iniciar entrada de voz",
      voiceStop: "Detener entrada de voz",
      voiceMicError: "Micrófono no disponible.",
      voiceTxError: "No se pudo transcribir.",
      introAssistant:
        'Marcó "{{region}}" en el mapa. Describa con sus palabras lo que percibe ahí.',
      userLabel: "Usted",
      assistantLabel: "Asistente",
      offlineError: "Sin conexión. Esta etapa requiere red.",
      accountDataHint: "Privacidad, exportación y borrado:",
      accountDataLink: "Privacidad y datos",
    },
  },
};
