/**
 * Written lifecycle confirmations — plain-text, data-minimal.
 *
 * HARD CONTENT RULES (mirrors the LifecycleOutboxEmail model comment):
 * - never any medical content, diagnoses, medication, document titles
 * - never internal user ids, practice-patient link ids, tokens, permissions
 * - the only identifiers are the public case number, the practice display
 *   name, and the recipient's own registered e-mail address
 *
 * Params per kind: { caseNumber, actionAt, recipientEmail?, practiceName?,
 * supportEmail }. `actionAt` is a preformatted date-time string.
 */

const LOCALES = ["de", "en", "fr", "it", "es"];

export function normalizeLifecycleLocale(locale) {
  const s = String(locale || "").toLowerCase().slice(0, 2);
  return LOCALES.includes(s) ? s : "de";
}

const T = {
  de: {
    patient_account_deleted: (p) => ({
      subject: `MedScoutX – Bestätigung Ihrer Kontolöschung (${p.caseNumber})`,
      text: `Guten Tag,

hiermit bestätigen wir schriftlich die Löschung Ihres MedScoutX-Patientenkontos.

Vorgangsnummer: ${p.caseNumber}
Datum und Uhrzeit: ${p.actionAt}
Registrierte E-Mail-Adresse: ${p.recipientEmail}
Ausgeführte Aktion: Endgültige Löschung des MedScoutX-Patientenkontos

Ihr Konto, Ihre selbst gespeicherten Patientendaten in MedScoutX, Ihre persönlichen Verbindungen zu Praxen sowie Ihre Freigaben, Zugriffstokens, Einstellungen und Sitzungen wurden gelöscht.

Bitte beachten Sie: Unterlagen, die eine Praxis selbst erstellt hat, bereits heruntergeladene oder exportierte Kopien sowie Daten außerhalb von MedScoutX können außerhalb Ihres Patientenkontos bestehen bleiben. Praxen können eigenen Aufbewahrungspflichten unterliegen.

Bei Fragen erreichen Sie uns unter: ${p.supportEmail}

Mit freundlichen Grüßen
Ihr MedScoutX-Team`,
    }),
    practice_suspended: (p) => ({
      subject: `MedScoutX – Praxis pausiert (${p.caseNumber})`,
      text: `Guten Tag,

Ihre Praxis „${p.practiceName}" wurde bei MedScoutX vorübergehend pausiert.

Vorgangsnummer: ${p.caseNumber}
Aktion: Praxis pausiert
Aktueller Status: pausiert
Zeitpunkt: ${p.actionAt}

Auswirkungen: Der operative Zugriff Ihres Teams wurde beendet. Es sind keine neuen Patientenverbindungen, Freigaben oder klinischen Einträge möglich. Gespeicherte Daten bleiben geschützt erhalten und werden nicht gelöscht.

Nächster Schritt: Sie können die Praxis jederzeit selbst wieder aktivieren (erneute Anmeldung mit Passwortbestätigung erforderlich).

Bei Fragen: ${p.supportEmail}

Mit freundlichen Grüßen
Ihr MedScoutX-Team`,
    }),
    practice_reactivated: (p) => ({
      subject: `MedScoutX – Praxis wieder aktiviert (${p.caseNumber})`,
      text: `Guten Tag,

Ihre Praxis „${p.practiceName}" wurde bei MedScoutX wieder aktiviert.

Vorgangsnummer: ${p.caseNumber}
Aktion: Praxis reaktiviert
Aktueller Status: aktiv
Zeitpunkt: ${p.actionAt}

Hinweis: Zuvor widerrufene Einwilligungen, entzogene Freigaben und entfernte Teamzugänge wurden NICHT automatisch wiederhergestellt. Bitte prüfen Sie Ihre aktuelle Team- und Berechtigungsstruktur.

Bei Fragen: ${p.supportEmail}

Mit freundlichen Grüßen
Ihr MedScoutX-Team`,
    }),
    practice_closed: (p) => ({
      subject: `MedScoutX – Praxis geschlossen (${p.caseNumber})`,
      text: `Guten Tag,

Ihre Praxis „${p.practiceName}" wurde bei MedScoutX geschlossen. Operative Zugriffe wurden beendet. Die Praxis wurde nicht endgültig gelöscht. Eine spätere Reaktivierung kann über ${p.supportEmail} beantragt werden.

Vorgangsnummer: ${p.caseNumber}
Aktion: Praxis geschlossen
Aktueller Status: geschlossen
Zeitpunkt: ${p.actionAt}

Auswirkungen: Die Mitgliedschaft endet. Alle Team-Sitzungen und Zugriffstoken wurden widerrufen. Es sind keine neuen Patientenverbindungen oder Freigaben möglich. Aufbewahrte Daten bleiben geschützt gespeichert.

Bei Fragen: ${p.supportEmail}

Mit freundlichen Grüßen
Ihr MedScoutX-Team`,
    }),
    practice_reactivation_requested: (p) => ({
      subject: `MedScoutX – Eingangsbestätigung Reaktivierungsanfrage (${p.caseNumber})`,
      text: `Guten Tag,

wir bestätigen den Eingang Ihrer Reaktivierungsanfrage für die Praxis „${p.practiceName}".

Vorgangsnummer: ${p.caseNumber}
Aktion: Reaktivierung angefragt
Aktueller Status: Reaktivierung angefragt (in Prüfung)
Zeitpunkt: ${p.actionAt}

MedScoutX prüft Ihre Anfrage und meldet sich bei Ihnen. Frühere Patientenfreigaben, widerrufene Einwilligungen und Teamzugänge werden bei einer Reaktivierung nicht automatisch wiederhergestellt.

Bei Fragen: ${p.supportEmail}

Mit freundlichen Grüßen
Ihr MedScoutX-Team`,
    }),
    practice_deletion_requested: (p) => ({
      subject: `MedScoutX – Eingangsbestätigung Löschanfrage (${p.caseNumber})`,
      text: `Guten Tag,

Ihre endgültige Löschanfrage für die Praxis „${p.practiceName}" wurde registriert. Es wurde noch keine endgültige Löschung durchgeführt. MedScoutX prüft zunächst die notwendigen Aufbewahrungs- und Dokumentationsanforderungen.

Vorgangsnummer: ${p.caseNumber}
Aktion: Endgültige Löschung beantragt
Aktueller Status: Löschanfrage registriert (in Prüfung)
Zeitpunkt: ${p.actionAt}

Bitte bestätigen Sie Ihre Anfrage zusätzlich per E-Mail an ${p.supportEmail} und geben Sie dabei die Vorgangsnummer ${p.caseNumber} an.

Die endgültige Löschung kann nicht rückgängig gemacht werden und erfolgt erst nach Abschluss der Prüfung durch MedScoutX.

Bei Fragen: ${p.supportEmail}

Mit freundlichen Grüßen
Ihr MedScoutX-Team`,
    }),
  },

  en: {
    patient_account_deleted: (p) => ({
      subject: `MedScoutX – confirmation of your account deletion (${p.caseNumber})`,
      text: `Hello,

this is the written confirmation that your MedScoutX patient account has been deleted.

Case number: ${p.caseNumber}
Date and time: ${p.actionAt}
Registered e-mail address: ${p.recipientEmail}
Action performed: permanent deletion of the MedScoutX patient account

Your account, the patient data you stored in MedScoutX, your personal connections to practices, and your shares, access tokens, settings and sessions have been deleted.

Please note: records created by a practice itself, copies already downloaded or exported, and data stored outside MedScoutX may remain outside your patient account. Practices may be subject to their own retention obligations.

Questions? Contact us at: ${p.supportEmail}

Kind regards
Your MedScoutX team`,
    }),
    practice_suspended: (p) => ({
      subject: `MedScoutX – practice paused (${p.caseNumber})`,
      text: `Hello,

your practice "${p.practiceName}" has been temporarily paused on MedScoutX.

Case number: ${p.caseNumber}
Action: practice paused
Current status: paused
Time: ${p.actionAt}

Effects: your team's operative access has ended. No new patient connections, shares or clinical entries are possible. Stored data remains protected and is not deleted.

Next step: you can reactivate the practice yourself at any time (password confirmation required).

Questions? ${p.supportEmail}

Kind regards
Your MedScoutX team`,
    }),
    practice_reactivated: (p) => ({
      subject: `MedScoutX – practice reactivated (${p.caseNumber})`,
      text: `Hello,

your practice "${p.practiceName}" has been reactivated on MedScoutX.

Case number: ${p.caseNumber}
Action: practice reactivated
Current status: active
Time: ${p.actionAt}

Note: previously revoked consents, withdrawn shares and removed team accounts were NOT restored automatically. Please review your current team and permission structure.

Questions? ${p.supportEmail}

Kind regards
Your MedScoutX team`,
    }),
    practice_closed: (p) => ({
      subject: `MedScoutX – practice closed (${p.caseNumber})`,
      text: `Hello,

your practice "${p.practiceName}" has been closed on MedScoutX. Operative access has ended. The practice has NOT been permanently deleted. A later reactivation can be requested via ${p.supportEmail}.

Case number: ${p.caseNumber}
Action: practice closed
Current status: closed
Time: ${p.actionAt}

Effects: the membership ends. All team sessions and access tokens have been revoked. No new patient connections or shares are possible. Retained data remains protected.

Questions? ${p.supportEmail}

Kind regards
Your MedScoutX team`,
    }),
    practice_reactivation_requested: (p) => ({
      subject: `MedScoutX – reactivation request received (${p.caseNumber})`,
      text: `Hello,

we confirm receipt of your reactivation request for the practice "${p.practiceName}".

Case number: ${p.caseNumber}
Action: reactivation requested
Current status: reactivation requested (under review)
Time: ${p.actionAt}

MedScoutX will review your request and get back to you. Former patient shares, revoked consents and team accounts are not restored automatically on reactivation.

Questions? ${p.supportEmail}

Kind regards
Your MedScoutX team`,
    }),
    practice_deletion_requested: (p) => ({
      subject: `MedScoutX – deletion request received (${p.caseNumber})`,
      text: `Hello,

your request for the permanent deletion of the practice "${p.practiceName}" has been registered. No permanent deletion has been performed yet. MedScoutX first reviews the applicable retention and documentation requirements.

Case number: ${p.caseNumber}
Action: permanent deletion requested
Current status: deletion request registered (under review)
Time: ${p.actionAt}

Please additionally confirm your request by e-mail to ${p.supportEmail}, quoting case number ${p.caseNumber}.

A permanent deletion cannot be undone and only takes place after MedScoutX has completed its review.

Questions? ${p.supportEmail}

Kind regards
Your MedScoutX team`,
    }),
  },

  fr: {
    patient_account_deleted: (p) => ({
      subject: `MedScoutX – confirmation de la suppression de votre compte (${p.caseNumber})`,
      text: `Bonjour,

nous confirmons par écrit la suppression de votre compte patient MedScoutX.

Numéro de dossier : ${p.caseNumber}
Date et heure : ${p.actionAt}
Adresse e-mail enregistrée : ${p.recipientEmail}
Action effectuée : suppression définitive du compte patient MedScoutX

Votre compte, les données patient que vous avez enregistrées dans MedScoutX, vos liens personnels avec des cabinets ainsi que vos autorisations, jetons d'accès, paramètres et sessions ont été supprimés.

Veuillez noter : les documents créés par un cabinet lui-même, les copies déjà téléchargées ou exportées et les données stockées en dehors de MedScoutX peuvent subsister en dehors de votre compte patient. Les cabinets peuvent être soumis à leurs propres obligations de conservation.

Des questions ? Contactez-nous : ${p.supportEmail}

Cordialement
Votre équipe MedScoutX`,
    }),
    practice_suspended: (p) => ({
      subject: `MedScoutX – cabinet mis en pause (${p.caseNumber})`,
      text: `Bonjour,

votre cabinet « ${p.practiceName} » a été temporairement mis en pause sur MedScoutX.

Numéro de dossier : ${p.caseNumber}
Action : cabinet mis en pause
Statut actuel : en pause
Date : ${p.actionAt}

Effets : l'accès opérationnel de votre équipe a pris fin. Aucune nouvelle connexion patient, aucun partage ni aucune saisie clinique n'est possible. Les données enregistrées restent protégées et ne sont pas supprimées.

Prochaine étape : vous pouvez réactiver le cabinet vous-même à tout moment (confirmation du mot de passe requise).

Des questions ? ${p.supportEmail}

Cordialement
Votre équipe MedScoutX`,
    }),
    practice_reactivated: (p) => ({
      subject: `MedScoutX – cabinet réactivé (${p.caseNumber})`,
      text: `Bonjour,

votre cabinet « ${p.practiceName} » a été réactivé sur MedScoutX.

Numéro de dossier : ${p.caseNumber}
Action : cabinet réactivé
Statut actuel : actif
Date : ${p.actionAt}

Remarque : les consentements révoqués, les partages retirés et les accès d'équipe supprimés n'ont PAS été rétablis automatiquement. Veuillez vérifier votre structure actuelle d'équipe et d'autorisations.

Des questions ? ${p.supportEmail}

Cordialement
Votre équipe MedScoutX`,
    }),
    practice_closed: (p) => ({
      subject: `MedScoutX – cabinet fermé (${p.caseNumber})`,
      text: `Bonjour,

votre cabinet « ${p.practiceName} » a été fermé sur MedScoutX. Les accès opérationnels ont pris fin. Le cabinet n'a PAS été définitivement supprimé. Une réactivation ultérieure peut être demandée via ${p.supportEmail}.

Numéro de dossier : ${p.caseNumber}
Action : cabinet fermé
Statut actuel : fermé
Date : ${p.actionAt}

Effets : l'adhésion prend fin. Toutes les sessions d'équipe et tous les jetons d'accès ont été révoqués. Aucune nouvelle connexion patient ni aucun partage n'est possible. Les données conservées restent protégées.

Des questions ? ${p.supportEmail}

Cordialement
Votre équipe MedScoutX`,
    }),
    practice_reactivation_requested: (p) => ({
      subject: `MedScoutX – accusé de réception de la demande de réactivation (${p.caseNumber})`,
      text: `Bonjour,

nous confirmons la réception de votre demande de réactivation pour le cabinet « ${p.practiceName} ».

Numéro de dossier : ${p.caseNumber}
Action : réactivation demandée
Statut actuel : réactivation demandée (en cours d'examen)
Date : ${p.actionAt}

MedScoutX examine votre demande et reviendra vers vous. Les anciens partages patients, les consentements révoqués et les accès d'équipe ne sont pas rétablis automatiquement lors d'une réactivation.

Des questions ? ${p.supportEmail}

Cordialement
Votre équipe MedScoutX`,
    }),
    practice_deletion_requested: (p) => ({
      subject: `MedScoutX – accusé de réception de la demande de suppression (${p.caseNumber})`,
      text: `Bonjour,

votre demande de suppression définitive du cabinet « ${p.practiceName} » a été enregistrée. Aucune suppression définitive n'a encore été effectuée. MedScoutX examine d'abord les obligations de conservation et de documentation applicables.

Numéro de dossier : ${p.caseNumber}
Action : suppression définitive demandée
Statut actuel : demande de suppression enregistrée (en cours d'examen)
Date : ${p.actionAt}

Veuillez confirmer votre demande également par e-mail à ${p.supportEmail}, en indiquant le numéro de dossier ${p.caseNumber}.

Une suppression définitive est irréversible et n'a lieu qu'après l'examen complet par MedScoutX.

Des questions ? ${p.supportEmail}

Cordialement
Votre équipe MedScoutX`,
    }),
  },

  it: {
    patient_account_deleted: (p) => ({
      subject: `MedScoutX – conferma della cancellazione del tuo account (${p.caseNumber})`,
      text: `Buongiorno,

confermiamo per iscritto la cancellazione del tuo account paziente MedScoutX.

Numero di pratica: ${p.caseNumber}
Data e ora: ${p.actionAt}
Indirizzo e-mail registrato: ${p.recipientEmail}
Azione eseguita: cancellazione definitiva dell'account paziente MedScoutX

Il tuo account, i dati paziente che hai salvato in MedScoutX, i tuoi collegamenti personali con gli studi medici, nonché le tue autorizzazioni, i token di accesso, le impostazioni e le sessioni sono stati cancellati.

Nota bene: la documentazione creata da uno studio medico, le copie già scaricate o esportate e i dati conservati al di fuori di MedScoutX possono rimanere al di fuori del tuo account paziente. Gli studi medici possono essere soggetti a propri obblighi di conservazione.

Domande? Contattaci: ${p.supportEmail}

Cordiali saluti
Il team MedScoutX`,
    }),
    practice_suspended: (p) => ({
      subject: `MedScoutX – studio medico in pausa (${p.caseNumber})`,
      text: `Buongiorno,

il tuo studio medico "${p.practiceName}" è stato temporaneamente messo in pausa su MedScoutX.

Numero di pratica: ${p.caseNumber}
Azione: studio messo in pausa
Stato attuale: in pausa
Data: ${p.actionAt}

Effetti: l'accesso operativo del tuo team è terminato. Non sono possibili nuovi collegamenti con pazienti, condivisioni o registrazioni cliniche. I dati salvati restano protetti e non vengono cancellati.

Prossimo passo: puoi riattivare lo studio in qualsiasi momento (è richiesta la conferma della password).

Domande? ${p.supportEmail}

Cordiali saluti
Il team MedScoutX`,
    }),
    practice_reactivated: (p) => ({
      subject: `MedScoutX – studio medico riattivato (${p.caseNumber})`,
      text: `Buongiorno,

il tuo studio medico "${p.practiceName}" è stato riattivato su MedScoutX.

Numero di pratica: ${p.caseNumber}
Azione: studio riattivato
Stato attuale: attivo
Data: ${p.actionAt}

Nota: i consensi revocati, le condivisioni ritirate e gli accessi del team rimossi NON sono stati ripristinati automaticamente. Verifica la struttura attuale del team e delle autorizzazioni.

Domande? ${p.supportEmail}

Cordiali saluti
Il team MedScoutX`,
    }),
    practice_closed: (p) => ({
      subject: `MedScoutX – studio medico chiuso (${p.caseNumber})`,
      text: `Buongiorno,

il tuo studio medico "${p.practiceName}" è stato chiuso su MedScoutX. Gli accessi operativi sono terminati. Lo studio NON è stato cancellato definitivamente. Una riattivazione successiva può essere richiesta tramite ${p.supportEmail}.

Numero di pratica: ${p.caseNumber}
Azione: studio chiuso
Stato attuale: chiuso
Data: ${p.actionAt}

Effetti: l'adesione termina. Tutte le sessioni del team e i token di accesso sono stati revocati. Non sono possibili nuovi collegamenti con pazienti o condivisioni. I dati conservati restano protetti.

Domande? ${p.supportEmail}

Cordiali saluti
Il team MedScoutX`,
    }),
    practice_reactivation_requested: (p) => ({
      subject: `MedScoutX – conferma di ricezione della richiesta di riattivazione (${p.caseNumber})`,
      text: `Buongiorno,

confermiamo la ricezione della tua richiesta di riattivazione per lo studio medico "${p.practiceName}".

Numero di pratica: ${p.caseNumber}
Azione: riattivazione richiesta
Stato attuale: riattivazione richiesta (in esame)
Data: ${p.actionAt}

MedScoutX esaminerà la tua richiesta e ti risponderà. Le precedenti condivisioni con i pazienti, i consensi revocati e gli accessi del team non vengono ripristinati automaticamente con la riattivazione.

Domande? ${p.supportEmail}

Cordiali saluti
Il team MedScoutX`,
    }),
    practice_deletion_requested: (p) => ({
      subject: `MedScoutX – conferma di ricezione della richiesta di cancellazione (${p.caseNumber})`,
      text: `Buongiorno,

la tua richiesta di cancellazione definitiva dello studio medico "${p.practiceName}" è stata registrata. Non è stata ancora eseguita alcuna cancellazione definitiva. MedScoutX esamina prima gli obblighi di conservazione e documentazione applicabili.

Numero di pratica: ${p.caseNumber}
Azione: cancellazione definitiva richiesta
Stato attuale: richiesta di cancellazione registrata (in esame)
Data: ${p.actionAt}

Conferma la tua richiesta anche via e-mail a ${p.supportEmail}, indicando il numero di pratica ${p.caseNumber}.

Una cancellazione definitiva non può essere annullata e avviene solo dopo il completamento dell'esame da parte di MedScoutX.

Domande? ${p.supportEmail}

Cordiali saluti
Il team MedScoutX`,
    }),
  },

  es: {
    patient_account_deleted: (p) => ({
      subject: `MedScoutX – confirmación de la eliminación de su cuenta (${p.caseNumber})`,
      text: `Buenos días:

Confirmamos por escrito la eliminación de su cuenta de paciente de MedScoutX.

Número de expediente: ${p.caseNumber}
Fecha y hora: ${p.actionAt}
Dirección de correo electrónico registrada: ${p.recipientEmail}
Acción realizada: eliminación definitiva de la cuenta de paciente de MedScoutX

Se han eliminado su cuenta, los datos de paciente que guardó en MedScoutX, sus vínculos personales con consultas médicas, así como sus autorizaciones, tokens de acceso, ajustes y sesiones.

Tenga en cuenta: la documentación creada por una consulta, las copias ya descargadas o exportadas y los datos almacenados fuera de MedScoutX pueden permanecer fuera de su cuenta de paciente. Las consultas pueden estar sujetas a sus propias obligaciones de conservación.

¿Preguntas? Contáctenos: ${p.supportEmail}

Atentamente
Su equipo de MedScoutX`,
    }),
    practice_suspended: (p) => ({
      subject: `MedScoutX – consulta en pausa (${p.caseNumber})`,
      text: `Buenos días:

Su consulta «${p.practiceName}» se ha pausado temporalmente en MedScoutX.

Número de expediente: ${p.caseNumber}
Acción: consulta pausada
Estado actual: en pausa
Fecha: ${p.actionAt}

Efectos: el acceso operativo de su equipo ha finalizado. No son posibles nuevas conexiones de pacientes, autorizaciones ni registros clínicos. Los datos guardados permanecen protegidos y no se eliminan.

Siguiente paso: puede reactivar la consulta usted mismo en cualquier momento (se requiere confirmación de contraseña).

¿Preguntas? ${p.supportEmail}

Atentamente
Su equipo de MedScoutX`,
    }),
    practice_reactivated: (p) => ({
      subject: `MedScoutX – consulta reactivada (${p.caseNumber})`,
      text: `Buenos días:

Su consulta «${p.practiceName}» se ha reactivado en MedScoutX.

Número de expediente: ${p.caseNumber}
Acción: consulta reactivada
Estado actual: activa
Fecha: ${p.actionAt}

Nota: los consentimientos revocados, las autorizaciones retiradas y los accesos de equipo eliminados NO se han restablecido automáticamente. Revise la estructura actual de su equipo y de sus permisos.

¿Preguntas? ${p.supportEmail}

Atentamente
Su equipo de MedScoutX`,
    }),
    practice_closed: (p) => ({
      subject: `MedScoutX – consulta cerrada (${p.caseNumber})`,
      text: `Buenos días:

Su consulta «${p.practiceName}» se ha cerrado en MedScoutX. Los accesos operativos han finalizado. La consulta NO se ha eliminado definitivamente. Puede solicitar una reactivación posterior a través de ${p.supportEmail}.

Número de expediente: ${p.caseNumber}
Acción: consulta cerrada
Estado actual: cerrada
Fecha: ${p.actionAt}

Efectos: la membresía finaliza. Se han revocado todas las sesiones del equipo y los tokens de acceso. No son posibles nuevas conexiones de pacientes ni autorizaciones. Los datos conservados permanecen protegidos.

¿Preguntas? ${p.supportEmail}

Atentamente
Su equipo de MedScoutX`,
    }),
    practice_reactivation_requested: (p) => ({
      subject: `MedScoutX – acuse de recibo de la solicitud de reactivación (${p.caseNumber})`,
      text: `Buenos días:

Confirmamos la recepción de su solicitud de reactivación para la consulta «${p.practiceName}».

Número de expediente: ${p.caseNumber}
Acción: reactivación solicitada
Estado actual: reactivación solicitada (en revisión)
Fecha: ${p.actionAt}

MedScoutX revisará su solicitud y se pondrá en contacto con usted. Las autorizaciones anteriores de pacientes, los consentimientos revocados y los accesos del equipo no se restablecen automáticamente con la reactivación.

¿Preguntas? ${p.supportEmail}

Atentamente
Su equipo de MedScoutX`,
    }),
    practice_deletion_requested: (p) => ({
      subject: `MedScoutX – acuse de recibo de la solicitud de eliminación (${p.caseNumber})`,
      text: `Buenos días:

Su solicitud de eliminación definitiva de la consulta «${p.practiceName}» ha sido registrada. Todavía no se ha realizado ninguna eliminación definitiva. MedScoutX revisa primero las obligaciones de conservación y documentación aplicables.

Número de expediente: ${p.caseNumber}
Acción: eliminación definitiva solicitada
Estado actual: solicitud de eliminación registrada (en revisión)
Fecha: ${p.actionAt}

Confirme su solicitud también por correo electrónico a ${p.supportEmail}, indicando el número de expediente ${p.caseNumber}.

Una eliminación definitiva no se puede deshacer y solo se lleva a cabo una vez concluida la revisión por parte de MedScoutX.

¿Preguntas? ${p.supportEmail}

Atentamente
Su equipo de MedScoutX`,
    }),
  },
};

/** Internal MedScoutX notification — always German, addressed to the support inbox. */
function internalNotice(p) {
  return {
    subject: `MedScoutX intern – Lifecycle-Vorgang ${p.caseNumber} (${p.internalAction})`,
    text: `Interner Lifecycle-Vorgang.

Vorgangsnummer: ${p.caseNumber}
Aktion: ${p.internalAction}
Praxis: ${p.practiceName || "—"}
Zeitpunkt: ${p.actionAt}
Status: ${p.internalStatus || "—"}

Dieser Vorgang wurde automatisch erzeugt. Keine medizinischen Inhalte enthalten.
Bearbeitung gemäß internem Lifecycle-Prozess.`,
  };
}

/**
 * @param {string} kind LifecycleOutboxEmail.kind
 * @param {string} locale
 * @param {Record<string, string>} params
 * @returns {{ subject: string, text: string } | null}
 */
export function renderLifecycleEmail(kind, locale, params) {
  if (kind === "medscoutx_internal_notice") return internalNotice(params);
  const l = normalizeLifecycleLocale(locale);
  const tpl = T[l]?.[kind] || T.de[kind];
  return tpl ? tpl(params) : null;
}
