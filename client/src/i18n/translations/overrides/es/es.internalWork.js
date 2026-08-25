/**
 * Fases 5A–5C en español — notas internas, recordatorios y centro de notificaciones.
 *
 * «Recordatorio» y no «seguimiento»: es una marca de trabajo del equipo, nunca
 * un seguimiento clínico, y la palabra no debe sugerir urgencia médica.
 * «Centro» sigue la terminología ya establecida. Tratamiento de usted.
 */
export const esInternalWork = {
  practiceInternalWork: {
    sectionTitle: "Notas internas y recordatorios",
    teamOnlyBadge: "Solo para el equipo del centro",
    teamOnlyExplainer:
      "Estas entradas solo las ve su equipo, y únicamente dentro de esta relación con el paciente. No se muestran ni se envían al paciente.",

    notesTitle: "Notas internas",
    noteComposerLabel: "Escribir una nota interna",
    noteComposerHint: "No se envía al paciente.",
    notePlaceholder: "p. ej. llamada pendiente, pedir informe",
    notePlaceholderShort: "Nota interna",
    saveNote: "Guardar nota",
    editNote: "Editar",
    edited: "editada",
    notesEmpty: "Todavía no hay notas internas.",
    unknownAuthor: "Equipo del centro",

    remindersTitle: "Recordatorios",
    remindersHint:
      "Un recordatorio es una marca de trabajo para su equipo. El texto no se analiza.",
    reminderTitleLabel: "¿Qué hay que hacer?",
    reminderPlaceholder: "p. ej. volver a revisar el 30/08",
    reminderDueLabel: "Fecha límite",
    saveReminder: "Crear recordatorio",
    remindersEmpty: "No hay recordatorios en esta vista.",
    dueOn: "Vence:",
    assignedTo: "Responsable:",
    markDone: "Marcar como hecho",
    statusOpen: "Pendiente",
    statusDone: "Hecho",
    filterLabel: "Filtrar recordatorios",
    filter_open: "Pendientes",
    filter_completed: "Hechos",
    filter_all: "Todos",

    loading: "Cargando…",
    saving: "Guardando…",
    cancel: "Cancelar",
    loadError: "No se han podido cargar las notas internas y los recordatorios.",
    saveError: "No se ha podido guardar. Inténtelo de nuevo.",
  },

  notificationCenter: {
    toggleLabel: "Bandeja de entrada",
    toggleAria: "Abrir la bandeja de entrada",
    toggleAriaWithCount: "Abrir la bandeja de entrada, {count} sin leer",
    panelTitle: "Novedades para usted",
    panelTitlePractice: "Novedades del centro",
    unreadLabel: "{count} sin leer",
    newLabel: "{count} nuevos",
    unreadOne: "1 sin leer",
    newOne: "1 nuevo",
    empty: "Nada nuevo.",
    emptyHint: "Los mensajes nuevos aparecen aquí y en la bandeja de entrada.",
    showAll: "Ver todas las notificaciones",
    itemUnread: "Sin leer",
    loading: "Cargando…",
    error: "No se ha podido cargar.",
    retry: "Reintentar",
    remindersHeading: "Recordatorios pendientes",
    remindersCount: "{count} pendientes",
    remindersOne: "1 pendiente",
    remindersLink: "Abrir en la lista de pacientes",
    remindersNone: "No hay recordatorios pendientes",
  },

  practicePatients: {
    tabInternalWork: "Notas internas",
    filterOpenReminders: "Recordatorios pendientes",
    filterOpenRemindersYes: "Con pendientes",
    filterOpenRemindersNo: "Sin pendientes",
    openRemindersBadge: "{count} pendientes",
    openRemindersAria: "{count} recordatorios pendientes",
    internalNotesBadge: "{count} notas",
    internalNotesAria: "{count} notas internas del equipo",
  },
};

export default esInternalWork;
