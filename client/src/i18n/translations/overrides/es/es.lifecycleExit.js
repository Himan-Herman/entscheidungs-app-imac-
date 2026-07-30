/** Procesos de salida, cierre y solicitud de eliminación (paciente + consulta). Tratamiento formal (usted). */
export const esLifecycleExit = {
  patient: {
    dangerTitle: "Eliminar cuenta",
    dangerIntro:
      "La eliminación de su cuenta de MedScoutX es definitiva y no se puede deshacer. Antes de eliminar, lea qué se eliminará — y qué podría no eliminarse.",
    whatDeletedTitle: "Qué se eliminará",
    whatDeletedItems: [
      "Su cuenta personal de MedScoutX",
      "Los datos de paciente que guardó en MedScoutX",
      "Sus vínculos personales con consultas médicas",
      "Sus autorizaciones personales y tokens de acceso",
      "Sus ajustes personales y sesiones",
    ],
    whatRemainsTitle: "Qué podría no eliminarse",
    whatRemainsItems: [
      "La documentación creada por una consulta",
      "Las copias ya descargadas o exportadas",
      "Los datos almacenados fuera de MedScoutX",
      "Los datos que una consulta deba conservar por obligaciones propias",
    ],
    whatRemainsNote:
      "MedScoutX no puede eliminar datos en sistemas de terceros. Las consultas pueden estar sujetas a sus propias obligaciones de conservación y documentación.",
    exportHint:
      "Recomendación: descargue una copia de sus datos antes de la eliminación (sección «Exportación de datos» más arriba). Tras la eliminación ya no es posible ninguna exportación.",
    receiptHint:
      "Tras la eliminación recibirá una confirmación por escrito con número de expediente en su dirección de correo electrónico registrada.",
    openDialogButton: "Eliminar cuenta …",
    ownerNoticeTitle: "Usted posee una consulta",
    ownerNotice:
      "Su cuenta está vinculada al menos a una consulta. Antes de poder eliminar su cuenta, debe decidir qué ocurrirá con la consulta.",
    ownerManageButton: "Gestionar consulta",
    dialogTitle: "¿Eliminar definitivamente su cuenta?",
    dialogWarning:
      "Esta acción no se puede deshacer. Su cuenta y los datos de paciente guardados en MedScoutX se eliminarán definitivamente.",
    checkboxLabel:
      "He entendido qué datos se eliminarán y qué documentos podrían permanecer en mis consultas.",
    phraseLabel: "Escriba exactamente esta frase para confirmar:",
    phraseExpected: "ELIMINAR MI CUENTA DEFINITIVAMENTE",
    phraseMismatch: "La frase introducida no coincide.",
    confirmButton: "Eliminar mi cuenta definitivamente ahora",
    cancelButton: "Cancelar",
    deleting: "Eliminando la cuenta …",
    successTitle: "Su cuenta ha sido eliminada",
    successBody:
      "Su cuenta de MedScoutX se ha eliminado definitivamente. Su número de expediente: {caseNumber}",
    successEmailHint:
      "Se ha programado una confirmación por escrito a su dirección de correo registrada. La documentación de sus consultas o las copias ya exportadas pueden permanecer fuera de MedScoutX.",
    supportLabel: "Contacto:",
    errorGeneric: "La eliminación no se pudo completar. Su cuenta no se ha modificado.",
    errorOwnerBlocked:
      "Su cuenta está vinculada al menos a una consulta. La eliminación de la cuenta no es automática actualmente para los titulares — decida primero qué ocurrirá con la consulta.",
    errorContextBlocked:
      "La eliminación no se pudo completar de forma segura y se revirtió por completo. Su cuenta no ha cambiado. Póngase en contacto con el soporte.",
  },
  practice: {
    sectionTitle: "Membresía y estado de la consulta",
    sectionIntro:
      "Aquí puede pausar o cerrar su consulta, reactivarla o solicitar la eliminación definitiva. Solo el o la titular de la consulta puede realizar estas acciones.",
    statusLabel: "Estado actual",
    status: {
      active: "Activa",
      suspended: "Temporalmente en pausa",
      closed: "Cerrada",
      reactivation_requested: "Reactivación solicitada",
      deletion_requested: "Eliminación definitiva solicitada",
    },
    statusBanner: {
      suspended:
        "Su consulta está en pausa. El acceso operativo ha finalizado; los datos guardados permanecen protegidos.",
      closed:
        "Su consulta está cerrada. El acceso operativo ha finalizado. Se puede solicitar una reactivación.",
      reactivation_requested:
        "Su solicitud de reactivación se ha enviado a MedScoutX y está en revisión. Recibirá una respuesta por escrito.",
      deletion_requested:
        "Su solicitud de eliminación definitiva ha sido registrada. Todavía no se ha eliminado nada — MedScoutX revisa primero las obligaciones de conservación y documentación.",
    },
    pauseTitle: "Pausar temporalmente la consulta",
    pauseBody:
      "La consulta permanece guardada y podrá reactivarse más adelante. El acceso operativo se interrumpe temporalmente.",
    pauseRecommendedTitle: "Recomendado para:",
    pauseRecommended: [
      "una pausa temporal",
      "vacaciones o reestructuración",
      "retrasos en los pagos",
      "un regreso posterior a MedScoutX",
    ],
    pauseButton: "Pausar consulta …",
    pauseConfirmTitle: "¿Pausar temporalmente la consulta?",
    pauseConfirmBody:
      "El acceso operativo de su equipo finaliza de inmediato. Los datos de los pacientes no se eliminan. Puede reactivar la consulta usted mismo en cualquier momento.",
    closeTitle: "Cerrar la consulta en MedScoutX",
    closeBody:
      "La membresía finaliza. La consulta ya no puede trabajar operativamente. Los datos conservados permanecen protegidos y se puede solicitar una reactivación posterior.",
    closeRecommendedNote:
      "Recomendado cuando la consulta quiere abandonar MedScoutX sin descartar un regreso posterior.",
    closeButton: "Cerrar consulta …",
    closeConfirmTitle: "¿Cerrar la consulta en MedScoutX?",
    closeConfirmBody:
      "Todas las sesiones del equipo y los accesos finalizan. No son posibles nuevas conexiones de pacientes ni autorizaciones. La consulta no se elimina; se puede solicitar una reactivación posterior.",
    reactivateTitle: "Reactivar la consulta",
    reactivateBody:
      "Finaliza la pausa tras una confirmación de seguridad. Los consentimientos revocados, las autorizaciones retiradas y los accesos de equipo eliminados no se restablecen automáticamente.",
    reactivateButton: "Reactivar consulta …",
    reactivateConfirmTitle: "¿Reactivar la consulta?",
    reactivateConfirmBody:
      "Su consulta vuelve a estar operativa. Revise después la estructura actual de su equipo y de sus permisos — las revocaciones anteriores se mantienen.",
    requestReactivateTitle: "Solicitar reactivación",
    requestReactivateBody:
      "Una consulta cerrada solo puede ser reactivada por MedScoutX. La solicitud se envía a MedScoutX; recibirá un acuse de recibo por escrito.",
    requestReactivateButton: "Solicitar reactivación …",
    requestReactivateConfirmTitle: "¿Solicitar la reactivación a MedScoutX?",
    requestReactivateConfirmBody:
      "MedScoutX revisará su solicitud y responderá por escrito. Las autorizaciones anteriores de pacientes, los consentimientos revocados y los accesos del equipo no se reactivan automáticamente.",
    deleteTitle: "Solicitar la eliminación definitiva",
    deleteWarning:
      "Una eliminación definitiva no se puede deshacer. Antes de la eliminación deben revisarse las obligaciones de conservación, documentación y protección de datos.",
    deleteBody:
      "Esta opción no elimina de inmediato. Se crea una solicitud por escrito con número de expediente; la eliminación permanece bloqueada técnicamente hasta que MedScoutX haya revisado y aprobado la solicitud.",
    deleteButton: "Solicitar eliminación definitiva …",
    deleteConfirmTitle: "¿Solicitar la eliminación definitiva?",
    deleteConfirmBody:
      "El acceso operativo finaliza y se crea una solicitud de eliminación por escrito. No se elimina nada hasta que MedScoutX haya concluido su revisión.",
    reasonLabel: "Motivo objetivo (opcional, sin contenido médico)",
    passwordLabel: "Confirme con su contraseña",
    passwordHelp:
      "Por motivos de seguridad debe autenticarse de nuevo con su contraseña para esta acción.",
    dialogConfirm: "Confirmar",
    dialogCancel: "Cancelar",
    working: "En curso …",
    receiptHint:
      "Por cada una de estas acciones recibirá una confirmación por escrito con número de expediente en su dirección de correo registrada.",
    afterRequestTitle: "Solicitud de eliminación registrada",
    afterRequestBody:
      "Su solicitud ha sido registrada. Todavía no se ha eliminado nada. Su número de expediente: {caseNumber}",
    emailConfirmHint:
      "Confirme su solicitud también por correo electrónico a {supportEmail}.",
    openMailButton: "Abrir correo a MedScoutX",
    mailNotSentNote:
      "Nota: abrir su programa de correo no equivale al envío. La solicitud solo se considera confirmada cuando su correo se ha enviado realmente.",
    copyCaseButton: "Copiar número de expediente",
    copySubjectButton: "Copiar asunto",
    copied: "Copiado.",
    copyFailed: "No se pudo copiar — cópielo manualmente.",
    caseStatus: {
      recorded: "Registrado",
      awaiting_email_confirmation: "A la espera de su confirmación por correo",
      in_review: "En revisión por MedScoutX",
      withdrawn: "Retirada",
      completed: "Completada",
    },
    caseListTitle: "Expedientes",
    mailSubject: "Eliminación definitiva de mi consulta – solicitud {requestId}",
    mailBody:
      "Buenos días:\n\nPor la presente confirmo la solicitud de eliminación definitiva de mi consulta en MedScoutX.\n\nConsulta: {practiceName}\nID de la solicitud: {requestId}\nDirección de correo electrónico registrada: {ownerEmail}\n\nSoy consciente de que la eliminación solo se llevará a cabo tras la revisión de las posibles obligaciones de conservación y documentación.\n\nAtentamente\n{ownerName}",
    supportLabel: "Dirección de contacto oficial:",
    errors: {
      practice_lifecycle_transition_invalid:
        "Este cambio de estado no es posible en el estado actual.",
      practice_owner_required:
        "Solo el o la titular de la consulta puede realizar esta acción.",
      practice_already_suspended: "La consulta ya está en pausa.",
      practice_already_closed: "La consulta ya está cerrada.",
      reactivation_already_requested: "Ya existe una solicitud de reactivación en curso.",
      deletion_already_requested: "Ya existe una solicitud de eliminación activa.",
      confirmation_required: "Confirme la acción con su contraseña correcta.",
      unsupported_field: "La solicitud contenía campos inesperados y fue rechazada.",
      email_delivery_pending:
        "La confirmación por escrito se entregará en cuanto sea posible el envío.",
      practice_deletion_locked:
        "La eliminación definitiva está bloqueada técnicamente hasta que MedScoutX haya revisado y aprobado su solicitud.",
      generic: "La acción no se pudo realizar. No se ha modificado nada.",
    },
  },
};
