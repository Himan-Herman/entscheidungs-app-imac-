/**
 * Organisational appointment event email copy — DE/EN/FR/IT/ES.
 *
 * Allowed:  practiceName, formattedDate, status, organisational disclaimer.
 * Forbidden: symptoms, diagnosis, therapy, patientNote, cancellationReason,
 *            urgency, AI output, any clinical content.
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
    },
  },
};

/**
 * Build a transactional appointment event email.
 *
 * @param {'request'|'confirmed'|'declined'|'cancelledByPatient'} emailEvent
 * @param {'de'|'en'|'fr'|'it'|'es'} locale
 * @param {{ practiceName: string, formattedDate?: string | null }} data
 * @returns {{ subject: string, text: string, html: string } | null}
 */
export function appointmentEventEmail(emailEvent, locale, { practiceName, formattedDate }) {
  const L = COPY[locale] || COPY.de;
  const tpl = L.events[emailEvent];
  if (!tpl) return null;

  const pn = practiceName || "MedScoutX";
  const subject = tpl.subject(pn);
  const bodyLine = tpl.body(pn, formattedDate || null);
  const text = `${bodyLine}\n\n${L.disclaimer}`;
  const html = buildHtml({
    subject,
    locale,
    paragraphs: [bodyLine],
    footerLines: [L.disclaimer],
  });

  return { subject, text, html };
}
