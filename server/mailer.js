import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendMail({ to, subject, html }) {
  const msg = {
    to,
    from: "no-reply@medscout.app", 
    subject,
    html,
  };
  await sgMail.send(msg);
}
