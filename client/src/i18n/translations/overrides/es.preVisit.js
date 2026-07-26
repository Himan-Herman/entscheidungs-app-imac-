export default {
  language: {
    pageTitle: "MedScoutX — Preparación para la consulta",
    eyebrow: "Pre-consulta",
    title: "Preparación para la consulta médica",
    explanation:
      "Esta herramienta le ayuda a estructurar sus inquietudes y preguntas para una consulta médica. No ofrece diagnósticos ni recomendaciones médicas.",
    trust: "Toda la información se basa únicamente en lo que usted indica.",
    valueProp:
      "Prepare síntomas, medicación, documentos y preguntas de forma estructurada — en su idioma.",
    languageLabel: "Idioma que desea usar con MedScoutX",
    languageHint:
      "Puede introducir la información en el idioma en el que se sienta más seguro.",
    doctorLanguageLabel: "Idioma de la versión para el médico",
    doctorLanguageHint:
      "Elija aquí en qué idioma debe prepararse la versión destinada al médico.",
    continue: "Continuar",
  },
  chrome: {
    backHome: "Volver al inicio de MedScoutX",
    backPatientHub: "Volver al espacio del paciente",
    moduleLabel: "Preparar la consulta médica",
    libraryModuleLabel: "Mis preparativos",
    safety:
      "Este módulo solo sirve para preparar y documentar su información. No sustituye el consejo médico.",
    librarySafety:
      "Gestione aquí las preparaciones guardadas. Nada se sincroniza automáticamente — en esta biblioteca solo aparecen los elementos que usted guardó explícitamente.",
    navAria: "Navegación de pre-consulta",
  },
  chat: {
    pageTitle: "MedScoutX — Cuestionario previo",
    progressTemplate: "Paso {{current}} de {{total}}",
    answerPlaceholder: "Su respuesta…",
    next: "Continuar",
    back: "Volver",
    changeLanguage: "Cambiar idioma de entrada",
    sectionLabelQuestion: "Pregunta",
    sectionLabelAnswer: "Su respuesta",
    devInsertDemo: "Insertar datos de demostración",
    devOnlyNote: "Visible solo en desarrollo local.",
    adaptiveSeedHint:
      "Describa este punto con sus propias palabras, de la forma más concreta y neutral posible.",
    adaptiveFollowupLabel: "Pregunta adicional para la preparación",
    adaptiveSeedRequired:
      "Describa brevemente la situación con sus propias palabras.",
    adaptiveAnswerRequired:
      "Responda brevemente a la pregunta adicional.",
    adaptiveBusy: "Un momento…",
    adaptiveProgressMeta:
      "Preguntas adicionales para esta entrada: {{n}} de un máximo de {{max}}",
    adaptiveSkip: "Omitir",
    adaptiveServiceError:
      "La pregunta adicional adaptativa no puede crearse ahora mismo. Puede continuar o editar más tarde.",
    audioHint:
      "Puede escuchar la pregunta o dictar su respuesta.",
    audioPrivacy:
      "Para la lectura en voz alta y la entrada por voz, se envía texto o audio al servicio de IA para su procesamiento. Esta función no almacena nada de forma permanente.",
    audioMicUnsupported:
      "La grabación de audio no es compatible con este navegador.",
    audioListenAria: "Leer la pregunta en voz alta",
    audioListenTitle:
      "Leer en voz alta la pregunta y una breve indicación",
    audioDictateAria: "Dictar la respuesta",
    audioDictateTitle:
      "Toque para iniciar la grabación y vuelva a tocar para detenerla",
    audioStatusLoading: "Preparando audio…",
    audioStatusPlaying: "Reproduciendo…",
    audioStatusRecording:
      "Grabando… vuelva a tocar cuando haya terminado.",
    audioStatusTranscribing: "Convirtiendo su voz en texto…",
    audioErrorGeneric:
      "La función de audio no está disponible en este momento. Inténtelo de nuevo más tarde.",
    audioErrorPlayback:
      "No se pudo iniciar la reproducción.",
    audioMicPermission:
      "Se denegó el acceso al micrófono o no está disponible.",
    longitudinalCaseBanner:
      "Opcional: hay un caso longitudinal vinculado. La recogida utiliza solo sus propias declaraciones anteriores, sin interpretación médica.",
  },
  review: {
    pageTitle: "MedScoutX — Resumen previo",
    title: "Resumen de sus respuestas",
    intro:
      "Así se utilizarán sus respuestas para preparar la consulta. Aún puede hacer cambios.",
    empty: "no indicado",
    edit: "Editar",
    clearField: "Eliminar entrada",
    trustBeforeActions:
      "Puede revisar, editar o borrar su información en cualquier momento antes de crear el documento.",
    newSession: "Iniciar nueva sesión",
    wipeSession: "Eliminar sesión por completo",
    prepareDocument: "Preparar documento",
  },
  document: {
    vitalsAttach: {
      heading: "Adjuntar mis mediciones",
      intro:
        "Ha registrado mediciones en MedScoutX. Puede adjuntar automáticamente el valor más reciente de cada una a este documento.",
      consent:
        "Consiento que mis mediciones actuales se adjunten a este documento y se envíen con él a la consulta.",
      previewTitle: "Se adjuntarán estos valores",
      minimisationNote:
        "Solo se transmite el valor más reciente por tipo de medición de los últimos 90 días, sin sus notas. Puede anular la selección en cualquier momento.",
      importedLabel: "del dispositivo",
      attachError: "No se pudieron adjuntar las mediciones.",
      attachedHint: "Sus mediciones se adjuntarán a este PDF.",
    },
    pageTitle: "MedScoutX — Vista previa del documento",
    title: "Preparar documento para el médico",
    explanation:
      "El PDF para el médico se crea en alemán. Sus declaraciones originales también se mantienen adjuntas en su propio idioma.",
    pageLeadFlexible:
      "Revise su información y elija en qué idioma debe crearse la versión estructurada para el médico. Sus declaraciones originales como paciente seguirán adjuntas por separado.",
    doctorLangLabel: "Idioma de la versión para el médico",
    doctorLangHint:
      "La versión estructurada para el médico y el PDF enviado al centro se crean en alemán.",
    doctorLangSelectableHint:
      "Aquí puede definir en qué idioma debe crearse la versión destinada al médico.",
    patientMetaSection: "Información opcional del paciente",
    patientMetaNote:
      "Esta información es opcional y ayuda al centro a identificar el documento.",
    patientIdentityPdfConsent:
      "Incluir estos datos del paciente en el PDF para el centro/médico.",
    patientIdentityPdfConsentHint:
      "Los datos de identidad solo aparecerán en el PDF si activa esta opción. Puede dejar los campos rellenados localmente para usarlos después.",
    patientNameLabel: "Nombre",
    patientDateOfBirthLabel: "Fecha de nacimiento",
    patientEmailLabel: "Correo electrónico",
    patientPhoneLabel: "Teléfono (opcional)",
    patientGenderOrSalutationLabel: "Género / tratamiento",
    sectionStructured: "Versión estructurada para el médico",
    sectionOriginal: "Declaraciones originales del paciente",
    disclaimer:
      "La versión para el médico se basa solo en las declaraciones del paciente. No se crean diagnósticos, recomendaciones ni valoraciones de urgencia.",
    empty: "no indicado",
    backReview: "Volver al resumen",
    pdfDisabled: "Crear PDF",
    pdfLocalNote:
      "El archivo PDF se crea localmente en su navegador. No se transmiten datos.",
    consentCheckbox:
      "Quiero guardar esta sesión localmente en este navegador para poder consultarla después.",
    consentExpl:
      "La sesión se guarda solo localmente en este navegador. No se envían datos a MedScoutX.",
    saveLocal: "Guardar sesión localmente",
    saveSuccess: "La sesión se guardó localmente.",
    archiveNote:
      "Puede eliminar las sesiones guardadas más adelante. Esta función no sustituye el historial clínico.",
    historyLink: "Ver sesiones guardadas",
    consentSectionTitle: "Copia local opcional",
    createDoctorVersion: "Crear versión para el médico",
    creatingDoctorVersion: "Creando versión para el médico…",
    aiError:
      "No se pudo crear la versión para el médico ahora. Aún puede usar la vista previa PDF local.",
    aiSuccessStatus:
      "La versión para el médico se creó a partir de sus declaraciones.",
    accountSectionTitle: "Guardar en mi cuenta",
    accountConsentCheckbox:
      "Quiero guardar esta preparación en mi cuenta MedScoutX.",
    accountConsentExpl:
      "Este almacenamiento es opcional. Podrá ver o eliminar preparaciones guardadas después.",
    saveToAccount: "Guardar en la cuenta",
    accountLoginHint:
      "Inicie sesión para guardar preparaciones en su cuenta.",
    accountLoginLink: "Iniciar sesión",
    accountSaveSuccess:
      "La preparación se guardó en su cuenta.",
    accountSaveError:
      "No se pudo guardar la preparación ahora.",
    emailPdfConsent:
      "Confirmo que este documento puede contener información de salud personal y que puede enviarse al centro/médico seleccionado.",
    sessionTitleDe: "Preparación de la consulta médica",
    sessionTitleEn: "Preparación de la consulta médica",
    sessionTitleEs: "Preparación de la consulta médica",
    viewMyPreparations: "Ver mis preparaciones",
    mainNavAria:
      "Versión para el médico, exportar PDF, volver al resumen",
    structuredRowLabels: {
      appointmentReason: "Motivo actual de la consulta",
      symptomsOwnWords: "Síntomas con palabras del paciente",
      onsetAndCourse: "Inicio y evolución en el tiempo",
      medications: "Medicación actual",
      preExistingConditions: "Enfermedades previas conocidas",
      relevantDocuments: "Documentos relevantes",
      patientQuestions: "Preguntas para el médico",
    },
    assistantQuestions: {
      sectionTitle: "Preguntas de orientación para la consulta",
      intro:
        "A partir de sus indicaciones sobre síntomas, evolución y preparación, la IA sugiere algunas preguntas estructurantes. Sirven solo para su propia preparación y no incluyen evaluación médica.",
      noAiAnswersNote:
        "Solo se sugieren preguntas. Sus respuestas permanecen para su propia preparación y no se envían al médico como un bloque de preguntas aparte.",
      generateButton: "Crear preguntas de orientación",
      generating: "Preparando preguntas…",
      successStatus:
        "Las preguntas de orientación se crearon a partir de sus indicaciones.",
      error:
        "Las preguntas de orientación no pudieron crearse ahora. Puede continuar o intentarlo más tarde.",
      staleHint:
        "Sus indicaciones han cambiado. Vuelva a crear las preguntas para que coincidan con la información actual.",
      emptyState:
        "Aún no hay preguntas de orientación. Créelas opcionalmente para preparar la conversación.",
      questionCounter: "Pregunta {{current}} de {{total}}",
      doctorVersionLabel: "Formulación para el médico",
      answerLabel: "Su respuesta",
      answerPlaceholder:
        "Su respuesta con sus propias palabras — solo de usted, no de la IA…",
      previewSectionTitle: "Preguntas de orientación para su preparación",
      pdfSectionHeading: "Preguntas de orientación (respuestas del paciente)",
      pdfPatientQuestionLabel: "Pregunta (paciente)",
      pdfDoctorQuestionLabel: "Pregunta (médico)",
      pdfPatientAnswerLabel: "Respuesta del paciente",
    },
  },
  localHistory: {
    pageTitle: "Sesiones guardadas — Pre-consulta — MedScoutX",
    title: "Sesiones guardadas localmente",
    expl:
      "Estas sesiones solo están en este navegador. No se han enviado a MedScoutX.",
    privacyNote:
      "Las sesiones locales permanecen solo en este dispositivo y navegador.",
    empty: "No hay sesiones guardadas localmente.",
    patientLang: "Idioma del paciente",
    doctorLang: "Idioma del médico",
    savedAt: "Guardado",
    view: "Ver",
    delete: "Eliminar",
    clearAll: "Eliminar todas las sesiones guardadas",
    clearConfirm:
      "¿Eliminar permanentemente todas las sesiones locales? No se puede deshacer.",
    listAriaLabel: "Sesiones guardadas",
  },
  accountHistory: {
    pageTitle: "MedScoutX — Mis preparaciones",
    title: "Mis preparaciones",
    subtitle:
      "Aquí ve las preparaciones que guardó explícitamente en su cuenta MedScoutX.",
    loginHint: "Inicie sesión para ver preparaciones guardadas.",
    loginCta: "Iniciar sesión",
    loading: "Cargando…",
    loadError:
      "No se pudo cargar la lista ahora. Inténtelo más tarde.",
    empty: "Aún no hay preparaciones guardadas en su cuenta.",
    patientLang: "Idioma del paciente",
    doctorLang: "Idioma del médico",
    created: "Creado",
    statusLabel: "Estado",
    open: "Abrir",
    deleteOne: "Eliminar",
    deleteAll: "Eliminar todas las preparaciones",
    confirmDeleteAll:
      "¿Eliminar todas las preparaciones guardadas en su cuenta? No se puede deshacer.",
    privacyNote:
      "Puede eliminar preparaciones guardadas en cualquier momento. Esta función no sustituye el historial clínico.",
    defaultTitle: "Preparación para la visita médica",
    deleteError: "No se pudo eliminar la preparación ahora.",
    deleteAllError: "No se pudieron eliminar las preparaciones ahora.",
    statusDraft: "Borrador",
    statusPdfCreated: "PDF creado",
    statusCompleted: "Completado",
    linkCases: "Abrir mis registros",
    startNewPrep: "Iniciar nueva preparación",
    retryLoad: "Reintentar",
    listAriaLabel: "Preparaciones guardadas",
  },
  cases: {
    backPracticeHub: "Volver a Mi consultorio",
    title: "Mis registros",
    pageTitle: "MedScoutX — Mis registros",
    intro:
      "Agrupe varias preparaciones en torno a un tema a lo largo del tiempo. Usted controla el contenido y la eliminación.",
    safetyNote:
      "Sin diagnóstico, sin urgencia, sin recomendación terapéutica. Solo se comparan y organizan sus propias entradas.",
    searchPlaceholder: "Buscar…",
    showArchived: "Mostrar archivados",
    createCase: "Crear registro",
    fieldTitle: "Título",
    fieldCategory: "Categoría (opcional)",
    fieldDescription: "Descripción (opcional)",
    save: "Guardar",
    cancel: "Cancelar",
    loading: "Cargando…",
    loadError: "No se han podido cargar los registros.",
    saveError: "No se ha podido guardar el registro.",
    empty: "Aún no hay registros.",
    sessionCount: "Preparaciones",
    loginHint: "Inicie sesión para gestionar los registros.",
    loginCta: "Iniciar sesión",
    linkPreparations: "Mis preparativos",
    backHome: "Volver al inicio",
  },
  caseDetail: {
    backPracticeHub: "Volver a Mi consultorio",
    backToList: "Todos los registros",
    notFound: "Este registro no se ha encontrado o ya no está disponible.",
    unnamedSession: "Preparación sin título",
  },
};
