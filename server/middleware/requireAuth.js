// src/middleware/requireAuth.js
import jwt from 'jsonwebtoken';

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
    console.error('Auth-Fehler:', err.message);

    return res.status(401).json({
      success: false,
      message: 'Nicht autorisiert: Ungültiger oder abgelaufener Token.',
    });
  }
}
