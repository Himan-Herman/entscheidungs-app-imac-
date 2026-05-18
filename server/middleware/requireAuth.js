// src/middleware/requireAuth.js
import jwt from 'jsonwebtoken';
import { logSecurityEventThrottled } from '../services/security/securityEventService.js';

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Bearer JWT from Authorization header (primary).
 * Optional cookie branch reserved for a future HttpOnly cookie + BFF same-site setup —
 * do not enable cookie-parser until migration is ready (see TODO in client authFetch / auth routes).
 */
export function requireAuth(req, res, next) {
  try {
    // 1) Token aus Header holen: "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Optional: später, falls du HttpOnly-Cookies nutzt
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Kein Token → 401
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Nicht autorisiert: Kein Token übergeben.',
      });
    }

    // 2) Token prüfen
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) User-Infos an Request hängen
    req.user = decoded;

    // 4) weiter zur Route
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logSecurityEventThrottled(`invalid_token:${clientIp(req)}`, {
        req,
        eventType: 'invalid_token',
        metadata: { reason: 'expired', path: req.path },
      });
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Nicht autorisiert: Anmeldesitzung abgelaufen.",
      });
    }
    if (err.name === "JsonWebTokenError") {
      logSecurityEventThrottled(`invalid_token:${clientIp(req)}`, {
        req,
        eventType: 'invalid_token',
        metadata: { reason: 'invalid', path: req.path },
      });
      return res.status(401).json({
        success: false,
        code: "TOKEN_INVALID",
        message: "Nicht autorisiert: Ungültiger Token.",
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("Auth-Fehler:", err.message);
    }

    return res.status(401).json({
      success: false,
      code: "AUTH_ERROR",
      message: "Nicht autorisiert: Ungültiger oder abgelaufener Token.",
    });
  }
}
