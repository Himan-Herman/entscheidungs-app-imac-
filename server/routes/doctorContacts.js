/**
 * Doctor contacts (Ärztebuch) — authenticated users only.
 * Identity: req.user.userId from JWT; never trust client-supplied user ids.
 *
 * PDF email: sends patient-generated PDF as attachment after explicit multipart consent flag.
 * Audio/text processing note does not apply — PDF is uploaded by the client; nothing stored server-side after send.
 */

import express from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { deliverPrevisitPdfEmail } from '../services/emailQueueService.js';
import { sendPrevisitPdfLimiter } from '../middleware/ipRateLimit.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { trackAnalyticsEvent } from '../services/analyticsService.js';

const router = express.Router();

const MAX_NAME = 120;
const MAX_PRACTICE = 200;
const MAX_SPECIALTY = 120;
const MAX_EMAIL = 254;
const MAX_PHONE = 40;
const MAX_ADDRESS = 500;
const MAX_NOTE = 1000;

const PDF_MAGIC = Buffer.from('%PDF');

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function isValidEmail(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (t.length > MAX_EMAIL) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function bad(res, status, code, message) {
  return res.status(status).json({ ok: false, error: code, message });
}

function rowJson(row) {
  return {
    id: row.id,
    doctorName: row.doctorName,
    practiceName: row.practiceName,
    specialty: row.specialty,
    email: row.email,
    phone: row.phone,
    address: row.address,
    note: row.note,
    isFavorite: Boolean(row.isFavorite),
    lastUsedAt: row.lastUsedAt?.toISOString?.() ?? row.lastUsedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeCreateBody(body) {
  const doctorName =
    typeof body.doctorName === 'string' ? body.doctorName.trim() : '';
  if (!doctorName || doctorName.length > MAX_NAME) {
    return { ok: false, error: 'doctorName_invalid' };
  }

  const practiceName =
    body.practiceName == null || body.practiceName === ''
      ? null
      : String(body.practiceName).trim().slice(0, MAX_PRACTICE) || null;

  const specialty =
    body.specialty == null || body.specialty === ''
      ? null
      : String(body.specialty).trim().slice(0, MAX_SPECIALTY) || null;

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  if (!isValidEmail(emailRaw)) return { ok: false, error: 'email_invalid' };

  const phone =
    body.phone == null || body.phone === ''
      ? null
      : String(body.phone).trim().slice(0, MAX_PHONE) || null;

  const address =
    body.address == null || body.address === ''
      ? null
      : String(body.address).trim().slice(0, MAX_ADDRESS) || null;

  const note =
    body.note == null || body.note === ''
      ? null
      : String(body.note).trim().slice(0, MAX_NOTE) || null;

  return {
    ok: true,
    data: {
      doctorName,
      practiceName,
      specialty,
      email: emailRaw.toLowerCase(),
      phone,
      address,
      note,
      isFavorite: Boolean(body?.isFavorite),
    },
  };
}

function normalizeUpdateBody(body) {
  const data = {};
  if (Object.prototype.hasOwnProperty.call(body, 'doctorName')) {
    const doctorName =
      typeof body.doctorName === 'string' ? body.doctorName.trim() : '';
    if (!doctorName || doctorName.length > MAX_NAME) {
      return { ok: false, error: 'doctorName_invalid' };
    }
    data.doctorName = doctorName;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'practiceName')) {
    data.practiceName =
      body.practiceName == null || body.practiceName === ''
        ? null
        : String(body.practiceName).trim().slice(0, MAX_PRACTICE) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'specialty')) {
    data.specialty =
      body.specialty == null || body.specialty === ''
        ? null
        : String(body.specialty).trim().slice(0, MAX_SPECIALTY) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
    if (!isValidEmail(emailRaw)) return { ok: false, error: 'email_invalid' };
    data.email = emailRaw.toLowerCase();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    data.phone =
      body.phone == null || body.phone === ''
        ? null
        : String(body.phone).trim().slice(0, MAX_PHONE) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'address')) {
    data.address =
      body.address == null || body.address === ''
        ? null
        : String(body.address).trim().slice(0, MAX_ADDRESS) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'note')) {
    data.note =
      body.note == null || body.note === ''
        ? null
        : String(body.note).trim().slice(0, MAX_NOTE) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isFavorite')) {
    data.isFavorite = Boolean(body.isFavorite);
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'no_fields' };
  }
  return { ok: true, data };
}

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const okMime =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf';
    if (okMime) {
      cb(null, true);
      return;
    }
    cb(new Error('UNSUPPORTED_PDF'));
  },
});

function isPdfBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf)) return false;
  if (buf.length < 5) return false;
  return buf.subarray(0, 4).equals(PDF_MAGIC);
}

/**
 * GET / — list contacts for current user
 */
router.get('/', async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

  try {
    const rows = await prisma.doctorContact.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ ok: true, contacts: rows.map(rowJson) });
  } catch (err) {
    console.error('[doctor-contacts] list', err?.message);
    return bad(res, 500, 'server_error', 'Server error.');
  }
});

/**
 * POST / — create contact
 */
router.post('/', async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

  const norm = normalizeCreateBody(req.body ?? {});
  if (!norm.ok) return bad(res, 400, norm.error, 'Invalid input.');

  try {
    const row = await prisma.doctorContact.create({
      data: { userId, ...norm.data },
    });
    writeAuditLog({
      req,
      userId,
      action: 'doctor_contact_created',
      entityType: 'DoctorContact',
      entityId: row.id,
      metadata: {},
    });
    return res.status(201).json({ ok: true, contact: rowJson(row) });
  } catch (err) {
    console.error('[doctor-contacts] create', err?.message);
    return bad(res, 500, 'server_error', 'Server error.');
  }
});

/**
 * POST /:id/send-previsit-pdf — explicit-consent email with PDF attachment (must be registered BEFORE GET /:id)
 *
 * Rate limit before multer: curbs email abuse and large-upload spam; protects SMTP/API cost.
 */
router.post(
  '/:id/send-previsit-pdf',
  sendPrevisitPdfLimiter,
  (req, res, next) => {
    uploadPdf.single('pdf')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return bad(res, 400, 'file_too_large', 'File too large.');
      }
      return bad(res, 400, 'invalid_pdf', 'A PDF file is required.');
    });
  },
  async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

    const consent =
      req.body?.emailSendConsent === true ||
      req.body?.emailSendConsent === 'true';
    if (!consent) {
      return bad(
        res,
        400,
        'consent_required',
        'Explicit consent is required before sending.'
      );
    }

    if (!req.file?.buffer || !isPdfBuffer(req.file.buffer)) {
      return bad(res, 400, 'invalid_pdf', 'Invalid PDF file.');
    }

    const { id } = req.params;
    const rawLocale =
      typeof req.body?.locale === 'string' ? req.body.locale : '';
    const locale = rawLocale.toLowerCase().startsWith('de') ? 'de' : 'en';

    try {
      const contact = await prisma.doctorContact.findFirst({
        where: { id, userId },
      });
      if (!contact) {
        return bad(res, 404, 'not_found', 'Contact not found.');
      }
      if (!contact.email || !isValidEmail(contact.email)) {
        return bad(res, 400, 'email_missing', 'Contact has no valid email.');
      }

      const pdfName =
        locale === 'en' ? 'medscoutx-pre-visit.pdf' : 'medscoutx-arztgespraech.pdf';

      const subject =
        locale === 'en'
          ? 'MedScoutX — document for your appointment preparation'
          : 'MedScoutX — Dokument zur Terminvorbereitung';

      const practiceLine = contact.practiceName
        ? locale === 'en'
          ? `Practice: ${contact.practiceName}`
          : `Praxis: ${contact.practiceName}`
        : '';

      const text =
        locale === 'en'
          ? `Hello,

Please find attached a structured preparation document from a MedScoutX user for an upcoming appointment.

This document reflects only the patient’s own statements. It is not a diagnosis, treatment recommendation or urgency assessment.

Recipient contact on file: ${contact.doctorName}${practiceLine ? `\n${practiceLine}` : ''}

— MedScoutX`
          : `Guten Tag,

anbei erhalten Sie ein strukturiertes Vorbereitungsdokument eines MedScoutX-Nutzers für einen bevorstehenden Termin.

Das Dokument spiegelt ausschließlich die eigenen Angaben der Patientin oder des Patienten wider. Es stellt keine Diagnose, keine Therapieempfehlung und keine Dringlichkeitseinschätzung dar.

Kontakt in der App hinterlegt: ${contact.doctorName}${practiceLine ? `\n${practiceLine}` : ''}

— MedScoutX`;

      await deliverPrevisitPdfEmail({
        to: contact.email,
        subject,
        text,
        pdfFilename: pdfName,
        pdfBuffer: req.file.buffer,
      });

      await prisma.doctorContact.update({
        where: { id: contact.id },
        data: { lastUsedAt: new Date() },
      });

      const rawSid =
        typeof req.body?.preVisitSessionId === 'string'
          ? req.body.preVisitSessionId.trim()
          : '';
      let practiceForPdf = null;
      let sessionForPdf = null;
      if (rawSid) {
        const srow = await prisma.preVisitSession.findFirst({
          where: { id: rawSid, userId },
          select: { id: true, practiceProfileId: true },
        });
        if (srow) {
          sessionForPdf = srow.id;
          practiceForPdf = srow.practiceProfileId;
        }
      }
      void trackAnalyticsEvent({
        eventType: 'previsit_pdf_sent',
        userId,
        practiceId: practiceForPdf || undefined,
        sessionId: sessionForPdf || undefined,
        metadata: { emailSent: true },
      });

      writeAuditLog({
        req,
        userId,
        action: 'pdf_sent',
        entityType: 'DoctorContact',
        entityId: id,
        metadata: { locale },
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('[doctor-contacts] send-previsit-pdf', err?.message ?? err);
      const msg =
        err?.message === 'RESEND_NOT_CONFIGURED'
          ? 'Email service is not configured.'
          : 'Email could not be sent.';
      return bad(res, 502, 'send_failed', msg);
    }
  }
);

/**
 * POST /:id/touch — mark contact as recently used (dashboard ordering)
 */
router.post('/:id/touch', async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

  const { id } = req.params;
  try {
    const existing = await prisma.doctorContact.findFirst({
      where: { id, userId },
    });
    if (!existing) return bad(res, 404, 'not_found', 'Not found.');
    await prisma.doctorContact.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[doctor-contacts] touch', err?.message);
    return bad(res, 500, 'server_error', 'Server error.');
  }
});

/**
 * GET /:id — single contact
 */
router.get('/:id', async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

  const { id } = req.params;
  try {
    const row = await prisma.doctorContact.findFirst({
      where: { id, userId },
    });
    if (!row) return bad(res, 404, 'not_found', 'Not found.');
    return res.json({ ok: true, contact: rowJson(row) });
  } catch (err) {
    console.error('[doctor-contacts] get', err?.message);
    return bad(res, 500, 'server_error', 'Server error.');
  }
});

/**
 * PUT /:id — update
 */
router.put('/:id', async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

  const { id } = req.params;
  const norm = normalizeUpdateBody(req.body ?? {});
  if (!norm.ok) return bad(res, 400, norm.error, 'Invalid input.');

  try {
    const existing = await prisma.doctorContact.findFirst({
      where: { id, userId },
    });
    if (!existing) return bad(res, 404, 'not_found', 'Not found.');

    const updated = await prisma.doctorContact.update({
      where: { id },
      data: norm.data,
    });
    return res.json({ ok: true, contact: rowJson(updated) });
  } catch (err) {
    console.error('[doctor-contacts] update', err?.message);
    return bad(res, 500, 'server_error', 'Server error.');
  }
});

/**
 * DELETE /:id
 */
router.delete('/:id', async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, 'unauthorized', 'Unauthorized.');

  const { id } = req.params;
  try {
    const result = await prisma.doctorContact.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) return bad(res, 404, 'not_found', 'Not found.');
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('[doctor-contacts] delete', err?.message);
    return bad(res, 500, 'server_error', 'Server error.');
  }
});

export default router;
