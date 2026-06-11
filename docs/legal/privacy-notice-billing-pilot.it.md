# Informativa sulla privacy — Plausibilità di fatturazione GOÄ/PKV (pilota) — BOZZA

> ⚠️ **BOZZA DI TRADUZIONE — REVISIONE LEGALE RICHIESTA PRIMA DELLA PUBBLICAZIONE.**
> Questa è una **bozza** di traduzione della versione tedesca di riferimento; **non**
> costituisce consulenza legale, **non** è vincolante e **non** è definitiva. La
> versione di riferimento è quella tedesca
> ([`privacy-notice-billing-pilot.de.md`](privacy-notice-billing-pilot.de.md)). È
> richiesta una revisione indipendente (DPO/legale) prima della pubblicazione. I
> segnaposto `«tra parentesi angolari»` devono essere compilati prima.
>
> Documenti correlati: [bozza AVV/DPA](avv-dpa-medscoutx-pilot.de.md) ·
> [TOM](tom-medscoutx-pilot.de.md) ·
> [Subincaricati](subprocessors-medscoutx-pilot.de.md)

---

## 1. Titolare / Responsabile del trattamento

- **Studio (Titolare):** `«nome, indirizzo, contatto»` — titolare dei dati di
  fatturazione e di contesto inseriti durante il pilota.
- **MedScoutX (Responsabile):** `«società operatrice, indirizzo, contatto»` — tratta i
  dati **per conto e su istruzione** dello studio sulla base di un accordo di trattamento
  (AVV/DPA, vedi [bozza](avv-dpa-medscoutx-pilot.de.md)).
- **Contatto protezione dati:** `«e-mail / DPO se nominato»`
- L'assegnazione finale dei ruoli è da confermare in sede di revisione legale.

---

## 2. Finalità

- Supporto alla **plausibilità di fatturazione** (GOÄ/PKV)
- Generazione di **avvisi/indicazioni deterministici**
- Generazione di un **rapporto PDF**
- Supporto a **esportazione, cancellazione e conservazione** (diritti degli interessati)
- **Registrazione, audit e sicurezza interni**

---

## 3. Categorie di dati personali

- Identificatori di account/personale (`createdByUserId`, `actorUserId`)
- Identificatori del profilo dello studio (`practiceProfileId`)
- Codice GOÄ, fattore, quantità
- **Testo di contesto libero** facoltativo (`contextText`)
- Metadati di avviso/risultato
- Metadati di corrispondenza del catalogo
- Metadati del rapporto PDF
- Metadati del log di audit
- Log tecnici
- **Metadati della revisione IA** — solo se l'IA è attivata internamente (disattivata di
  default esternamente, vedi §5)

---

## 4. Dati che NON devono essere inseriti

Nessun identificatore del paziente deve essere inserito — in particolare nel campo
libero `contextText`:

- Nome del paziente
- Data di nascita
- Numero di assicurazione
- Testo diagnostico completo
- Testo clinico libero
- Altri identificatori diretti del paziente

I campi paziente denominati vengono rifiutati dal sistema (HTTP 400). Il campo libero non
può impedire tecnicamente l'inserimento di dati del paziente — lo studio lo garantisce
mediante la **formazione** del personale.

---

## 5. Stato dell'IA

- La revisione assistita da IA è **disattivata di default** per le pratiche esterne
  (`ENABLE_BILLING_AI_REVIEW=false`).
- L'IA è utilizzata **solo internamente/staging** e solo su accordo separato.
- Un'attivazione successiva richiede OpenAI come subincaricato divulgato, una base
  giuridica documentata e una valutazione del trasferimento (vedi AVV §15).
- Gli output IA sono **non vincolanti** e **non** costituiscono una decisione medica,
  legale o di rimborso.

---

## 6. Basi giuridiche (segnaposto)

- **Per lo studio (titolare):** base giuridica `«da confermare da studio/legale»` —
  probabilmente esecuzione del contratto (art. 6, par. 1, lett. b GDPR) o legittimo
  interesse (art. 6, par. 1, lett. f GDPR).
- **Per MedScoutX (responsabile):** trattamento in base all'AVV/DPA e alle istruzioni
  dello studio.
- La base giuridica definitiva è determinata solo dopo la revisione legale; questa bozza
  **non** rende alcuna dichiarazione vincolante.

---

## 7. Destinatari / Subincaricati

- Provider di hosting/compute: `«da confermare»`
- Provider di database/hosting: `«da confermare»`
- Provider e-mail: `«da confermare, se utilizzato»`
- **OpenAI:** solo se l'IA è attivata (disattivata di default esternamente)
- Dettagli: [appendice subincaricati](subprocessors-medscoutx-pilot.de.md). I provider
  non confermati sono contrassegnati come "da confermare" e non vengono inventati.

---

## 8. Conservazione e cancellazione

- **Periodo di conservazione:** raccomandazione **180 giorni**
  (`BILLING_SESSION_RETENTION_DAYS=180`, indicativo) — da finalizzare da studio/DPO.
  **Nessuna** purga automatica; la conservazione è applicata tramite uno script manuale (D5).
- **Cancellazione account:** la cancellazione completa dell'account rimuove i dati di
  fatturazione associati nella stessa transazione (D2).
- **Cancellazione operatore:** cancellazione mirata per studio/utente/sessione tramite
  uno script operatore con dry-run e protezione di produzione (D4).
- **Esportazione:** esportazione JSON rispettosa della privacy dei propri dati di
  sessione (D3; `contextText` grezzo escluso).

---

## 9. Diritti degli interessati

Fatte salve le condizioni di legge, avete i diritti di:

- Accesso (art. 15 GDPR)
- Rettifica (art. 16)
- Cancellazione (art. 17)
- Limitazione (art. 18)
- Portabilità (art. 20)
- Opposizione ove applicabile (art. 21)
- Reclamo a un'autorità di controllo (art. 77)

Contatto per l'esercizio: `«titolare / contatto protezione dati»`.

---

## 10. Sicurezza

- Controllo degli accessi e accesso allo studio basato sui ruoli (solo titolare/admin)
- Crittografia in transito (TLS, da confermare lato provider)
- Log di audit per gli eventi del ciclo di vita delle sessioni
- Script operatore con dry-run di default e protezione di produzione
- **Nessun** connettore PVS/FHIR/KIS in produzione senza approvazione separata
- Dettagli: [appendice TOM](tom-medscoutx-pilot.de.md)

---

## 11. Ambito e limiti

- Supporto alla plausibilità **non vincolante**
- Utilizza un **sottoinsieme locale del catalogo GOÄ** (non una fonte ufficiale completa)
- **Nessuna** diagnosi
- **Nessuna** raccomandazione terapeutica
- **Nessun** triage
- **Nessuna** garanzia/previsione di rimborso
- **Nessuna** decisione di fatturazione giuridicamente vincolante

---

*Stato: **BOZZA DI TRADUZIONE — revisione legale richiesta prima della pubblicazione.**
In caso di discrepanza prevale la versione tedesca di riferimento.*
