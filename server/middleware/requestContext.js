/**
 * Request correlation id + structured access logs (path only — no query/body).
 */

import { randomUUID } from "crypto";

function pathnameOnly(originalUrl) {
  if (!originalUrl || typeof originalUrl !== "string") return "/";
  const q = originalUrl.indexOf("?");
  return q === -1 ? originalUrl : originalUrl.slice(0, q);
}

/**
 * Sets req.requestId, echoes X-Request-Id, logs JSON line on response finish.
 * Does not log request bodies, transcripts, PDFs, or medical text.
 */
export function requestContextMiddleware(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.requestId =
    typeof incoming === "string" && incoming.trim().length > 0
      ? incoming.trim().slice(0, 80)
      : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const path = pathnameOnly(req.originalUrl || req.url);
    const routePath =
      req.route && typeof req.route.path === "string" ? req.route.path : undefined;
    console.log(
      JSON.stringify({
        level: "info",
        requestId: req.requestId,
        method: req.method,
        path,
        route: routePath,
        status: res.statusCode,
        durationMs,
      }),
    );
  });
  next();
}
