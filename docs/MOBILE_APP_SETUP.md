# MedScoutX Mobile App (Capacitor) — Stand & nächste Schritte

Die Web-App ist jetzt zusätzlich als native iOS- und Android-App verpackt (Capacitor 8).
**Eine Codebasis** — kein zweiter Client, kein Rewrite. Der Web-Auftritt ist unverändert.

- **App-ID (Bundle Identifier):** `com.medscoutx.app` — nach der ersten Store-Veröffentlichung dauerhaft
- **App-Name:** MedScoutX
- **Android:** minSdk 24 (Android 7), targetSdk 36
- **iOS:** Deployment Target 15.0, Swift Package Manager (CocoaPods wird **nicht** benötigt)

---

## Was bereits erledigt und verifiziert ist

| Punkt | Status |
|---|---|
| Native Projekte `client/ios` + `client/android` | angelegt, `cap doctor` grün |
| API-Adressen funktionieren in der App | verifiziert: alle Aufrufe gehen absolut an die API |
| Web-Verhalten unverändert | verifiziert: relative Pfade + Service Worker wie bisher |
| CORS erlaubt die App-Origins | verifiziert, fremde Origins bleiben blockiert |
| Service Worker in der App deaktiviert | verifiziert (verhindert veraltete Assets nach Updates) |
| Berechtigungen | nur `INTERNET` — bewusst minimal für die Store-Prüfung |

---

## Was Du selbst tun musst

### 1. Xcode installieren (nur für iOS)
Aktuell sind nur die Command Line Tools installiert — **Xcode fehlt**, deshalb konnte die
iOS-App hier nicht gebaut werden.

1. Xcode aus dem Mac App Store installieren (mehrere GB)
2. Danach einmalig:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. Android Studio installieren (nur für Android)
Das Android SDK fehlt auf diesem Rechner. Android Studio installieren, beim ersten Start
das SDK mitinstallieren lassen.

> Hinweis: Auf dem Rechner läuft Java 24. Der Android-Gradle-Build erwartet üblicherweise
> JDK 17 oder 21. Falls der Build scheitert, in Android Studio unter
> *Settings → Build Tools → Gradle* das gebündelte JDK 17/21 auswählen.

### 3. API-Adresse für den App-Build setzen
Die App bündelt ihre Web-Dateien lokal und spricht die API **absolut** an. Die Adresse wird
zur Bauzeit gesetzt:

```bash
cd client && VITE_API_BASE_URL="https://api.medscout.app" npm run mobile:sync
```

Ohne gesetzte Variable greift der Fallback `https://api.medscout.app` aus `src/lib/apiBase.js`.

### 4. Server-Umgebung ergänzen
Damit die App auf die Produktions-API zugreifen darf, muss die Web-Domain in `CORS_ORIGIN`
stehen. Die beiden App-Origins (`https://localhost`, `capacitor://localhost`) werden vom
Server **automatisch** ergänzt — dort ist nichts zu tun.

```
CORS_ORIGIN=https://app.medscout.app
```

### 5. App-Icons und Startbildschirm
Noch nicht gesetzt (aktuell Capacitor-Standard). Empfohlen:

```bash
cd client && npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#0d9488" --splashBackgroundColor "#ffffff"
```
Dafür ein Quell-Icon unter `client/assets/icon.png` (1024×1024) ablegen.

### 6. Signierung (nur Du kannst das)
- **iOS:** In Xcode unter *Signing & Capabilities* Dein Apple-Developer-Team wählen.
- **Android:** Upload-Keystore erzeugen und in `android/key.properties` hinterlegen.
  **Den Keystore sicher sichern** — geht er verloren, kann die App nie wieder aktualisiert werden.

---

## Täglicher Arbeitsablauf

```bash
cd client
npm run mobile:sync       # Web bauen + in beide native Projekte übernehmen
npm run mobile:ios        # bauen, syncen, Xcode öffnen
npm run mobile:android    # bauen, syncen, Android Studio öffnen
npm run mobile:doctor     # Setup prüfen
```

Nach **jeder** Änderung am Web-Code ist ein `mobile:sync` nötig, sonst zeigt die App den
alten Stand.

---

## Wichtig für die Store-Prüfung

- **Noch keine Gesundheits-Berechtigungen anfordern.** HealthKit / Health Connect kommen erst
  mit Phase 2. Apple lehnt Apps ab, die Berechtigungen deklarieren, aber nicht nutzen.
- **Datenschutzerklärung ist Pflicht** — URL wird in beiden Stores abgefragt.
- **Google Play** verlangt zusätzlich das Formular *Datensicherheit* (Health-Daten deklarieren).
- **MDR-Grenze halten:** Werte werden dokumentiert und weitergeleitet — keine Auswertung,
  keine Warnung, keine Triage. Das hält die App außerhalb der Medizinprodukte-Einstufung.

---

## Phase 2 (noch offen): Daten von Apple Watch / Samsung

Erst hierfür werden die Gesundheits-Berechtigungen ergänzt:

- **iOS:** HealthKit-Capability + `NSHealthShareUsageDescription` in `Info.plist`
- **Android:** Health-Connect-Berechtigungen im Manifest + Datenschutz-Erklärungs-Activity
- Gelesene Werte werden auf die 6 unterstützten Messgrößen normalisiert und an
  `POST /api/patient/wearables/import` gesendet (Backend steht bereits und ist getestet).
