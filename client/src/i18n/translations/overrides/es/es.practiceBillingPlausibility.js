/**
 * Spanish translations — billing plausibility module + vendor catalogue keys.
 * Disclaimer meaning must remain consistent: automated hint only, not legally binding,
 * not medical advice, not a final reimbursement decision.
 */
export const esPracticeBillingPlausibility = {
  pageTitle: "MedScoutX — Plausibilidad de facturación GOÄ/PKV",
  heading: "Plausibilidad de facturación (GOÄ / PKV)",
  backHub: "Vista general del consultorio",
  selectPractice: "Perfil del consultorio",
  loading: "Cargando …",
  submitting: "Verificando …",
  intro:
    "Verificación automatizada de la plausibilidad de los códigos GOÄ. Identifica posibles lagunas documentales y combinaciones inusuales. No produce una decisión de facturación vinculante.",
  disclaimer:
    "Aviso: Esta herramienta proporciona únicamente indicaciones automatizadas de plausibilidad. No constituye un dictamen de facturación jurídicamente vinculante, ni un consejo médico, ni una decisión final de reembolso. No sustituye la revisión humana por parte de personal de facturación cualificado.",

  btnNewReview: "Iniciar nueva verificación",
  labelZiffer: "Código GOÄ",
  labelFactor: "Factor",
  labelCount: "Cantidad",
  labelContext: "Contexto (opcional)",
  contextPlaceholder:
    "Breve nota sobre la prestación — sin datos del paciente, sin diagnóstico, sin información clínica.",

  btnSubmit: "Verificar plausibilidad",
  btnAddRow: "Añadir fila",
  btnRemoveRow: "Eliminar fila",

  statusPending: "Pendiente",
  statusReviewed: "Revisado",
  statusDismissed: "Archivado",

  sectionResult: "Resultado",
  sectionHistory: "Historial",

  noReviews: "Aún no hay verificaciones. Inicie la primera verificación.",
  aiUnavailable:
    "Verificación automática temporalmente no disponible. Por favor, verifique manualmente.",

  colDate: "Fecha",
  colZiffernCount: "Códigos",
  colStatus: "Estado",

  flagLabel: "Nota",

  loadError: "No se pudieron cargar las verificaciones.",
  submitError: "No se pudo enviar la solicitud.",
  aiMarked: "Indicación de plausibilidad (no vinculante)",

  resultStub:
    "Solicitud de verificación guardada. Los indicadores de plausibilidad se muestran a continuación.",

  sectionItems: "Códigos verificados",
  catalogueFound: "Encontrado en el subconjunto local del catálogo",
  catalogueNotFound: "No encontrado en el subconjunto local — verificación manual recomendada",
  noWarnings: "Sin indicaciones para este código.",
  itemWarningsLabel: "Indicaciones",

  warnings: {
    unknown_goae_ziffer:
      "Código GOÄ no encontrado en el catálogo de prueba local — verificación manual requerida.",
    factor_requires_justification:
      "Factor superior a 2,3 — puede requerirse justificación escrita (§ 5 GOÄ).",
    justification_missing:
      "Factor elevado sin texto de justificación — se recomienda documentar el motivo.",
    invalid_factor: "Valor de factor inválido.",
    invalid_count: "Valor de cantidad inválido.",
  },

  btnAiReview: "Solicitar indicación de plausibilidad IA",
  aiReviewPending: "Solicitando indicación IA …",
  aiReviewLabel: "Nota asistida por IA / no vinculante",
  aiReviewNonBinding: "Esta nota no es jurídicamente vinculante, no constituye un diagnóstico ni una decisión de reembolso.",
  aiReviewFallback: "Indicación IA temporalmente no disponible. Los resultados de verificación deterministas anteriores siguen siendo válidos.",
  aiReviewUnavailable: "La verificación de plausibilidad IA no está activada.",
  aiReviewError: "No se pudo solicitar la indicación IA.",
  aiReviewSuccess: "Indicación de plausibilidad IA recibida.",
  aiReviewGeneralNote: "Nota general",
  aiReviewUncertaintyNote: "Nota de incertidumbre",
  aiReviewRowHints: "Indicaciones por código",

  manualReviewRecommended: "Se recomienda la revisión manual por parte de personal de facturación cualificado.",

  featureDisabled: "Este módulo no está activo aún.",
  forbidden: "Solo los propietarios y administradores tienen acceso.",

  backToBillingOverview: "Volver al resumen de facturación",
  sessionCreatedAt: "Creada:",
  btnOpenSession: "Abrir",
  btnDismissSession: "Archivar revisión",
  dismissSuccess: "Revisión archivada.",
  dismissError: "No se pudo archivar. Por favor, inténtelo de nuevo.",
  detailLoadError: "No se pudo cargar la revisión.",
  detailNotFound: "Revisión no encontrada o no disponible.",

  errors: {
    rows_required: "Se requiere al menos un código GOÄ.",
    ziffer_required: "Código faltante en la fila {{rowIndex}}.",
    factor_required: "Factor faltante en la fila {{rowIndex}}.",
    count_required: "Cantidad faltante en la fila {{rowIndex}}.",
    patient_data_not_accepted:
      "Este formulario no acepta datos del paciente. Envíe únicamente códigos GOÄ y factores.",
    feature_disabled: "Función desactivada.",
    forbidden: "Acceso denegado.",
    practice_not_found: "Consultorio no encontrado.",
  },
};

/** Vendor catalogue keys for practiceIntegrations namespace (Spanish). */
export const esPracticeIntegrationsVendors = {
  sectionVendors: "Sistemas PVS disponibles",
  vendorCatalogueNote:
    "La activación requiere un contrato con el proveedor, un sistema de prueba y una revisión de seguridad. Ninguno de estos conectores está disponible en producción por ahora.",
  vendorStatusComingSoon: "Próximamente",
  vendorStatusSandboxReady: "Sandbox listo",
  vendorStatusActive: "Activo",
  vendorTypePvs: "PVS",
  btnExpressInterest: "Expresar interés",
};
