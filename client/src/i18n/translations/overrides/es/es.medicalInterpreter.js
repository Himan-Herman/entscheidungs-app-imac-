/**
 * Intérprete médico — módulo paciente B2C (ES).
 * Solo apoyo a la comunicación; sin diagnóstico, triaje ni recomendación de tratamiento.
 */
export default {
  hub: {
    title: "Traducir la consulta médica",
    subtitle: "Traducción en directo para pacientes y consultorios",
    cta: "Iniciar conversación",
    newConversation: "Nueva conversación",
    trustLine:
      "Solo apoyo a la comunicación — sin diagnóstico ni recomendación de tratamiento.",
    privacyLine:
      "Micrófono solo con su autorización. El contenido de las conversaciones permanece por defecto en este dispositivo.",
    ariaLabel: "Abrir traducir la consulta médica",
  },

  chrome: {
    moduleTitle: "Traducir la consulta médica",
    backToHub: "Volver al espacio del paciente",
    backToSetup: "Volver a la configuración",
  },

  safety: {
    strip:
      "Apoyo a la comunicación — sin evaluación médica, diagnóstico ni recomendación de tratamiento.",
    noDiagnosis: "Sin diagnóstico",
    noTriage: "Sin evaluación de urgencia",
    noTreatment: "Sin recomendación de tratamiento",
    verifyTranslation:
      "Las traducciones automáticas pueden contener errores. Verifique la información importante con su equipo sanitario.",
    communicationOnly:
      "Este módulo apoya la traducción y documentación de conversaciones — no la evaluación médica de su situación.",
  },

  start: {
    pageTitle: "MedScoutX — Preparar la conversación",
    heading: "Traducir la consulta médica",
    intro:
      "Prepare una conversación multilingüe con su equipo sanitario. La configuración solo lleva unos pasos.",
    stepOf: "Paso {{current}} de {{total}}",
    back: "Atrás",
    next: "Continuar",
    cancel: "Cancelar",
    cancelConfirm: "¿Cancelar la configuración?",
  },

  languages: {
    heading: "Elegir idiomas",
    intro:
      "¿Qué idiomas utilizarán usted y su equipo sanitario durante la consulta?",
    patientLabel: "Su idioma",
    doctorLabel: "Idioma del equipo sanitario",
    patientHint: "El idioma que usted habla",
    doctorHint: "El idioma que habla el equipo sanitario",
    required: "Seleccione ambos idiomas.",
    selectEmpty: "Seleccione",
    loadingDefaults: "Cargando idiomas predeterminados…",
    searchLabel: "Buscar idioma",
    searchPlaceholder: "Buscar por nombre o código…",
    searchEmpty: "Ningún idioma coincide con su búsqueda.",
    mixedDirectionNote:
      "Esta conversación utiliza idiomas de derecha a izquierda y de izquierda a derecha. Lea cada sección en su propio sentido.",
  },

  profile: {
    heading: "Perfil para esta conversación",
    intro:
      "Opcional: utilizar los datos guardados de la cuenta para esta conversación (p. ej., para documentación posterior).",
    consentLabel: "Utilizar los datos de perfil guardados para esta conversación",
    consentHint:
      "Nombre, fecha de nacimiento y datos de contacto — solo si usted lo consiente. No se utilizan datos del perfil de salud.",
    accountLink: "Modificar en los ajustes de la cuenta",
    loadError:
      "No se ha podido cargar el perfil. Puede continuar sin datos de perfil.",
    skipped: "Continuar sin datos de perfil",
  },

  doctorInfo: {
    heading: "Detalles de la consulta (opcional)",
    intro:
      "Esta información facilita la orientación y la documentación posterior. Puede dejar todos los campos vacíos.",
    toggleShow: "Añadir detalles",
    toggleHide: "Ocultar detalles",
    doctorName: "Nombre del profesional",
    doctorNamePlaceholder: "p. ej., Dr. Martín",
    practiceName: "Consultorio o clínica",
    practiceNamePlaceholder: "Nombre del centro",
    specialty: "Especialidad",
    specialtyPlaceholder: "p. ej., Medicina general",
    appointmentDate: "Cita (fecha)",
    conversationTitle: "Título de esta conversación",
    conversationTitlePlaceholder: "p. ej., Consulta de seguimiento",
  },

  privacy: {
    heading: "Información y consentimiento",
    body1:
      "Este módulo apoya la traducción y documentación de conversaciones entre usted y su equipo sanitario. No ofrece diagnóstico, evaluación de urgencia ni recomendación de tratamiento.",
    body2:
      "La traducción automática y el reconocimiento de voz pueden ser inexactos o incompletos. Verifique la información importante con su equipo sanitario.",
    body3:
      "El audio se envía de forma segura solo para la transcripción, se procesa en memoria y no se almacena en los servidores de MedScoutX ni en esta aplicación.",
    body4:
      "Los datos de la conversación permanecen solo en este dispositivo en la fase 1 (local). No se crea registro en servidor del contenido de las conversaciones.",
    storageLabel: "Guardar la conversación en este dispositivo",
    storageHint:
      "Le permite continuar y reabrir en este dispositivo. Puede eliminar la conversación más tarde.",
    noStorageWarning:
      "Sin guardado, esta conversación se pierde al salir de la página.",
    acceptLabel: "He leído y comprendido la información",
    acceptRequired: "Confirme que ha tomado conocimiento de la información.",
    beginCta: "Comenzar la conversación",
    legalLinks:
      "Más información en Privacidad y aviso legal.",
    linkPrivacy: "Privacidad",
    linkDisclaimer: "Información",
  },

  live: {
    mockOriginalPatient: "Me gustaría hablar de algo importante.",
    mockOriginalDoctor: "Continúe con sus propias palabras.",
    mockTranslationPreview:
      "Vista previa de traducción — el servicio de traducción se conectará en una versión posterior.",
    statusRegion: "Estado de la grabación",
    currentTurn: "Enunciado actual",
  },

  room: {
    pageTitle: "MedScoutX — Conversación en directo",
    heading: "Conversación en directo",
    languagesLabel: "{{patient}} ↔ {{doctor}}",
    statusIdle: "Listo",
    statusRecording: "Grabando…",
    statusUploading: "Finalizando la grabación…",
    statusTranscribing: "Reconocimiento de voz…",
    statusTranslating: "Traduciendo…",
    statusSimplifying: "Simplificando el lenguaje…",
    statusSpeaking: "Reproduciendo audio…",
    statusReadyForNext: "Listo para el siguiente enunciado",
    statusEditingDraft: "Revisar el texto hablado antes de traducir",
    statusBlocked: "Traducción bloqueada — modifique el texto",
    statusError: "Ha ocurrido un problema en este turno",
    speakerDirection: "Usted habla en {{source}} · traducción hacia {{target}}",
    turnPatient: "Usted habla",
    turnClinician: "El equipo sanitario habla",
    speakerTogglePatient: "Yo hablo",
    speakerToggleClinician: "El equipo sanitario habla",
    disclaimerStrip:
      "Apoyo a la comunicación — verifique la información importante con su equipo sanitario.",
  },

  transcript: {
    heading: "Texto hablado",
    placeholder: "El texto reconocido aparecerá aquí tras la grabación.",
    edit: "Modificar el texto",
    saveEdit: "Aplicar cambios",
    confirm: "Confirmar el texto y traducir",
    editingHint: "Revise el texto antes de que se traduzca.",
    empty: "Aún no hay grabación para este turno.",
    lowConfidenceInput:
      "El reconocimiento de voz puede ser inexacto. Revise y corrija el texto antes de traducir.",
    draftSavedHint: "Su borrador se guarda en este dispositivo mientras edita.",
  },

  translation: {
    heading: "Traducción",
    placeholder: "La traducción aparece tras confirmar el texto.",
    empty: "Aún no hay traducción para este turno.",
    lowConfidence:
      "Verifique: es posible que el texto hablado no se haya reconocido correctamente. Aclare la información importante con su equipo sanitario.",
    uncertainLabel:
      "Algunas formulaciones eran poco claras — la traducción puede no reflejarlo todo. Confirme los detalles importantes juntos.",
    terminologyWarning:
      "Los nombres de medicamentos, cifras, unidades o negaciones pueden requerir verificación. Compruebe los términos importantes con su profesional sanitario.",
    unclearSourceWarning:
      "La formulación original parecía poco clara. No confíe solo en esta traducción para detalles médicos importantes.",
    languagePairLimited:
      "Esta combinación de idiomas no está totalmente soportada en la aplicación. Verifique los términos importantes con su profesional sanitario.",
    mixedDirectionSession:
      "En esta conversación se utilizan idiomas de derecha a izquierda y de izquierda a derecha. Verifique cada bloque de texto con atención.",
    verifyTermsNotice:
      "La traducción automática puede ser inexacta. Verifique nombres de medicamentos, posologías, alergias y otros términos importantes con su profesional sanitario.",
    blocked:
      "No se ha podido mostrar la traducción de forma segura. Reformule de manera neutra o hable directamente.",
    replay: "Mostrar de nuevo la traducción",
  },

  speak: {
    listenTranslation: "Escuchar la traducción",
    listenSimplified: "Escuchar el texto simplificado",
    loading: "Preparando el audio…",
    stop: "Detener la reproducción",
    playbackPlaying: "Reproducción de audio en curso",
    playbackStopped: "Reproducción detenida",
    retry: "Reintentar la reproducción",
  },

  streamingTts: {
    heading: "Lectura por voz (casi en tiempo real)",
    experimentalBadge: "Opcional — el audio nunca se inicia automáticamente.",
    privacyNote:
      "El audio se genera bajo demanda y se conserva solo en memoria en este dispositivo hasta que abandone la página.",
    enablePreviewPlayback: "Permitir la reproducción de la vista previa de traducción (solo inicio manual)",
    playPreview: "Escuchar la vista previa de traducción",
    stopPlayback: "Detener la reproducción",
    playPreviewAria: "Escuchar en voz alta la vista previa de traducción casi en tiempo real",
    stopPlaybackAria: "Detener la lectura por voz",
    statusLoading: "Preparando la voz…",
    statusPlaying: "Reproduciendo audio de la traducción",
    statusIdle: "Reproducción detenida",
    previewDisabledHint:
      "Active la reproducción de vista previa arriba para escuchar la traducción no confirmada.",
    errorGeneric: "No se ha podido iniciar la reproducción. Puede reintentar o continuar sin audio.",
    staleBlockPlayback:
      "El texto de vista previa ha cambiado — espere una vista previa actualizada o descártela antes de iniciar la reproducción.",
  },

  simplify: {
    action: "Simplificar el lenguaje",
    heading: "Formulación simplificada",
    note:
      "Solo simplificación del lenguaje — sin consejo médico. Verifique la información importante con su profesional sanitario.",
    hide: "Ocultar el texto simplificado",
    loading: "Simplificando…",
  },

  pushToTalk: {
    record: "Mantener para hablar",
    recordTap: "Pulsar para hablar",
    stop: "Detener la grabación",
    recording: "Grabando",
    micTest: "Probar el micrófono",
    micTestHint: "Prueba breve — no se traducirá nada.",
    micDenied: "El acceso al micrófono no está disponible.",
    micDeniedGuidance:
      "Autorice el acceso al micrófono para este sitio en los ajustes del navegador y pulse «Reintentar micrófono». También puede escribir el texto en el campo superior.",
    micRetry: "Reintentar micrófono",
    tooShort: "Grabación demasiado corta. Hable un poco más y vuelva a intentarlo.",
    likelySilent:
      "No hemos detectado voz clara. Compruebe su micrófono e inténtelo de nuevo.",
    preparing: "Preparando el micrófono…",
    stopping: "Finalizando la grabación…",
    maxDurationHint: "Duración máxima de grabación alcanzada. Detenga la grabación.",
    keyboardHint: "Consejo: seleccione el botón de hablar y pulse Espacio o Intro.",
    disabledDraft:
      "Termine la revisión del texto actual antes de iniciar una nueva grabación.",
    disabledBusy: "Espere a que finalice el paso en curso.",
    disabledOffline: "La grabación requiere conexión a Internet.",
  },

  streaming: {
    heading: "Vista previa de transcripción en flujo (experimental)",
    experimentalBadge: "Beta opcional — pulsar para hablar sigue siendo el modo predeterminado y más seguro.",
    privacyNote:
      "El audio se envía en segmentos cortos solo para la transcripción. Nada se almacena en nuestros servidores como audio. La transcripción permanece provisional hasta que la añada como borrador y la confirme antes de traducir.",
    pttDefaultNote:
      "Para el uso habitual, continúe con pulsar para hablar arriba. Inicie el flujo solo si desea probar esta vista previa.",
    captionsAria: "Subtítulos provisionales en flujo",
    captionsEmpty: "Aún no hay texto provisional. Inicie el flujo para ver los subtítulos aquí.",
    provisionalLabel: "Borrador provisional (no confirmado)",
    startButton: "Iniciar vista previa en flujo",
    stopButton: "Detener el flujo",
    stopping: "Deteniendo…",
    cancelButton: "Cancelar",
    useAsDraftButton: "Usar como borrador (modificar antes de traducir)",
    startAria: "Iniciar vista previa experimental de transcripción en flujo",
    stopAria: "Detener la vista previa de transcripción en flujo",
    statusIdle: "Flujo inactivo",
    statusConnecting: "Conectando…",
    statusConnected: "Flujo activo — micrófono activado",
    statusProcessing: "Procesando segmento de audio…",
    statusFinalizing: "Finalizando la transcripción…",
    previewReady: "Flujo finalizado. Revise el texto y úselo como borrador si lo necesita.",
    unsupportedBrowser:
      "La vista previa en flujo no es compatible con este navegador. Utilice pulsar para hablar.",
    errorGeneric: "El flujo no ha podido continuar. Deténgalo y utilice pulsar para hablar.",
    backpressureError:
      "El audio llega demasiado rápido. El flujo se ha detenido — use pulsar para hablar o inténtelo más despacio.",
    disabledWhileStreaming: "Finalice o detenga el flujo antes de usar pulsar para hablar.",
    maxDurationReached:
      "Duración máxima de flujo alcanzada. La vista previa se ha finalizado — úsela como borrador o continúe con pulsar para hablar.",
    fallbackToPtt:
      "Si los modos de vista previa no están disponibles, use pulsar para hablar arriba — sigue siendo el modo predeterminado.",
  },

  nearRealtime: {
    heading: "Vista previa de traducción casi en tiempo real",
    experimentalBadge:
      "Solo vista previa opcional — no se guarda hasta que confirme un turno borrador abajo.",
    privacyNote:
      "Solo se envía el fragmento de transcripción actual para traducir. Sin historial de conversación, sin audio, y nada se almacena en el servidor como sesión.",
    notConfirmedLabel: "Vista previa de traducción (no confirmada)",
    previewAria: "Vista previa provisional de traducción casi en tiempo real",
    previewEmpty:
      "Cuando la transcripción en flujo se estabilice, puede aparecer aquí una vista previa de traducción.",
    statusIdle: "Vista previa casi en tiempo real inactiva",
    statusWaiting: "Esperando una transcripción estable…",
    statusTranslating: "Generando vista previa de traducción…",
    statusReady: "Vista previa de traducción lista — no guardada",
    confirmRequiredNote:
      "Use «Usar como borrador» en el flujo arriba, modifique si es necesario y confirme la traducción en el panel de transcripción. Pulsar para hablar sigue siendo el modo predeterminado.",
    discardButton: "Descartar vista previa de traducción",
    staleWarning:
      "La transcripción ha cambiado. Esta vista previa puede ya no coincidir — descártela o espere una vista previa actualizada.",
    lowConfidenceWarning:
      "Esta vista previa puede ser incierta. Revísela con atención antes de confirmar.",
    unclearSourceWarning:
      "La formulación de origen era poco clara. Modifique la transcripción antes de confirmar.",
    errorGeneric:
      "Vista previa de traducción no disponible. Puede continuar con pulsar para hablar y traducción manual.",
  },

  history: {
    heading: "Documentación de conversaciones en este dispositivo",
    privacyNote:
      "Fase 1: las conversaciones se almacenan solo en este dispositivo — no en los servidores de MedScoutX. No se conservan grabaciones de audio ni del micrófono. Es documentación orientativa y de comunicación, no un historial médico. Puede eliminar conversaciones individualmente o borrar todo el historial abajo en cualquier momento.",
    fallbackTitle: "Conversación del {{date}}",
    statusDraft: "Borrador",
    statusActive: "Activa",
    statusEnded: "Finalizada",
    continue: "Continuar",
    review: "Consultar",
    rename: "Renombrar",
    clearAll: "Borrar todo en este dispositivo",
    clearAllConfirm:
      "¿Eliminar todas las conversaciones del intérprete en este dispositivo? Esta acción es irreversible.",
    renamePrompt: "Título de esta conversación",
    renameTitle: "Renombrar conversación",
    renameSave: "Guardar título",
    renamed: "Título actualizado.",
    deleted: "Conversación eliminada.",
    cleared: "Todas las conversaciones han sido borradas.",
    languagePair: "{{patient}} ↔ {{doctor}}",
    titleWithAppointment: "Conversación del {{date}}",
    titleWithAppointmentPractice: "Conversación del {{date}} · {{practice}}",
    titleWithAppointmentDoctor: "Conversación del {{date}} · {{doctor}}",
    titleWithPractice: "Conversación · {{practice}}",
    titleWithDoctor: "Conversación · {{doctor}}",
    titleLanguagePair: "Traducción {{patient}} ↔ {{doctor}}",
    titleUnsafe:
      "Este título no puede utilizarse. Elija un nombre neutro sin conclusión médica ni mención de urgencia.",
    turnCount: "{{count}} turnos documentados ({{translated}} traducidos)",
    searchLabel: "Buscar conversaciones en este dispositivo",
    searchPlaceholder: "Título, consultorio, idioma…",
    searchHintLocal: "La búsqueda se realiza solo en este dispositivo. No se envía nada al servidor.",
    searchResults: "{{count}} de {{total}} conversaciones mostradas",
    noSearchResults: "Ninguna conversación coincide con su búsqueda.",
  },

  sections: {
    opening: "Inicio de conversación",
    patientStatements: "Enunciados del paciente",
    clinicianStatements: "Enunciados del equipo sanitario",
    closing: "Fin de conversación",
    middle: "Intercambio posterior",
  },

  pdf: {
    documentTitle: "Intérprete médico — documentación de conversación",
    documentSubtitle:
      "Resumen de apoyo a la comunicación · informe de conversación traducida",
    legalParagraph1:
      "Este documento apoya únicamente la comunicación. No constituye historial médico, informe de diagnóstico, evaluación clínica ni resumen de tratamiento.",
    legalParagraph2:
      "No contiene diagnóstico, triaje, evaluación de urgencia ni recomendaciones de tratamiento.",
    legalParagraph3:
      "La transcripción y la traducción automáticas pueden ser inexactas o incompletas.",
    sessionTitleLabel: "Título de la conversación",
    generatedNote: "Generado localmente en este dispositivo · MedScoutX Intérprete médico",
    footerPage: "Página",
    filenamePrefix: "medscoutx-interpreter",
    exportLoading: "Generando PDF…",
    exportSuccess: "PDF descargado en su dispositivo.",
    exportFailed: "No se ha podido crear el PDF. Inténtelo de nuevo.",
    exportNoTurns: "No hay turnos documentados para exportar.",
    rtlFontNotice:
      "Nota: algunos sistemas de escritura pueden no mostrarse por completo en este PDF hasta que se añada soporte ampliado de fuentes.",
    rtlLimitationDetail:
      "La exportación PDF utiliza fuentes estándar. Árabe, persa, kurdo (sorani) y otros sistemas RTL pueden aparecer simplificados o mal alineados. Use la revisión en pantalla para la lectura más fiel.",
    mixedScriptNotice:
      "Este documento contiene direcciones de escritura mixtas. Verifique las formulaciones en pantalla si algo parece poco claro en el PDF.",
  },

  review: {
    pageTitle: "MedScoutX — Documentación de conversación",
    heading: "Documentación de conversación",
    notMedicalRecord:
      "Solo documentación orientativa y de comunicación — no es un historial médico.",
    metadataHeading: "Detalles de la sesión",
    turnsHeading: "Turnos documentados",
    timelineHeading: "Cronología de la conversación",
    documentationNotice:
      "La traducción automática puede ser inexacta. Verifique nombres de medicamentos, posologías, alergias y otros términos importantes con su profesional sanitario.",
    summaryLine: "{{turns}} turnos documentados · {{translated}} traducidos",
    summaryDrafts: "{{count}} turno(s) borrador aún no traducido(s)",
    summaryTurnsLabel: "Turnos documentados",
    created: "Iniciada",
    ended: "Finalizada",
    status: "Estado",
    turnNumber: "Turno {{n}}",
    langDirection: "{{source}} → {{target}}",
    originalLabel: "Texto hablado",
    translatedLabel: "Traducción",
    simplifiedLabel: "Formulación simplificada",
    turnDraft: "Borrador — aún no traducido",
    turnBlocked: "Traducción no disponible (seguridad)",
    turnError: "Este turno no se ha podido completar",
    backToList: "Todas las conversaciones",
  },

  confirm: {
    deleteTitle: "¿Eliminar la conversación?",
    deleteBody:
      "Esto elimina la conversación solo en este dispositivo. Esta acción es irreversible.",
    clearAllTitle: "¿Borrar todas las conversaciones?",
    clearAllBody:
      "¿Eliminar todas las conversaciones del intérprete en este dispositivo? Esta acción es irreversible.",
    endTitle: "¿Finalizar la conversación?",
    endBody: "La conversación se marcará como finalizada en este dispositivo.",
    endWithDraftBody:
      "Tiene texto hablado que aún no está traducido. ¿Finalizar la conversación de todos modos?",
    leaveTitle: "¿Salir de la sala en directo?",
    leaveBody:
      "Tiene texto hablado que aún no está confirmado ni traducido. Si sale ahora, puede descartarlo o seguir editando.",
    discardDraft: "Descartar y salir",
    keepEditing: "Seguir editando",
    endAnyway: "Finalizar de todos modos",
    confirmDelete: "Eliminar",
    confirmClearAll: "Borrar todo",
    confirmEnd: "Finalizar conversación",
    cancel: "Cancelar",
  },

  sessionActions: {
    heading: "Conversación",
    end: "Finalizar conversación",
    endHint: "Conversación marcada como finalizada.",
    ended: "Conversación finalizada.",
    leave: "Salir de la sala",
    leaveConfirm:
      "¿Salir de la conversación? El contenido no guardado puede perderse.",
    delete: "Eliminar en este dispositivo",
    deleteConfirm: "¿Eliminar realmente esta conversación de este dispositivo?",
    export: "Descargar PDF",
    exportHint: "Descargar la documentación de conversación en PDF en este dispositivo.",
    exportUnavailable: "Añada al menos un turno documentado antes de exportar.",
  },

  empty: {
    moduleDisabled: "El intérprete médico no está disponible por el momento.",
    noSession: "Conversación no encontrada. Inicie una nueva.",
    noTurns:
      "Aún no hay contribución oral. Mantenga el botón para comenzar.",
    historyEmpty: "Aún no hay conversaciones guardadas en este dispositivo.",
    setupIncomplete:
      "Complete la configuración antes de entrar en la sala en directo.",
  },

  cloud: {
    heading: "Copia de seguridad de cuenta opcional",
    lead:
      "Por defecto, las conversaciones permanecen solo en este dispositivo. Opcionalmente puede guardar una copia cifrada en su cuenta MedScoutX para abrirla en otro dispositivo.",
    bulletLocalStill:
      "El modo solo local sigue disponible — no está obligado a usar la copia de cuenta.",
    bulletWhatStored:
      "El contenido almacenado puede incluir texto de conversaciones, traducciones, formulaciones simplificadas y detalles de sesión (idiomas, título, datos de cita).",
    bulletNoAudio:
      "El audio y las grabaciones del micrófono nunca se almacenan en el servidor.",
    bulletDeleteAnytime:
      "Puede eliminar una copia guardada o todos los datos de copia de cuenta en cualquier momento.",
    bulletNotMedicalRecord:
      "Es documentación de conversación a título orientativo — no historial médico, diagnóstico ni plan de tratamiento.",
    acceptLabel:
      "Comprendo y deseo autorizar la copia cifrada en mi cuenta cuando elija guardar una conversación",
    acceptRequired: "Confirme que comprende la copia de cuenta.",
    enableAccount: "Activar copia de cuenta",
    accountEnabled: "La copia de cuenta está activada. No se sube nada hasta que elija guardar una conversación.",
    revokeConsent: "Detener futuras copias de cuenta",
    revokeHint:
      "Detiene nuevas subidas. Las copias existentes en su cuenta permanecen hasta que las elimine por separado.",
    consentGranted: "Copia de cuenta activada.",
    consentRevoked: "Futuras copias de cuenta detenidas.",
    unavailable:
      "La copia de cuenta no está disponible en este entorno. Las conversaciones permanecen solo en este dispositivo.",
    loading: "Comprobando disponibilidad de copia de cuenta…",
    setupHeading: "Copia de cuenta (opcional)",
    setupBody:
      "Puede seguir usando el intérprete con conversaciones almacenadas solo en este dispositivo.",
    setupHint:
      "Para activar la copia cifrada de cuenta, vaya a la lista de conversaciones tras la configuración — no se sube nada automáticamente.",
    badgeLocal: "Solo en este dispositivo",
    badgeSynced: "También guardada en la cuenta",
    badgeStale: "Copia en dispositivo más reciente que en la cuenta",
    saveToAccount: "Guardar en la cuenta",
    updateSavedCopy: "Actualizar copia guardada",
    deleteCloudCopy: "Eliminar solo la copia de la cuenta",
    sessionLocalNote:
      "Eliminar en este dispositivo y eliminar la copia de cuenta son acciones distintas.",
    sessionNeedsConsent: "Active la copia de cuenta en la sección superior para guardar copias.",
    enableAccountFirst: "Active la copia de cuenta antes de guardar en su cuenta.",
    saveNeedsTurns: "Añada al menos una contribución oral antes de guardar en su cuenta.",
    saveSuccess: "Conversación guardada en su cuenta.",
    updateSuccess: "Copia de cuenta actualizada.",
    deleteCopySuccess: "Copia de cuenta eliminada. La copia en este dispositivo no cambia.",
    deleteLocalOnlyBody:
      "¿Eliminar esta conversación solo en este dispositivo? La copia de cuenta, si existe, no se elimina.",
    deleteCopyConfirmTitle: "¿Eliminar la copia de cuenta?",
    deleteCopyConfirmBody:
      "¿Retirar la copia cifrada de su cuenta? Se conserva la copia en este dispositivo.",
    deleteCopyConfirmAction: "Eliminar copia de cuenta",
    deleteAllHeading: "Todos los datos de copia de cuenta",
    deleteAllBody:
      "Retirar todas las conversaciones del Intérprete médico almacenadas en su cuenta. No se eliminan las copias en este dispositivo.",
    deleteAllAction: "Eliminar todos los datos de copia de cuenta",
    deleteAllConfirmTitle: "¿Eliminar todos los datos de copia de cuenta?",
    deleteAllConfirmBody:
      "Esto elimina de forma permanente todas las conversaciones del intérprete de su cuenta. Las copias en el dispositivo no se ven afectadas.",
    deleteAllConfirmAction: "Eliminar todos los datos de la cuenta",
    deleteAllSuccess: "Todos los datos de copia de cuenta han sido eliminados.",
    exportHeading: "Exportar copia de cuenta",
    exportBody:
      "Descargar un archivo JSON de las conversaciones almacenadas en su cuenta. No se incluye audio. Las copias solo en dispositivo no se incluyen salvo que las haya guardado en su cuenta.",
    exportAction: "Descargar exportación JSON",
    exportSuccess: "Exportación descargada.",
    dataControlHeading: "Sus datos del intérprete",
    statusUnavailable: "La copia de cuenta no está disponible aquí. Las conversaciones permanecen solo en este dispositivo.",
    statusSignInRequired: "Inicie sesión para gestionar la copia de cuenta de conversaciones del intérprete.",
    statusLocalOnly: "La copia de cuenta está desactivada. Las conversaciones en este dispositivo no se suben salvo que active la copia abajo.",
    statusAccountActive: "La copia de cuenta está activada. {{count}} conversación(es) tienen copia guardada en su cuenta.",
    statusConsentNoSessions: "La copia de cuenta está activada. No hay nada en su cuenta hasta que guarde una conversación.",
    factLocal: "En este dispositivo",
    factLocalBody: "Permanece en su navegador hasta eliminarla o borrar los datos del sitio.",
    factCloud: "En su cuenta",
    factCloudBody: "Copia cifrada que guarda manualmente — opcional, nunca automática.",
    factAudio: "Audio",
    factAudioBody: "Nunca almacenado en el servidor.",
    consentHistoryHeading: "Historial de consentimiento",
    historyGranted: "Copia activada",
    historyRevoked: "Copia detenida",
    scopeNoUser: "Inicie sesión para usar la copia de cuenta.",
    scopeMismatch: "Su sesión ha cambiado. Actualice la página antes de guardar o eliminar datos de cuenta.",
    revokeDialogTitle: "¿Detener la copia de cuenta?",
    revokeDialogIntro:
      "Se detendrán los futuros guardados en su cuenta. Elija qué hacer con las copias ya almacenadas en su cuenta.",
    revokeKeepTitle: "Conservar copias guardadas en mi cuenta",
    revokeKeepBody:
      "Solo detiene nuevas subidas. Podrá eliminar copias de cuenta más tarde en esta sección.",
    revokeDeleteTitle: "Detener copia y eliminar todas las copias de cuenta",
    revokeDeleteBody:
      "Retira {{count}} conversación(es) guardada(s) de su cuenta. No se eliminan las copias en este dispositivo.",
    revokeDeleteConfirmTitle: "¿Eliminar todas las copias de cuenta?",
    revokeDeleteConfirmBody:
      "Esto elimina de forma permanente {{count}} conversación(es) de su cuenta y detiene futuras copias.",
    revokeDeleteConfirmAction: "Eliminar copias de cuenta y detener copia",
    revokeBackToChoices: "Volver a las opciones",
    consentRevokedKeepData: "Copia de cuenta detenida. Se han conservado las copias existentes de la cuenta.",
    consentRevokedAndDeleted:
      "Copia de cuenta detenida y todas las copias de cuenta eliminadas.",
    errors: {
      generic: "No se ha podido realizar la copia de cuenta. Inténtelo más tarde.",
      network: "Problema de conexión. Inténtelo de nuevo.",
      unauthorized: "Inicie sesión para continuar.",
      rateLimited: "Demasiadas solicitudes. Espere un momento.",
      cloudDisabled: "La copia de cuenta no está disponible por el momento.",
      encryptionUnavailable: "La copia de cuenta no está configurada en el servidor.",
      consentRequired: "Se requiere consentimiento para la copia de cuenta.",
      quotaExceeded: "Límite de copia de cuenta alcanzado.",
      sessionNotFound: "Copia guardada no encontrada en su cuenta.",
      validationRejected: "Esta conversación no se ha podido guardar en su forma actual.",
    },
  },

  reliability: {
    offlineBanner:
      "Parece que está sin conexión. La entrada de voz y la traducción están suspendidas hasta que se restablezca la conexión.",
    reconnectedBanner: "Conexión restablecida. Puede continuar cuando esté listo.",
    recoveryBody:
      "El último paso no se ha podido completar. Su texto sigue ahí — puede reintentar.",
    retryAction: "Reintentar",
    dismissRecovery: "Descartar",
    errorBoundaryBody:
      "Ha ocurrido un problema en la vista del intérprete. Las demás zonas de la aplicación no se ven afectadas.",
    errorBoundaryBack: "Volver al inicio del intérprete",
  },

  errors: {
    moduleDisabled: "Este módulo no está disponible por el momento.",
    sessionNotFound: "Conversación no encontrada. Comience de nuevo.",
    transcribeFailed: "El reconocimiento de voz ha fallado. Inténtelo de nuevo.",
    translateFailed: "La traducción ha fallado. Inténtelo de nuevo.",
    simplifyFailed: "La simplificación ha fallado. Inténtelo de nuevo.",
    speakFailed: "La reproducción ha fallado. Inténtelo de nuevo.",
    ttsDisabled: "La lectura por voz no está disponible por el momento.",
    rateLimited: "Demasiadas solicitudes. Espere un momento.",
    network: "Problema de conexión. Inténtelo de nuevo.",
    offline: "Parece que está sin conexión. Compruebe su conexión e inténtelo de nuevo.",
    transcribeTimeout:
      "El reconocimiento de voz ha tardado demasiado. Haga una grabación más corta.",
    requestTimeout: "Este paso ha tardado demasiado. Inténtelo de nuevo.",
    speakUnsupported: "La reproducción de audio no es compatible con este navegador.",
    textTooLong: "El texto es demasiado largo. Acórtelo.",
    unauthorized: "Inicie sesión para continuar.",
    generic: "Ha ocurrido un problema. Inténtelo más tarde.",
  },

  invite: {
    pageTitle: "MedScoutX — Invitación del consultorio",
    heading: "Intérprete médico en su consulta",
    loading: "Comprobando enlace de invitación…",
    statusAriaPrefix: "Estado de la invitación:",
    statusActive: "El enlace de invitación es válido",
    statusExpired: "El enlace de invitación ha caducado",
    statusRevoked: "El enlace de invitación ya no está disponible",
    statusInvalid: "El enlace de invitación no es válido",
    statusUnavailable: "La validación de la invitación no está disponible",
    networkError: "No se ha podido verificar la invitación. Compruebe su conexión e inténtelo de nuevo.",
    moduleDisabled: "El intérprete médico no está disponible por el momento.",
    practiceLabel: "Consultorio",
    communicationNotice:
      "Solo apoyo a la comunicación — sin diagnóstico, triaje ni consejo de tratamiento.",
    noticeNoDiagnosis: "Sin diagnóstico médico",
    noticeNoTriage: "Sin evaluación de urgencia ni triaje",
    noticeNoTreatment: "Sin recomendaciones de tratamiento ni medicación",
    consentHeading: "Su conversación permanece privada",
    consentNoAutoShare:
      "Abrir este enlace del consultorio no comparte su conversación con el consultorio.",
    consentExplicitStep:
      "Tras finalizar la conversación, podrá elegir por separado compartir la documentación con el consultorio.",
    consentPatientControl: "Usted controla qué se comparte y puede revocar el acceso más tarde.",
    languagesHeading: "Elija los idiomas a continuación",
    languagesIntro:
      "En la siguiente pantalla elegirá su idioma y el del equipo sanitario antes de comenzar la conversación.",
    continueLoggedIn: "Elegir idiomas y continuar",
    authRequired: "Inicie sesión para usar el Intérprete médico con este enlace del consultorio.",
    guestUnsupported:
      "El uso como invitado sin cuenta aún no está soportado para el intérprete (se requiere verificación del repositorio). Inicie sesión o cree una cuenta.",
    loginToContinue: "Iniciar sesión para continuar",
    createAccount: "Crear cuenta",
    setupBannerTitle: "Enlace del consultorio",
    setupBannerBody:
      "Ha iniciado desde una invitación para {practice}. No se comparte nada con el consultorio hasta que lo consienta explícitamente en un paso posterior.",
    setupPracticePrefill: "Nombre del consultorio de la invitación (modificable)",
  },

  practiceShare: {
    heading: "Compartir con el consultorio (opcional)",
    communicationNotice:
      "Solo apoyo a la comunicación — no es historial médico ni evaluación clínica.",
    intro:
      "Puede compartir una copia de esta documentación de conversación con {practice}. El audio nunca se comparte.",
    noticeNoAudio: "Las grabaciones de audio no se comparten con el consultorio.",
    noticeDocumentation:
      "Solo puede compartirse la documentación escrita de la conversación (texto original y traducido).",
    noticeRevoke: "Puede revocar el acceso del consultorio más tarde.",
    noticeNotMedicalRecord: "No es un historial médico.",
    consentLabel:
      "Consiento compartir esta documentación de conversación con el consultorio indicado arriba.",
    grantButton: "Compartir documentación con el consultorio",
    granting: "Compartiendo…",
    grantSuccess: "Acceso del consultorio concedido. Puede revocarlo en sus ajustes del intérprete.",
    grantError: "No se ha podido compartir con el consultorio. Inténtelo más tarde.",
    tokenMissing:
      "Vuelva a abrir el enlace de invitación del consultorio para activar el uso compartido desde este dispositivo.",
  },

  aria: {
    hubCard: "Intérprete médico en el espacio del paciente",
    startInterpreter: "Iniciar Intérprete médico",
    wizardProgress: "Progreso de la configuración",
    languagePatient: "Seleccionar su idioma",
    languageDoctor: "Seleccionar idioma del equipo sanitario",
    profileConsent: "Utilizar datos de perfil para esta conversación",
    privacyAccept: "Información leída y comprendida",
    privacyStorage: "Guardar conversación en este dispositivo",
    liveRegion: "Traducción y estado actuales",
    transcriptEditor: "Modificar texto hablado",
    translationRegion: "Zona de traducción",
    speakerRole: "Quién habla actualmente",
    startRecording: "Iniciar entrada de voz",
    stopRecording: "Detener entrada de voz",
    preparingMic: "Preparando micrófono",
    stoppingRecording: "Finalizando grabación",
    replayTranslation: "Escuchar traducción",
    replaySimplified: "Escuchar texto simplificado",
    confirmTranscript: "Confirmar texto y traducir",
    simplifyLanguage: "Simplificar lenguaje de la traducción",
    simplifiedRegion: "Formulación simplificada",
    hideSimplified: "Ocultar formulación simplificada",
    deleteSession: "Eliminar conversación en este dispositivo",
    exportConversation: "Exportar conversación",
    endSession: "Finalizar conversación",
    leaveRoom: "Salir de la sala en directo",
    turnList: "Historial de turnos de conversación",
    historyList: "Conversaciones guardadas en este dispositivo",
    reviewMetadata: "Detalles de la conversación",
    renameSession: "Renombrar conversación",
    clearAllHistory: "Borrar todo el historial del intérprete",
    deleteAllCloudData: "Eliminar todos los datos de copia de cuenta",
    exportCloudData: "Descargar exportación JSON de conversaciones de copia de cuenta",
    searchHistory: "Buscar conversaciones guardadas",
    languageSearch: "Filtrar idiomas de conversación",
  },
};
