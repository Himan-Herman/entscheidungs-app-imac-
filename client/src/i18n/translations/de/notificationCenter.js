const notificationCenter = {
  // The label deliberately matches the existing "Postfach" wording — the header
  // entry leads to the inbox, so it must not sound like a second, separate place.
  toggleLabel: "Postfach",
  toggleAria: "Postfach öffnen",
  toggleAriaWithCount: "Postfach öffnen, {count} ungelesen",
  panelTitle: "Neu für Sie",
  panelTitlePractice: "Neu in der Praxis",
  unreadLabel: "{count} ungelesen",
  newLabel: "{count} neu",
  unreadOne: "1 ungelesen",
  newOne: "1 neu",
  empty: "Nichts Neues.",
  emptyHint: "Neue Nachrichten erscheinen hier und im Postfach.",
  showAll: "Alle Benachrichtigungen anzeigen",
  itemUnread: "Ungelesen",
  loading: "Wird geladen …",
  error: "Konnte nicht geladen werden.",
  retry: "Erneut versuchen",
  // Follow-ups are separate work, not mail — worded so the two are never read
  // as one number.
  remindersHeading: "Offene Wiedervorlagen",
  remindersCount: "{count} offen",
  remindersOne: "1 offen",
  remindersLink: "In der Patientenübersicht öffnen",
  remindersNone: "Keine offenen Wiedervorlagen",
};

export default notificationCenter;
