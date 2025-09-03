// server/routes/auth.js
import express from "express";
import crypto from "crypto";

export const authRouter = express.Router();

const INSURANCE_WHITELIST = new Set(["gesetzlich", "privat", "sonstiges"]);

function isMinor(dobStr) {
  const dob = new Date(dobStr);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age < 18;
}

// Healthcheck optional
authRouter.get("/health", (_req, res) => res.json({ ok: true, route: "auth" }));

authRouter.post("/register", (req, res) => {
  try {
    const { user, profile = {}, consent = {}, doctors = [] } = req.body ?? {};

    // Pflichtfelder prüfen
    if (!user?.email || !user?.password || !user?.first_name || !user?.last_name || !user?.date_of_birth) {
      return res.status(400).json({ error: "Pflichtfelder fehlen." });
    }

    // In echt: bcrypt/argon2 verwenden
    // const password_hash = await bcrypt.hash(user.password, 10);
    const user_id = crypto.randomUUID();

    // Profil vorbereiten (inkl. Versicherung)
    const profilePrepared = {
      phone: profile.phone ?? null,
      postal_code: profile.postal_code ?? null,
      country: profile.country ?? null,
      insurance_type: INSURANCE_WHITELIST.has(profile.insurance_type) ? profile.insurance_type : null,
    };

    // Consents minimal ablegen (Zeitstempel nur, wenn angehakt)
    const consentPrepared = {
      terms_accepted_at: consent.terms_accepted ? new Date().toISOString() : null,
      privacy_accepted_at: consent.privacy_accepted ? new Date().toISOString() : null,
      medical_disclaimer_accepted_at: consent.medical_disclaimer_accepted ? new Date().toISOString() : null,
      doctor_alert_consent: !!consent.doctor_alert_consent,
    };

    // Ärzte-Liste vorbereiten (optional)
    const preparedDoctors = Array.isArray(doctors)
      ? doctors.map((d) => ({
          doctor_id: crypto.randomUUID(),
          user_id,
          name: d.name?.trim() || null,
          specialty: d.specialty?.trim() || null,
          clinic_name: d.clinic_name?.trim() || null,
          email_secure: d.email_secure?.trim() || null,
          phone: d.phone?.trim() || null,
          address: d.address?.trim() || null,
          allow_alerts: !!d.allow_alerts,
          last_contacted_at: null,
        }))
      : [];

    // TODO: In DB speichern (user, profilePrepared, consentPrepared, preparedDoctors)

    return res.json({
      ok: true,
      user_id,
      email_verified: false,
      is_minor: isMinor(user.date_of_birth),
      saved_profile: { insurance_type: profilePrepared.insurance_type },
      doctors_saved: preparedDoctors.length,
    });
  } catch (err) {
    console.error("[/register]", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});
