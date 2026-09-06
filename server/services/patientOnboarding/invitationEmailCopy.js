/**
 * The wording of a practice invitation email.
 *
 * WHAT THIS EMAIL MAY CONTAIN, and nothing else:
 *   - the practice's display name
 *   - a neutral statement that an invitation exists
 *   - the secure link
 *   - when it expires
 *
 * WHAT IT MUST NEVER CONTAIN: any medical content, any diagnosis or reason for
 * treatment, the date of birth, the patient's name, the practice-internal chart
 * number, the entry id, the invitation id — anything that identifies a person or
 * says something about their health. Email is not a confidential channel; it can
 * sit unencrypted on a shared mailbox, be forwarded, or be read on a screen in a
 * shared office. So the message is written to be harmless when read by the wrong
 * person: it reveals only that some practice sent an invitation, and the link
 * itself proves nothing without an account and a deliberate claim.
 *
 * THE SUBJECT LINE NAMES NO PRACTICE. A subject is the one part of an email that
 * is visible without opening it — on a lock screen, in a notification, in a
 * shared mailbox list, over someone's shoulder. For a specialist practice the
 * name alone can imply a health condition, which is exactly the inference this
 * whole design avoids everywhere else. So the subject is neutral and the
 * practice is named in the body, one step further in.
 *
 * The link carries the token in the FRAGMENT (`#token=`). A fragment is never
 * sent to a server, so the credential stays out of web-server logs, out of
 * referrer headers, and out of any analytics the frontend might load.
 *
 * [Juristische Prüfung erforderlich] for the final wording in every language.
 */

const COPY = {
  de: {
    subject: () => "Ihre Einladung",
    greeting: "Guten Tag,",
    body: (practice) =>
      `${practice} möchte Sie über MedScoutX mit der Praxis verbinden.`,
    action: "Einladung öffnen:",
    expiry: (days) =>
      `Der Link ist ${days} Tage gültig. Danach benötigen Sie eine neue Einladung Ihrer Praxis.`,
    control:
      "Sie entscheiden selbst, ob Sie die Verbindung herstellen. Solange Sie die Einladung nicht bestätigen, passiert nichts.",
    consent:
      "Eine Verbindung allein gibt der Praxis noch keinen Zugriff auf Ihre Daten. Welche Daten Sie freigeben, entscheiden Sie danach in einem eigenen Schritt.",
    ignore:
      "Wenn Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren. Es geschieht dann nichts.",
    noReply: "Diese Nachricht wurde automatisch versendet. Bitte antworten Sie nicht darauf.",
  },
  en: {
    subject: () => "Your invitation",
    greeting: "Hello,",
    body: (practice) =>
      `${practice} would like to connect with you through MedScoutX.`,
    action: "Open the invitation:",
    expiry: (days) =>
      `The link is valid for ${days} days. After that you will need a new invitation from your practice.`,
    control:
      "It is your decision whether to connect. Nothing happens until you confirm the invitation.",
    consent:
      "Connecting alone does not give the practice access to your data. You decide what to share afterwards, in a separate step.",
    ignore:
      "If you were not expecting this email, you can ignore it. Nothing will happen.",
    noReply: "This message was sent automatically. Please do not reply to it.",
  },
  fr: {
    subject: () => "Votre invitation",
    greeting: "Bonjour,",
    body: (practice) =>
      `${practice} souhaite se connecter avec vous via MedScoutX.`,
    action: "Ouvrir l'invitation :",
    expiry: (days) =>
      `Le lien est valable ${days} jours. Passé ce délai, vous aurez besoin d'une nouvelle invitation de votre cabinet.`,
    control:
      "C'est vous qui décidez d'établir la connexion. Rien ne se passe tant que vous n'avez pas confirmé l'invitation.",
    consent:
      "La connexion seule ne donne au cabinet aucun accès à vos données. Vous déciderez ensuite, dans une étape distincte, de ce que vous partagez.",
    ignore:
      "Si vous n'attendiez pas cet e-mail, vous pouvez l'ignorer. Rien ne se produira.",
    noReply: "Ce message a été envoyé automatiquement. Merci de ne pas y répondre.",
  },
  it: {
    subject: () => "Il suo invito",
    greeting: "Buongiorno,",
    body: (practice) =>
      `${practice} desidera collegarsi con lei tramite MedScoutX.`,
    action: "Apra l'invito:",
    expiry: (days) =>
      `Il link è valido ${days} giorni. Successivamente le servirà un nuovo invito dal suo studio.`,
    control:
      "La decisione di collegarsi è sua. Non accade nulla finché non conferma l'invito.",
    consent:
      "Il collegamento da solo non dà allo studio accesso ai suoi dati. Cosa condividere lo decide dopo, in un passaggio separato.",
    ignore:
      "Se non si aspettava questa email, può ignorarla. Non accadrà nulla.",
    noReply: "Questo messaggio è stato inviato automaticamente. La preghiamo di non rispondere.",
  },
  es: {
    subject: () => "Su invitación",
    greeting: "Hola:",
    body: (practice) =>
      `${practice} desea conectarse con usted a través de MedScoutX.`,
    action: "Abrir la invitación:",
    expiry: (days) =>
      `El enlace es válido durante ${days} días. Después necesitará una nueva invitación de su consulta.`,
    control:
      "Usted decide si establece la conexión. No ocurre nada hasta que confirme la invitación.",
    consent:
      "La conexión por sí sola no da a la consulta acceso a sus datos. Qué comparte lo decide después, en un paso aparte.",
    ignore:
      "Si no esperaba este correo, puede ignorarlo. No ocurrirá nada.",
    noReply: "Este mensaje se ha enviado automáticamente. Por favor, no responda.",
  },
  ru: {
    subject: () => "Ваше приглашение",
    greeting: "Здравствуйте,",
    body: (practice) =>
      `${practice} хочет установить с вами связь через MedScoutX.`,
    action: "Открыть приглашение:",
    expiry: (days) =>
      `Ссылка действительна ${days} дней. После этого вам понадобится новое приглашение от вашей практики.`,
    control:
      "Решение о подключении принимаете вы. Пока вы не подтвердите приглашение, ничего не произойдёт.",
    consent:
      "Само подключение не даёт практике доступа к вашим данным. Что именно открыть, вы решаете отдельным шагом.",
    ignore:
      "Если вы не ожидали это письмо, его можно просто проигнорировать. Ничего не произойдёт.",
    noReply: "Это сообщение отправлено автоматически. Пожалуйста, не отвечайте на него.",
  },
};

const FALLBACK = "de";

/** HTML-escape. The practice name is operator-supplied text, not markup. */
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {{ practiceName: string, link: string, expiresInDays: number,
 *           locale?: string|null }} args
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildInvitationEmail({ practiceName, link, expiresInDays, locale }) {
  const lang = String(locale || "").slice(0, 2).toLowerCase();
  const t = COPY[lang] || COPY[FALLBACK];
  const practice = String(practiceName || "").trim();

  const lines = [
    t.greeting,
    "",
    t.body(practice),
    "",
    t.action,
    link,
    "",
    t.expiry(expiresInDays),
    t.control,
    t.consent,
    "",
    t.ignore,
    t.noReply,
  ];

  const html = [
    `<p>${esc(t.greeting)}</p>`,
    `<p>${esc(t.body(practice))}</p>`,
    // The link text is the URL itself: a patient can read where it goes before
    // clicking, and a masked label would be indistinguishable from phishing.
    `<p>${esc(t.action)}<br><a href="${esc(link)}">${esc(link)}</a></p>`,
    `<p>${esc(t.expiry(expiresInDays))}</p>`,
    `<p>${esc(t.control)}</p>`,
    `<p>${esc(t.consent)}</p>`,
    `<p>${esc(t.ignore)}</p>`,
    `<p><small>${esc(t.noReply)}</small></p>`,
  ].join("\n");

  return { subject: t.subject(), text: lines.join("\n"), html };
}

/** Exposed so tests can assert every language is present and complete. */
export const SUPPORTED_EMAIL_LOCALES = Object.keys(COPY);
