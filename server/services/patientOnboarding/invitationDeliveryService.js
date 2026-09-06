/**
 * Sending an invitation by email.
 *
 * This is a DELIVERY layer and nothing more. It does not create invitations, it
 * does not change their state, and it cannot make an expired one work again. It
 * takes a plaintext token that the caller already holds — the one moment it
 * exists, in the response of the issuing call — and puts it into a message.
 *
 * THE ADDRESS IS NOT AN IDENTITY. `entry.email` is a delivery channel the
 * practice typed in. It is never matched against an account, never used to look
 * anyone up, and being sent an invitation proves nothing about who receives it.
 * Whoever opens the link still has to sign in with their own account and press
 * the connect button themselves. That is why sending here is safe even if the
 * practice mistyped the address: a wrong recipient gets an invitation they can
 * only bind to THEIR own account, and the practice sees who actually claimed.
 *
 * THE SENDER IS ALWAYS OURS. `sendMail` takes its `from` from EMAIL_FROM. The
 * patient's address is only ever a recipient — never spoofed as the sender.
 */

import { sendMail } from "../../emailService.js";
import { prisma } from "../../lib/prisma.js";
import { INVITATION_TTL_DAYS } from "./invitationTokens.js";
import { buildInvitationEmail } from "./invitationEmailCopy.js";
import { practiceDisplayName } from "../../utils/practiceBranding.js";

/**
 * Where the patient-facing app lives. The invitation link points at the
 * FRONTEND, not at the API — the token belongs in a page, not in a request.
 */
function frontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "";
  return String(raw).trim().replace(/\/+$/, "");
}

/**
 * The link the patient receives.
 *
 * The token sits in the fragment. Everything after `#` stays in the browser: it
 * is not sent to the server, so it cannot land in an access log, and it is not
 * forwarded in a Referer header to anything the page loads.
 *
 * @param {string} token
 */
export function buildInvitationUrl(token) {
  const base = frontendBaseUrl();
  if (!base) throw new Error("frontend_url_not_configured");
  return `${base}/patient-invitation#token=${encodeURIComponent(token)}`;
}

/**
 * Everything that can make a send impossible, checked BEFORE an invitation is
 * issued.
 *
 * Order matters here. Issuing supersedes whatever invitation the entry already
 * had, so discovering only afterwards that there is no address would have burnt
 * a working invitation to send nothing. The caller runs this first and only
 * creates a token once it is known the message can actually be addressed.
 *
 * @param {{ entryId: string, practiceProfileId: string }} args
 */
export async function loadDeliverableEntry({ entryId, practiceProfileId }) {
  // Tenant-scoped read: an entry id from another practice must not resolve.
  const entry = await prisma.practicePatientEntry.findFirst({
    where: { id: entryId, practiceProfileId },
    select: {
      email: true,
      archivedAt: true,
      linkedAt: true,
      // The SAME name the public preview shows, via the same helper: the email
      // and the landing page must not disagree about who is inviting.
      practiceProfile: { select: { practiceName: true, displayNameForPatients: true } },
    },
  });

  if (!entry) throw new Error("entry_not_found");
  if (entry.archivedAt) throw new Error("entry_not_claimable");
  if (entry.linkedAt) throw new Error("entry_already_linked");
  if (!String(entry.email || "").trim()) throw new Error("entry_has_no_email");

  return entry;
}

/**
 * Send one invitation to the address stored on the entry.
 *
 * @param {{ entryId: string, practiceProfileId: string, token: string,
 *           locale?: string|null }} args
 * @returns {Promise<{ deliveredTo: string }>} the masked address, for the UI
 */
export async function sendInvitationEmail({ entryId, practiceProfileId, token, locale }) {
  if (!token) throw new Error("validation_token_required");
  const entry = await loadDeliverableEntry({ entryId, practiceProfileId });
  const to = String(entry.email || "").trim();

  const { subject, text, html } = buildInvitationEmail({
    practiceName: practiceDisplayName(entry.practiceProfile || {}),
    link: buildInvitationUrl(token),
    expiresInDays: INVITATION_TTL_DAYS,
    locale,
  });

  // No token, no address and no subject in any log line. `sendMail` records only
  // the provider's own id; adding anything here would undo the point of the
  // fragment. A failure surfaces as a generic error to the caller.
  await sendMail(to, subject, text, html);

  return { deliveredTo: maskEmail(to) };
}

/**
 * `anna.mueller@example.com` -> `a…r@example.com`.
 *
 * The practice typed this address, so it is not new information to them — but
 * echoing it back in full invites shoulder-surfing at a reception desk, and the
 * masked form is enough to answer the only question they have: did it go to the
 * address I meant?
 *
 * @param {string} value
 */
export function maskEmail(value) {
  const raw = String(value || "");
  const at = raw.lastIndexOf("@");
  if (at <= 0) return "";
  const local = raw.slice(0, at);
  const domain = raw.slice(at);
  if (local.length <= 2) return `${local[0]}…${domain}`;
  return `${local[0]}…${local[local.length - 1]}${domain}`;
}
