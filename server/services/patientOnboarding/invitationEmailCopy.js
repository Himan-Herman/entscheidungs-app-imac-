/**
 * The wording of a practice invitation email.
 *
 * WHAT THIS EMAIL MAY CONTAIN, and nothing else:
 *   - the practice's display name
 *   - a neutral statement that an invitation exists
 *   - the secure link
 *   - when it expires
 *   - how to accept it, in three plain steps
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
 * whole design avoids everywhere else. So the subject says only that "your
 * practice" invites you, via MedScoutX — recognisable as genuine, and the same
 * for every practice — and the practice is named in the body, one step further
 * in.
 *
 * THE ADDRESS STAYS VISIBLE. The button is there because a patient on a phone
 * should not have to aim at a long string; the full URL is printed right below
 * it, so where the link goes can still be read before tapping — a button alone
 * would be indistinguishable from phishing.
 *
 * The link carries the token in the FRAGMENT (`#token=`). A fragment is never
 * sent to a server, so the credential stays out of web-server logs, out of
 * referrer headers, and out of any analytics the frontend might load.
 *
 * [Juristische Prüfung erforderlich] for the final wording in every language.
 */

const COPY = {
  de: {
    subject: () => "Einladung Ihrer Praxis über MedScoutX",
    greeting: "Guten Tag,",
    body: (practice) =>
      `${practice} möchte Sie über MedScoutX mit der Praxis verbinden.`,
    button: "Einladung öffnen",
    action: "Einladung öffnen:",
    linkFallback: "Falls der Knopf nicht funktioniert, öffnen Sie diese Adresse:",
    stepsTitle: "So einfach geht es:",
    steps: [
      "Tippen Sie auf „Einladung öffnen“.",
      "Melden Sie sich an – oder erstellen Sie ein Konto.",
      "Tippen Sie auf „Verbinden“. Fertig.",
    ],
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
    subject: () => "An invitation from your practice via MedScoutX",
    greeting: "Hello,",
    body: (practice) =>
      `${practice} would like to connect with you through MedScoutX.`,
    button: "Open invitation",
    action: "Open the invitation:",
    linkFallback: "If the button does not work, open this address:",
    stepsTitle: "It only takes a moment:",
    steps: [
      "Tap “Open invitation”.",
      "Sign in – or create an account.",
      "Tap “Connect”. That's it.",
    ],
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
    subject: () => "Invitation de votre cabinet via MedScoutX",
    greeting: "Bonjour,",
    body: (practice) =>
      `${practice} souhaite se connecter avec vous via MedScoutX.`,
    button: "Ouvrir l'invitation",
    action: "Ouvrir l'invitation :",
    linkFallback: "Si le bouton ne fonctionne pas, ouvrez cette adresse :",
    stepsTitle: "C'est très simple :",
    steps: [
      "Touchez « Ouvrir l'invitation ».",
      "Connectez-vous – ou créez un compte.",
      "Touchez « Connecter ». C'est tout.",
    ],
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
    subject: () => "Invito del suo studio tramite MedScoutX",
    greeting: "Buongiorno,",
    body: (practice) =>
      `${practice} desidera collegarsi con lei tramite MedScoutX.`,
    button: "Apri l'invito",
    action: "Apra l'invito:",
    linkFallback: "Se il pulsante non funziona, apra questo indirizzo:",
    stepsTitle: "È semplicissimo:",
    steps: [
      "Tocchi «Apri l'invito».",
      "Acceda – oppure crei un account.",
      "Tocchi «Collega». Fatto.",
    ],
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
    subject: () => "Invitación de su consulta a través de MedScoutX",
    greeting: "Hola:",
    body: (practice) =>
      `${practice} desea conectarse con usted a través de MedScoutX.`,
    button: "Abrir la invitación",
    action: "Abrir la invitación:",
    linkFallback: "Si el botón no funciona, abra esta dirección:",
    stepsTitle: "Es muy sencillo:",
    steps: [
      "Toque «Abrir la invitación».",
      "Inicie sesión o cree una cuenta.",
      "Toque «Conectar». Listo.",
    ],
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
    subject: () => "Приглашение от вашей практики через MedScoutX",
    greeting: "Здравствуйте,",
    body: (practice) =>
      `${practice} хочет установить с вами связь через MedScoutX.`,
    button: "Открыть приглашение",
    action: "Открыть приглашение:",
    linkFallback: "Если кнопка не работает, откройте этот адрес:",
    stepsTitle: "Это очень просто:",
    steps: [
      "Нажмите «Открыть приглашение».",
      "Войдите в систему или создайте учётную запись.",
      "Нажмите «Подключить». Готово.",
    ],
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

/*
 * The HTML is table-based with inline styles: that is what renders the same in
 * Outlook, Gmail and the iOS mail app. The colour pair (#0f766e on white, white
 * on #0f766e) clears WCAG AA at body size. No images: a blocked image must not
 * hide the only way in, and a remote image would be a read receipt.
 */
const C = {
  page: "#f1f5f9",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#475569",
  accent: "#0f766e",
  line: "#e2e8f0",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function renderHtml({ t, practice, link, expiresInDays, lang }) {
  const steps = t.steps
    .map(
      (step, i) => `<tr>
                  <td valign="top" style="padding:0 10px 8px 0;width:26px;">
                    <div style="width:24px;height:24px;border-radius:12px;background:${C.accent};color:#ffffff;font:600 13px/24px ${FONT};text-align:center;">${i + 1}</div>
                  </td>
                  <td valign="top" style="padding:2px 0 8px 0;font:15px/1.5 ${FONT};color:${C.text};">${esc(step)}</td>
                </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(t.subject())}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.page};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.page};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${C.card};border-radius:16px;border:1px solid ${C.line};">
            <tr>
              <td style="padding:20px 28px;border-bottom:1px solid ${C.line};font:700 18px/1.2 ${FONT};color:${C.accent};letter-spacing:.01em;">MedScoutX</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px 28px;font:16px/1.6 ${FONT};color:${C.text};">
                <p style="margin:0 0 12px 0;">${esc(t.greeting)}</p>
                <p style="margin:0 0 24px 0;font-size:18px;line-height:1.45;"><strong>${esc(t.body(practice))}</strong></p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;">
                  <tr>
                    <td style="border-radius:999px;background:${C.accent};">
                      <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font:600 17px/1.2 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px;">${esc(t.button)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 4px 0;font-size:13px;color:${C.muted};">${esc(t.linkFallback)}</p>
                <p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;"><a href="${esc(link)}" style="color:${C.accent};">${esc(link)}</a></p>
                <p style="margin:0 0 10px 0;font-weight:600;">${esc(t.stepsTitle)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px 0;">
${steps}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;border-top:1px solid ${C.line};font:14px/1.55 ${FONT};color:${C.muted};">
                <p style="margin:0 0 8px 0;">${esc(t.expiry(expiresInDays))}</p>
                <p style="margin:0 0 8px 0;">${esc(t.control)}</p>
                <p style="margin:0 0 8px 0;">${esc(t.consent)}</p>
                <p style="margin:0 0 8px 0;">${esc(t.ignore)}</p>
                <p style="margin:12px 0 0 0;font-size:12px;">${esc(t.noReply)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * @param {{ practiceName: string, link: string, expiresInDays: number,
 *           locale?: string|null }} args
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildInvitationEmail({ practiceName, link, expiresInDays, locale }) {
  const requested = String(locale || "").slice(0, 2).toLowerCase();
  const lang = COPY[requested] ? requested : FALLBACK;
  const t = COPY[lang];
  const practice = String(practiceName || "").trim();

  const lines = [
    t.greeting,
    "",
    t.body(practice),
    "",
    t.action,
    link,
    "",
    t.stepsTitle,
    ...t.steps.map((step, i) => `${i + 1}. ${step}`),
    "",
    t.expiry(expiresInDays),
    t.control,
    t.consent,
    "",
    t.ignore,
    t.noReply,
  ];

  return {
    subject: t.subject(),
    text: lines.join("\n"),
    html: renderHtml({ t, practice, link, expiresInDays, lang }),
  };
}

/** Exposed so tests can assert every language is present and complete. */
export const SUPPORTED_EMAIL_LOCALES = Object.keys(COPY);
