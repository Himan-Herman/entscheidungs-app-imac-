# Domain sync: medscoutx.com ↔ medscoutx.app ↔ medscout.app

## Zielarchitektur

- **Ein** Vercel-Projekt (Root: `client/`)
- **Ein** Production-Deployment pro Release
- **Alle** Marketing-Domains als Aliase auf dasselbe Deployment
- **Ein** API-Backend (`api.medscout.app` auf Render)
- Hashed Assets (`/assets/index-*.js`) immutable; `index.html` + `sw.js` nicht lang cachen

## Live-Check (2026-05-26)

Alle geprüften Hosts liefern **identisch**:

| Host | ETag (index.html) | Last-Modified | Main bundle |
|------|-------------------|---------------|-------------|
| www.medscoutx.com | `1bef5de5…` | 2026-05-26 20:42:19 UTC | `index-BkUXxICp.js` |
| www.medscoutx.app | gleich | gleich | gleich |
| www.medscout.app | gleich | gleich | gleich |

Apex-Domains (`medscoutx.com`, `medscoutx.app`, `medscout.app`) → 307/308 auf `www.*`.

**Fazit:** Kein separates Vercel-Projekt pro Domain am CDN — Unterschiede entstehen fast immer durch **lokalen PWA-Service-Worker-Cache**.

## Vercel Dashboard (manuell prüfen)

1. **Project → Settings → Domains**  
   Alle Einträge müssen auf **Production** zeigen (nicht Preview):
   - `medscoutx.com`, `www.medscoutx.com`
   - `medscoutx.app`, `www.medscoutx.app`
   - `medscout.app`, `www.medscout.app`

2. **Project → Settings → Git**  
   Production Branch = `main` (oder Ihr Release-Branch) — nur **ein** Auto-Deploy für Production.

3. **Environment Variables (Production)**  
   Gleiche Werte für alle Deployments:
   - `VITE_API_BASE_URL` (z. B. `https://api.medscout.app`)
   - Kein separates Preview-ENV für .app/.com

## Render CORS

`CORS_ORIGIN` muss **alle** Frontend-Origins enthalten (kommagetrennt):

```
https://www.medscoutx.com,https://medscoutx.com,https://www.medscoutx.app,https://medscoutx.app,https://www.medscout.app,https://medscout.app
```

## PWA / Service Worker

Nach Deploy einmal pro Gerät (wenn alte Version sichtbar):

1. DevTools → Application → Service Workers → Unregister  
2. Application → Storage → Clear site data  
3. Hard reload (Cmd+Shift+R)

Ab diesem Release: `runPwaBuildMigration()` in `main.jsx` macht das automatisch, wenn sich `VITE_BUILD_ID` ändert.

## Build-ID prüfen

In Production im Seitenquelltext:

```html
<meta name="medscout-build-id" content="…commit-sha…" />
```

Muss auf .com und .app **identisch** sein.

## Cache-Header (`client/vercel.json`)

- `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest` → `max-age=0, must-revalidate`
- `/assets/*` → `immutable` (hash im Dateinamen)
