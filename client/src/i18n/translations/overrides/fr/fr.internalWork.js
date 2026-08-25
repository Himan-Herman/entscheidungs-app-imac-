/**
 * Phases 5A–5C en français — notes internes, relances et centre de notifications.
 *
 * « Relance » plutôt que « suivi » : il s'agit d'un repère de travail pour
 * l'équipe, jamais d'un suivi médical, et le mot ne doit pas suggérer une
 * urgence clinique. « Établissement » suit la terminologie déjà en place.
 */
export const frInternalWork = {
  practiceInternalWork: {
    sectionTitle: "Notes internes et relances",
    teamOnlyBadge: "Réservé à l'équipe de l'établissement",
    teamOnlyExplainer:
      "Ces éléments sont visibles uniquement par votre équipe, et seulement dans cette relation patient. Ils ne sont ni affichés ni transmis au patient.",

    notesTitle: "Notes internes",
    noteComposerLabel: "Rédiger une note interne",
    noteComposerHint: "N'est pas envoyée au patient.",
    notePlaceholder: "p. ex. rappel à faire, compte rendu à demander",
    notePlaceholderShort: "Note interne",
    saveNote: "Enregistrer la note",
    editNote: "Modifier",
    edited: "modifiée",
    notesEmpty: "Aucune note interne pour l'instant.",
    unknownAuthor: "Équipe de l'établissement",

    remindersTitle: "Relances",
    remindersHint:
      "Une relance est un repère de travail pour votre équipe. Le texte n'est pas analysé.",
    reminderTitleLabel: "Que faut-il faire ?",
    reminderPlaceholder: "p. ex. revérifier le 30/08",
    reminderDueLabel: "Échéance",
    saveReminder: "Créer une relance",
    remindersEmpty: "Aucune relance dans cette vue.",
    dueOn: "Échéance :",
    assignedTo: "Responsable :",
    markDone: "Marquer comme terminée",
    statusOpen: "À faire",
    statusDone: "Terminée",
    filterLabel: "Filtrer les relances",
    filter_open: "À faire",
    filter_completed: "Terminées",
    filter_all: "Toutes",

    loading: "Chargement…",
    saving: "Enregistrement…",
    cancel: "Annuler",
    loadError: "Impossible de charger les notes internes et les relances.",
    saveError: "Enregistrement impossible. Veuillez réessayer.",
  },

  notificationCenter: {
    toggleLabel: "Boîte de réception",
    toggleAria: "Ouvrir la boîte de réception",
    toggleAriaWithCount: "Ouvrir la boîte de réception, {count} non lus",
    panelTitle: "Nouveautés pour vous",
    panelTitlePractice: "Nouveautés de l'établissement",
    unreadLabel: "{count} non lus",
    newLabel: "{count} nouveaux",
    unreadOne: "1 non lu",
    newOne: "1 nouveau",
    empty: "Rien de nouveau.",
    emptyHint: "Les nouveaux messages apparaissent ici et dans la boîte de réception.",
    showAll: "Afficher toutes les notifications",
    itemUnread: "Non lu",
    loading: "Chargement…",
    error: "Chargement impossible.",
    retry: "Réessayer",
    remindersHeading: "Relances en cours",
    remindersCount: "{count} en cours",
    remindersOne: "1 en cours",
    remindersLink: "Ouvrir dans la liste des patients",
    remindersNone: "Aucune relance en cours",
  },

  practicePatients: {
    tabInternalWork: "Notes internes",
    filterOpenReminders: "Relances en cours",
    filterOpenRemindersYes: "Avec relances en cours",
    filterOpenRemindersNo: "Sans relance en cours",
    openRemindersBadge: "{count} en cours",
    openRemindersAria: "{count} relances en cours",
    internalNotesBadge: "{count} notes",
    internalNotesAria: "{count} notes internes de l'équipe",
  },
};

export default frInternalWork;
