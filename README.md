# MedScout 

*MedScout* ist eine webbasierte Entscheidungs-App im Rahmen des Praxissemesters an der HRW.  
Ziel ist eine KI-gestützte, barrierefreie Anwendung zur Symptomerfassung und ärztlichen Entscheidungshilfe.

---

# Features (aktuell implementiert)

- *Startseite* mit Navigation
- *Körperkarte (Vorder- und Rückseite, SVG)**: klickbare Regionen zur Symptomauswahl
- *KI-Chat mit Threads* 
  - geführte Konversation (3–5 Rückfragen, dann Facharzt-Empfehlung)  
  - getrennte Chatbereiche: Symptome, Bildanalyse, Körperregion
- *Bildanalyse* (KI erkennt Veränderungen, Nutzer kann beschreiben)
- *Spracherkennung & Voice-Input*
- *Warenkorb-ähnlicher Verlauf*: Speicherung von Symptomen
- *Saubere Ordnerstruktur* (`src/pages`, `routes/`, `prompts/` etc.)

---

# Technologien

- *Frontend**: React, React Router, JSX, CSS (barrierefrei, responsiv)  
- *Backend**: Node.js + Express  
- *KI-Integration**: OpenAI API (geplant: GPT-4o, aktuell qwen:4b/Ollama lokal)  
- *Speech Recognition**: Web Speech API  
- *Versionierung**: GitHub, direkte Commits auf main



---

# Geplante Erweiterungen

-  *Registrierungsseite**  
  - Name, Vorname, Geburtsdatum (+ Hinweis bei <18 Jahre)  
  - Adresse, Hausarzt + weitere Ärzte, Kontaktdaten  
  - Profilbild & Abmelde-Button  

- *Einstellungen/Profil**  
  - Arzt hinzufügen  
  - Kontaktinformationen ändern  

- *Arzt-Benachrichtigung**  
  - automatische Mitteilung bei kritischen Symptomen  

- *UX/UI Verbesserungen**  
  - Emojis & Avatar-Feedback im Chat  
  - Placeholder & Barrierefreiheits-Optimierung  
  - Kamera-Direktzugriff beim Bildupload  

-  *Dokumentation**  
  - Pflege README  
  - Praxissemester-Bericht (laufend)



#  Installation & Start

```bash
# Frontend starten
cd client
npm install
npm run dev

# Backend starten
cd server
npm install
node app.js
