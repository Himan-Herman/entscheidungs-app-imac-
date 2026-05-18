/**
 * Protects internal worker/cron endpoints — not for browser clients.
 * Set WORKER_CRON_SECRET in environment; pass Bearer token or X-Worker-Secret header.
 */

export function requireWorkerCronAuth(req, res, next) {
  const expected = process.env.WORKER_CRON_SECRET;
  if (!expected || !String(expected).trim()) {
    return res.status(503).json({
      ok: false,
      error: "worker_not_configured",
    });
  }

  const auth = String(req.headers.authorization || "");
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  const headerSecret = String(req.headers["x-worker-secret"] || "").trim();
  const provided = bearer || headerSecret;

  if (!provided || provided !== expected.trim()) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  return next();
}
