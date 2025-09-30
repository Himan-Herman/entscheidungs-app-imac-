import { ServerClient } from 'postmark';

const client = new ServerClient(process.env.POSTMARK_API_TOKEN);

export async function sendVerificationEmail(to, verifyUrl) {
  return client.sendEmail({
    From: process.env.EMAIL_FROM, // z.B. "MedScout <no-reply@medscout.app>"
    To: to,
    Subject: 'Bitte E-Mail verifizieren',
    TextBody: `Hallo,\nE-Mail jetzt bestätigen: ${verifyUrl}\nGültig 24 Stunden.`,
    HtmlBody: `<p>Hallo,</p><p><a href="${verifyUrl}">E-Mail jetzt bestätigen</a></p><p>Gültig 24 Stunden.</p>`,
    MessageStream: 'outbound',
  });
}
