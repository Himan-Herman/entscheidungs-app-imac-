/**
 * Organisational appointment event email copy — DE/EN/FR/IT/ES.
 *
 * Allowed:  practiceName, formattedDate, status, organisational disclaimer,
 *           practice contact details, organisational cancellation note.
 * Forbidden: symptoms, diagnosis, therapy, patientNote, urgency, AI output,
 *            any clinical content.
 */

/** HTML-escape a plain-text value before embedding in HTML. */
function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml({ subject, locale, paragraphs, footerLines }) {
  const ps = paragraphs
    .map((p) => `<p style="margin:0 0 12px 0;">${esc(p)}</p>`)
    .join("\n              ");
  const fl = footerLines
    .map((l) => `<p style="margin:0 0 4px 0;">${esc(l)}</p>`)
    .join("\n              ");
  return `<!DOCTYPE html>
<html lang="${esc(locale)}">
  <head><meta charset="UTF-8" /><title>${esc(subject)}</title></head>
  <body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.06);overflow:hidden;" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:20px 28px 12px 28px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#ffffff;">
                <div style="font-size:18px;font-weight:600;letter-spacing:0.03em;">MedScoutX</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px 28px;color:#111827;font-size:15px;line-height:1.6;">
              ${ps}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 20px 28px;border-top:1px solid #f0f0f0;color:#9ca3af;font-size:11px;line-height:1.5;">
              ${fl}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const COPY = {
  de: {
    disclaimer:
      "Diese Nachricht enthält keine medizinischen Informationen und ersetzt keine ärztliche Beratung. Im Notfall rufen Sie bitte den Notruf (112).",
    dateLabel: "Termin",
    events: {
      request: {
        subject: (p) => `Terminanfrage empfangen – ${p}`,
        body: (p) =>
          `Ihre Terminanfrage bei ${p} ist eingegangen. Die Praxis wird sich bei Ihnen melden. Dies ist noch keine verbindliche Terminbestätigung.`,
      },
      confirmed: {
        subject: (p) => `Termin bestätigt – ${p}`,
        body: (p, d) =>
          `Ihr Termin bei ${p} wurde bestätigt.${d ? ` Termin: ${d}.` : ""}`,
      },
      declined: {
        subject: (p) => `Terminanfrage nicht bestätigt – ${p}`,
        body: (p) =>
          `Ihre Terminanfrage bei ${p} konnte leider nicht bestätigt werden. Bitte wenden Sie sich direkt an die Praxis.`,
      },
      cancelledByPatient: {
        subject: (p) => `Terminabsage registriert – ${p}`,
        body: (p) =>
          `Ihre Absage des Termins bei ${p} wurde registriert.`,
      },
      cancelledByPractice: {
        subject: (p) => `Ihr Termin bei ${p} wurde abgesagt`,
        body: (p, d, opts) => {
          const lines = [];
          lines.push(`Ihr Termin${d ? ` am ${d}` : ""} bei ${p} wurde von der Praxis abgesagt.`);
          if (opts?.cancellationReason) {
            lines.push(`Hinweis: ${opts.cancellationReason}`);
          }
          const c = opts?.practiceContact;
          if (c && (c.phone || c.email || c.address)) {
            lines.push("Bei Fragen wenden Sie sich bitte direkt an die Praxis:");
            if (c.phone) lines.push(`Telefon: ${c.phone}`);
            if (c.email) lines.push(`E-Mail: ${c.email}`);
            if (c.address) lines.push(`Adresse: ${c.address}`);
          } else {
            lines.push("Bitte kontaktieren Sie die Praxis über die bekannten Kontaktwege.");
          }
          return lines;
        },
      },
    },
  },
  en: {
    disclaimer:
      "This message contains no medical information and does not replace medical advice. In an emergency, call the emergency services.",
    dateLabel: "Appointment",
    events: {
      request: {
        subject: (p) => `Appointment request received – ${p}`,
        body: (p) =>
          `Your appointment request at ${p} has been received. The practice will get back to you. This is not yet a confirmed appointment.`,
      },
      confirmed: {
        subject: (p) => `Appointment confirmed – ${p}`,
        body: (p, d) =>
          `Your appointment at ${p} has been confirmed.${d ? ` Appointment: ${d}.` : ""}`,
      },
      declined: {
        subject: (p) => `Appointment request not confirmed – ${p}`,
        body: (p) =>
          `Unfortunately, your appointment request at ${p} could not be confirmed. Please contact the practice directly to arrange a new appointment.`,
      },
      cancelledByPatient: {
        subject: (p) => `Appointment cancellation confirmed – ${p}`,
        body: (p) =>
          `Your cancellation of the appointment at ${p} has been registered.`,
      },
      cancelledByPractice: {
        subject: (p) => `Your appointment at ${p} has been cancelled`,
        body: (p, d, opts) => {
          const lines = [];
          lines.push(`Your appointment${d ? ` on ${d}` : ""} at ${p} has been cancelled by the practice.`);
          if (opts?.cancellationReason) {
            lines.push(`Note: ${opts.cancellationReason}`);
          }
          const c = opts?.practiceContact;
          if (c && (c.phone || c.email || c.address)) {
            lines.push("Please contact the practice directly if you have any questions:");
            if (c.phone) lines.push(`Phone: ${c.phone}`);
            if (c.email) lines.push(`Email: ${c.email}`);
            if (c.address) lines.push(`Address: ${c.address}`);
          } else {
            lines.push("Please contact the practice through your usual channels.");
          }
          return lines;
        },
      },
    },
  },
  fr: {
    disclaimer:
      "Ce message ne contient pas d'informations médicales et ne remplace pas un avis médical. En cas d'urgence, appelez les secours.",
    dateLabel: "Rendez-vous",
    events: {
      request: {
        subject: (p) => `Demande de rendez-vous reçue – ${p}`,
        body: (p) =>
          `Votre demande de rendez-vous auprès de ${p} a bien été reçue. Le cabinet vous recontactera. Il ne s'agit pas encore d'une confirmation.`,
      },
      confirmed: {
        subject: (p) => `Rendez-vous confirmé – ${p}`,
        body: (p, d) =>
          `Votre rendez-vous auprès de ${p} a été confirmé.${d ? ` Date : ${d}.` : ""}`,
      },
      declined: {
        subject: (p) => `Demande de rendez-vous non confirmée – ${p}`,
        body: (p) =>
          `Votre demande de rendez-vous auprès de ${p} n'a malheureusement pas pu être confirmée. Veuillez contacter directement le cabinet.`,
      },
      cancelledByPatient: {
        subject: (p) => `Annulation de rendez-vous enregistrée – ${p}`,
        body: (p) =>
          `Votre annulation du rendez-vous auprès de ${p} a bien été enregistrée.`,
      },
      cancelledByPractice: {
        subject: (p) => `Votre rendez-vous auprès de ${p} a été annulé`,
        body: (p, d, opts) => {
          const lines = [];
          lines.push(`Votre rendez-vous${d ? ` du ${d}` : ""} auprès de ${p} a été annulé par le cabinet.`);
          if (opts?.cancellationReason) {
            lines.push(`Remarque : ${opts.cancellationReason}`);
          }
          const c = opts?.practiceContact;
          if (c && (c.phone || c.email || c.address)) {
            lines.push("Pour toute question, veuillez contacter directement le cabinet :");
            if (c.phone) lines.push(`Téléphone : ${c.phone}`);
            if (c.email) lines.push(`E-mail : ${c.email}`);
            if (c.address) lines.push(`Adresse : ${c.address}`);
          } else {
            lines.push("Veuillez contacter le cabinet via vos coordonnées habituelles.");
          }
          return lines;
        },
      },
    },
  },
  it: {
    disclaimer:
      "Questo messaggio non contiene informazioni mediche e non sostituisce il parere medico. In caso di emergenza, chiamare il numero di soccorso.",
    dateLabel: "Appuntamento",
    events: {
      request: {
        subject: (p) => `Richiesta di appuntamento ricevuta – ${p}`,
        body: (p) =>
          `La sua richiesta di appuntamento presso ${p} è stata ricevuta. Lo studio la ricontatterà. Non si tratta ancora di una conferma.`,
      },
      confirmed: {
        subject: (p) => `Appuntamento confermato – ${p}`,
        body: (p, d) =>
          `Il suo appuntamento presso ${p} è stato confermato.${d ? ` Data: ${d}.` : ""}`,
      },
      declined: {
        subject: (p) => `Richiesta di appuntamento non confermata – ${p}`,
        body: (p) =>
          `Purtroppo la sua richiesta di appuntamento presso ${p} non ha potuto essere confermata. La preghiamo di contattare direttamente lo studio.`,
      },
      cancelledByPatient: {
        subject: (p) => `Cancellazione appuntamento registrata – ${p}`,
        body: (p) =>
          `La sua cancellazione dell'appuntamento presso ${p} è stata registrata.`,
      },
      cancelledByPractice: {
        subject: (p) => `Il suo appuntamento presso ${p} è stato annullato`,
        body: (p, d, opts) => {
          const lines = [];
          lines.push(`Il suo appuntamento${d ? ` del ${d}` : ""} presso ${p} è stato annullato dallo studio.`);
          if (opts?.cancellationReason) {
            lines.push(`Nota: ${opts.cancellationReason}`);
          }
          const c = opts?.practiceContact;
          if (c && (c.phone || c.email || c.address)) {
            lines.push("Per domande, la preghiamo di contattare direttamente lo studio:");
            if (c.phone) lines.push(`Telefono: ${c.phone}`);
            if (c.email) lines.push(`E-mail: ${c.email}`);
            if (c.address) lines.push(`Indirizzo: ${c.address}`);
          } else {
            lines.push("La preghiamo di contattare lo studio tramite i consueti canali.");
          }
          return lines;
        },
      },
    },
  },
  es: {
    disclaimer:
      "Este mensaje no contiene información médica y no reemplaza el consejo médico. En caso de emergencia, llame a los servicios de emergencia.",
    dateLabel: "Cita",
    events: {
      request: {
        subject: (p) => `Solicitud de cita recibida – ${p}`,
        body: (p) =>
          `Su solicitud de cita en ${p} ha sido recibida. La consulta se pondrá en contacto con usted. Esto no es todavía una cita confirmada.`,
      },
      confirmed: {
        subject: (p) => `Cita confirmada – ${p}`,
        body: (p, d) =>
          `Su cita en ${p} ha sido confirmada.${d ? ` Fecha: ${d}.` : ""}`,
      },
      declined: {
        subject: (p) => `Solicitud de cita no confirmada – ${p}`,
        body: (p) =>
          `Lamentablemente, su solicitud de cita en ${p} no ha podido ser confirmada. Por favor, contacte directamente con la consulta.`,
      },
      cancelledByPatient: {
        subject: (p) => `Cancelación de cita registrada – ${p}`,
        body: (p) =>
          `La cancelación de su cita en ${p} ha quedado registrada.`,
      },
      cancelledByPractice: {
        subject: (p) => `Su cita en ${p} ha sido cancelada`,
        body: (p, d, opts) => {
          const lines = [];
          lines.push(`Su cita${d ? ` del ${d}` : ""} en ${p} ha sido cancelada por la consulta.`);
          if (opts?.cancellationReason) {
            lines.push(`Nota: ${opts.cancellationReason}`);
          }
          const c = opts?.practiceContact;
          if (c && (c.phone || c.email || c.address)) {
            lines.push("Si tiene alguna pregunta, póngase en contacto directamente con la consulta:");
            if (c.phone) lines.push(`Teléfono: ${c.phone}`);
            if (c.email) lines.push(`Correo: ${c.email}`);
            if (c.address) lines.push(`Dirección: ${c.address}`);
          } else {
            lines.push("Por favor, contacte con la consulta a través de los canales habituales.");
          }
          return lines;
        },
      },
    },
  },
};

/**
 * Build a transactional appointment event email.
 *
 * @param {'request'|'confirmed'|'declined'|'cancelledByPatient'|'cancelledByPractice'} emailEvent
 * @param {'de'|'en'|'fr'|'it'|'es'} locale
 * @param {{ practiceName: string, formattedDate?: string|null, cancellationReason?: string|null, practiceContact?: {phone?:string|null, email?:string|null, address?:string|null}|null }} data
 * @returns {{ subject: string, text: string, html: string } | null}
 */
export function appointmentEventEmail(emailEvent, locale, { practiceName, formattedDate, cancellationReason, practiceContact }) {
  const L = COPY[locale] || COPY.de;
  const tpl = L.events[emailEvent];
  if (!tpl) return null;

  const pn = practiceName || "MedScoutX";
  const subject = tpl.subject(pn);
  const rawBody = tpl.body(pn, formattedDate || null, {
    cancellationReason: cancellationReason || null,
    practiceContact: practiceContact || null,
  });
  const bodyLines = Array.isArray(rawBody) ? rawBody : [rawBody];
  const text = [...bodyLines, "", L.disclaimer].join("\n");
  const html = buildHtml({
    subject,
    locale,
    paragraphs: bodyLines,
    footerLines: [L.disclaimer],
  });

  return { subject, text, html };
}

/**
 * Build a practice-facing notification email when a patient cancels.
 * Always in German — practice staff language defaults to DE.
 *
 * @param {string} practiceName
 * @param {string|null} formattedDate
 * @param {string|null} cancellationReason  Organisational note only — no medical evaluation.
 * @returns {{ subject: string, text: string, html: string }}
 */
export function practicePatientCancelledEmail(practiceName, formattedDate, cancellationReason) {
  const pn = practiceName || "MedScoutX";
  const disclaimer =
    "Dies ist eine automatische organisatorische Mitteilung. Sie enthält keine medizinischen Informationen.";
  const subject = `Termin-Stornierung durch Patienten – ${pn}`;
  const lines = [];
  lines.push(
    `Ein Patient hat seinen Termin${formattedDate ? ` am ${formattedDate}` : ""} bei ${pn} storniert.`,
  );
  if (cancellationReason) {
    lines.push(`Stornohinweis (organisatorisch): ${cancellationReason}`);
  }
  const text = [...lines, "", disclaimer].join("\n");
  const html = buildHtml({
    subject,
    locale: "de",
    paragraphs: lines,
    footerLines: [disclaimer],
  });
  return { subject, text, html };
}
