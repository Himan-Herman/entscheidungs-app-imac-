/** Tratamiento de "usted", como en el resto del área del paciente. */
export const esPatientPractices = {
  pageTitle: "Mis datos y consultas – MedScoutX",
  heading: "Mis datos y consultas",
  intro:
    "Sus propios datos y los de cada consulta permanecen separados, de modo que siempre ve de dónde procede una entrada.",
  loading: "Cargando …",
  loadError: "No se pudieron cargar sus datos.",
  retry: "Intentar de nuevo",

  ownData: {
    title: "Mis propios datos",
    description:
      "Entradas que ha registrado usted mismo o importado desde su dispositivo. No pertenecen a ninguna consulta.",
    empty: "Todavía no ha registrado ninguna entrada propia.",
  },

  practices: {
    archivedTitle: "Consultas anteriores",
    archivedDescription:
      "Datos procedentes de consultas que ya no existen. Siguen siendo suyos; la consulta ya no tiene acceso.",
    archivedEmpty: "No tiene datos de consultas anteriores.",
    title: "Mis consultas",
    description:
      "Cada consulta tiene su propia área. Una entrada vinculada a una consulta aparece únicamente allí.",
    tablistLabel: "Seleccionar consulta",
    empty: "Actualmente no está vinculado a ninguna consulta.",
    single: "Está vinculado a una consulta.",
    emptySection: "Todavía no hay entradas para esta consulta.",
    inactiveTitle: "Vínculos finalizados",
    inactiveDescription:
      "Estos vínculos ya no están activos. Las consultas ya no tienen acceso.",
    statusRevoked: "Finalizado",
    statusInvited: "Solicitud pendiente",
    statusArchived: "Archivado",
  },

  provenance: {
    archived: "Vínculo con una consulta anterior",
    archivedWith: "Consulta anterior: {practice}",
    archivedOn: "Archivado el {date}",
    own: "Sus propios datos",
    selfEntered: "Registrado por usted",
    deviceImport: "Importado desde su dispositivo",
    context: "Vínculo con la consulta",
    contextWith: "Vínculo con la consulta: {practice}",
    contextUnavailable: "Vínculo con la consulta no disponible",
    unavailableHint:
      "Esta entrada no puede asignarse actualmente a ninguno de sus vínculos con una consulta.",
  },

  sections: {
    vitals: "Mediciones",
    vaccinations: "Vacunas",
    allergies: "Alergias",
    diagnoses: "Diagnósticos e información de salud",
  },

  counts: {
    entries: "{count} entradas",
    entry: "1 entrada",
    none: "Sin entradas",
  },
};

export const esDocumentSharing = {
  sharedData: {
    title: "Datos compartidos",
    description:
      "Documentos que ha compartido deliberadamente con otra consulta. Puede revocar cada autorización en cualquier momento.",
    empty: "Todavía no ha compartido ningún documento con otra consulta.",
    listLabel: "Sus autorizaciones de documentos",
    loading: "Cargando autorizaciones …",
    loadError: "No se pudieron cargar sus autorizaciones.",
    retry: "Intentar de nuevo",
  },

  fields: {
    document: "Documento",
    sourcePractice: "Consulta de origen",
    targetPractice: "Consulta destinataria",
    status: "Estado",
    grantedAt: "Compartido el",
    revokedAt: "Revocado el",
    expiresAt: "Válido hasta",
  },

  status: {
    active: "Activo",
    revoked: "Revocado",
    expired: "Caducado",
  },

  share: {
    action: "Compartir con una consulta",
    dialogTitle: "Compartir el documento con una consulta",
    selectPractice: "Seleccionar consulta",
    selectPlaceholder: "Elija una opción",
    readOnlyNotice:
      "La consulta seleccionada recibe únicamente acceso de lectura a este documento. No puede modificarlo, eliminarlo ni transmitirlo.",
    readOnly: "Acceso de lectura",
    confirm: "Compartir",
    cancel: "Cancelar",
    submitting: "Compartiendo …",
    success: "Compartido correctamente.",
    noOtherPractice:
      "No hay ninguna otra consulta activa con la que compartir este documento.",
    alreadyShared: "Este documento ya está compartido con esta consulta.",
    ariaLabel: "Compartir el documento {document} con {practice}",
  },

  revoke: {
    action: "Revocar la autorización",
    dialogTitle: "Revocar la autorización",
    confirm: "Revocar",
    cancel: "Cancelar",
    submitting: "Revocando …",
    success: "Revocación correcta.",
    notice:
      "Tras la revocación, la consulta destinataria ya no puede abrir ni descargar el documento a través de MedScoutX.",
    externalCopies:
      "Las copias ya guardadas fuera de MedScoutX no pueden recuperarse automáticamente por medios técnicos.",
    ariaLabel: "Revocar la autorización del documento {document} para {practice}",
  },

  practiceView: {
    sharedByPatient: "Compartido por el paciente",
    origin: "Origen: {practice}",
    readOnlyHint:
      "Acceso de lectura. Este documento pertenece a otra consulta y fue compartido por la paciente o el paciente.",
  },

  errors: {
    document_not_found: "El documento no está disponible.",
    link_not_found: "Este vínculo con la consulta no está disponible.",
    link_not_active: "Este vínculo con la consulta no está activo.",
    document_already_available_to_practice:
      "Este documento ya procede de esa consulta.",
    share_already_active: "Este documento ya está compartido con esta consulta.",
    grant_not_found: "Esta autorización no está disponible.",
    unsupported_field: "La solicitud contenía datos inesperados.",
    forbidden: "No tiene la autorización necesaria.",
    server_error: "Se ha producido un error. Inténtelo de nuevo más tarde.",
  },
};
