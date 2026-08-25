/**
 * Entry point of last resort.
 *
 * `package.json` names this file as `main`, so anything that starts the server
 * without going through the `start` script — `node .`, a host that honours the
 * `main` field, a developer in a hurry — lands here.
 *
 * It used to build a SECOND Express app of its own: `cors()` with no origin
 * allowlist, a 50 MB JSON body limit, no security headers, and two routes
 * mounted without authentication — one of them `/api/textsymptom`, which the
 * real server serves behind `requireAuth`. Starting the wrong file therefore
 * published an authenticated product route to the open internet, and nothing
 * in the code said so.
 *
 * There is only one server now. This file loads it, so every entry point gets
 * the same CORS allowlist, the same helmet configuration, the same
 * authentication and the same rate limits.
 */
import "./app.js";
