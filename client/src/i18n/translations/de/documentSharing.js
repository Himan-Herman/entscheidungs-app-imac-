export default {
  sharedData: {
    title: "Geteilte Daten",
    description:
      "Dokumente, die Sie gezielt für eine weitere Praxis freigegeben haben. Sie können jede Freigabe jederzeit widerrufen.",
    empty: "Sie haben bisher kein Dokument für eine weitere Praxis freigegeben.",
    listLabel: "Ihre Dokumentfreigaben",
    loading: "Freigaben werden geladen …",
    loadError: "Ihre Freigaben konnten nicht geladen werden.",
    retry: "Erneut versuchen",
  },

  fields: {
    document: "Dokument",
    sourcePractice: "Herkunftspraxis",
    targetPractice: "Zielpraxis",
    status: "Status",
    grantedAt: "Freigegeben am",
    revokedAt: "Widerrufen am",
    expiresAt: "Gültig bis",
  },

  status: {
    active: "Aktiv",
    revoked: "Widerrufen",
    expired: "Abgelaufen",
  },

  share: {
    action: "Mit einer Praxis teilen",
    dialogTitle: "Dokument mit einer Praxis teilen",
    selectPractice: "Praxis auswählen",
    selectPlaceholder: "Bitte wählen",
    readOnlyNotice:
      "Die ausgewählte Praxis erhält ausschließlich Lesezugriff auf dieses Dokument. Sie kann es nicht verändern, löschen oder weitergeben.",
    readOnly: "Lesezugriff",
    confirm: "Freigeben",
    cancel: "Abbrechen",
    submitting: "Wird freigegeben …",
    success: "Freigabe erfolgreich.",
    noOtherPractice:
      "Es ist keine andere aktive Praxis verfügbar, mit der Sie dieses Dokument teilen könnten.",
    alreadyShared: "Dieses Dokument ist bereits mit dieser Praxis geteilt.",
    ariaLabel: "Dokument {document} mit {practice} teilen",
  },

  revoke: {
    action: "Freigabe widerrufen",
    dialogTitle: "Freigabe widerrufen",
    confirm: "Widerrufen",
    cancel: "Abbrechen",
    submitting: "Wird widerrufen …",
    success: "Widerruf erfolgreich.",
    notice:
      "Nach dem Widerruf kann die Zielpraxis das Dokument nicht mehr über MedScoutX öffnen oder herunterladen.",
    externalCopies:
      "Bereits außerhalb von MedScoutX gespeicherte Kopien können technisch nicht automatisch zurückgerufen werden.",
    ariaLabel: "Freigabe des Dokuments {document} für {practice} widerrufen",
  },

  practiceView: {
    sharedByPatient: "Vom Patienten freigegeben",
    origin: "Herkunft: {practice}",
    readOnlyHint:
      "Lesezugriff. Dieses Dokument gehört einer anderen Praxis und wurde von der Patientin oder dem Patienten freigegeben.",
  },

  errors: {
    document_not_found: "Das Dokument ist nicht verfügbar.",
    link_not_found: "Diese Praxisverbindung ist nicht verfügbar.",
    link_not_active: "Diese Praxisverbindung ist nicht aktiv.",
    document_already_available_to_practice:
      "Dieses Dokument stammt bereits aus dieser Praxis.",
    share_already_active: "Dieses Dokument ist bereits mit dieser Praxis geteilt.",
    grant_not_found: "Diese Freigabe ist nicht verfügbar.",
    unsupported_field: "Die Anfrage enthielt unerwartete Angaben.",
    forbidden: "Dazu fehlt Ihnen die Berechtigung.",
    server_error: "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
  },
};
