import { deepMerge } from "../../deepMerge.js";
import legalEs from "../legal/es/index.js";
import landing from "./es.landing.js";
import info from "./es.info.js";
import preVisit from "./es.preVisit.js";
import startseite from "./es.startseite.js";
import esCore from "./es/es.core.js";
import esAccount from "./es/es.account.js";
import esModules from "./es/es.modules.js";
import esPractice from "./es/es.practice.js";
import esPatient from "./es/es.patient.js";
import esMedicalInterpreter from "./es/es.medicalInterpreter.js";
import esPracticeModules from "./es/es.practice.modules.js";
import esVaccinations from "./es/es.vaccinations.js";
import esVitals from "./es/es.vitals.js";
import esHealthHistory from "./es/es.healthHistory.js";
import { esSymptomDiary } from "./es/es.symptomDiary.js";
import esErezept from "./es/es.erezept.js";
import esSosCard from "./es/es.sosCard.js";
import { esPracticeBillingPlausibility, esPracticeIntegrationsVendors } from "./es/es.practiceBillingPlausibility.js";
import { esPatientBillingExplain } from "./es/es.patientBillingExplain.js";
import { esPracticeDirectory } from "./es/es.practiceDirectory.js";
import { esTelemedicine } from "./es/es.telemedicine.js";

/** Base Spanish overrides — extended layers merged below; missing keys use EN→DE fallback at runtime */
const esBase = {
  roleEntry: {
    hero: {
      title: "Una entrada que hace su consulta más serena.",
      lead: "MedScoutX le ayuda a ordenar sus inquietudes antes de la cita — para conversaciones más claras, una documentación cuidada y datos que permanecen en sus manos.",
    },
    flow: {
      eyebrow: "Cómo funciona",
      title: "De la incertidumbre a una conversación estructurada",
      aria: "Flujo en tres pasos: Registrar, Estructurar, Entregar",
      steps: [
        {
          title: "Registrar",
          body: "Prepare con calma sus síntomas, preguntas y documentos, a su ritmo.",
        },
        {
          title: "Estructurar",
          body: "MedScoutX convierte sus datos en un resumen claro y legible.",
        },
        {
          title: "Entregar",
          body: "Compártalo de forma segura con su consulta en PDF o mediante un código QR.",
        },
      ],
    },
    metrics: {
      eyebrow: "Lo que define a MedScoutX",
      title: "Pensado, multilingüe, seguro",
      note: "Características del producto — no estadísticas de uso.",
      aria: "Características del producto MedScoutX",
      items: [
        {
          value: 2,
          label: "Áreas",
          hint: "Pacientes y consultas — una entrada común",
        },
        {
          value: 5,
          label: "Idiomas de la interfaz",
          hint: "Deutsch · English · Français · Español · Italiano",
        },
        {
          value: 14,
          label: "Módulos de preparación",
          hint: "Siete para pacientes, siete para consultas",
        },
        {
          value: 3,
          label: "Pasos para prepararse",
          hint: "Registrar, Estructurar, Entregar",
        },
      ],
    },
    manifesto: {
      eyebrow: "Digitalización centrada en las personas",
      title: "Tecnología al servicio de la conversación — y no al revés.",
      body: [
        "La buena medicina empieza por escuchar. MedScoutX le libera del papeleo y de la incertidumbre antes de la cita, para que en la consulta haya tiempo para lo esencial: la conversación entre una persona y su médico.",
        "Quien llega preparado recuerda las preguntas correctas, describe los síntomas con más precisión y entiende mejor las decisiones. La estructura aporta calma — y la calma, mejores conversaciones.",
        "Sus datos de salud le pertenecen. MedScoutX solo procesa lo que la preparación requiere, hace transparente cada autorización y entrega los documentos cifrados. La confianza no es un extra — es la base.",
      ],
      trust: [
        "Conforme al RGPD",
        "Sin diagnóstico ni tratamiento — solo preparación",
        "Sus datos permanecen en sus manos",
      ],
    },
    video: {
      eyebrow: "MedScoutX en acción",
      title: "Un breve vistazo",
      body: "Vea en unos segundos cómo se siente una preparación estructurada: tranquila, clara y por completo a su ritmo.",
      aria: "Vídeo de presentación de MedScoutX",
      play: "Reproducir vídeo",
      pause: "Pausar vídeo",
      mute: "Silenciar",
      unmute: "Activar sonido",
    },
  },
  legal: legalEs,
  info,
  preVisit,
  header: {
    skip: "Ir al contenido",
    homeAria: "Ir a la página de inicio",
    navToggle: "Abrir o cerrar la navegación",
    nav: "Navegación principal",
    appLabel: "Espacio profesional",
    home: "Inicio",
    logout: "Cerrar sesión",
    languageLabel: "Idioma",
    themeLight: "Modo claro",
    themeDark: "Modo oscuro",
    account: {
      menuAria: "Abrir el menú de la cuenta",
      rolePatient: "Cuenta de paciente",
      rolePractice: "Cuenta de consulta",
      avatarPatientAlt: "Imagen de perfil del paciente",
      avatarPracticeAlt: "Logotipo de la consulta",
    },
  },
  accountPortal: {
    imageTitle: "Imagen de perfil",
    imageUpload: "Subir imagen de perfil",
    imageChange: "Cambiar imagen de perfil",
    imageRemove: "Eliminar imagen de perfil",
    imageUploading: "Subiendo…",
    imageHint: "PNG, JPEG o WebP, máx. 2 MB.",
    imageAlt: "Imagen de perfil del paciente",
    imageErrorType: "Tipo de archivo no admitido. Usa PNG, JPEG o WebP.",
    imageErrorTooLarge: "Archivo demasiado grande. Máximo 2 MB.",
    imageErrorGeneric: "Error al subir. Inténtalo de nuevo.",
  },
  login: {
    badge: "MedScoutX — preparación de la cita",
    title: "Iniciar sesión",
    subtitle:
      "Preparación estructurada para la conversación médica — no sustituye el juicio clínico.",
    email: "Correo electrónico",
    emailPlaceholder: "ej. nombre@correo.com",
    password: "Contraseña",
    passwordPlaceholder: "Contraseña",
    submitting: "Iniciando sesión…",
    submit: "Entrar",
    forgot: "¿Ha olvidado la contraseña?",
    noAccount: "¿No tiene cuenta?",
    register: "Registrarse",
    imprint: "Aviso legal",
    privacy: "Privacidad",
    emailFirst: "Confirme primero su correo electrónico.",
    loginFailed: "Error al iniciar sesión.",
    loginError: "Error de inicio de sesión.",
    verifyOk: "Correo confirmado. Ya puede iniciar sesión.",
    verifyInvalid:
      "El enlace no es válido o ha caducado. Regístrese de nuevo.",
    verifyError:
      "Error al confirmar el correo. Inténtelo más tarde.",
    resetOk:
      "Contraseña restablecida. Inicie sesión con la nueva contraseña.",
    sessionExpired:
      "Sesión caducada. Vuelva a iniciar sesión para seguir usando MedScoutX.",
  },
  register: {
    alert: "Aviso:",
    alertText: "MedScoutX no es un servicio de emergencias (112 / 911).",
    title: "Crear cuenta",
    subtitle:
      "Cuenta para preparar citas médicas — no para diagnosticar.",
    required: "Campo obligatorio",
    email: "Correo electrónico",
    emailPlaceholder: "ej. nombre@correo.com",
    emailHint: "Usamos su correo para la cuenta y avisos importantes.",
    password: "Contraseña",
    passwordPlaceholder: "Mín. 8 caracteres, letra y número",
    passwordHint: "Al menos 8 caracteres, con letra y número.",
    firstName: "Nombre",
    lastName: "Apellidos",
    birthDate: "Fecha de nacimiento",
    minorTitle: "Aviso:",
    minorText:
      "Es menor de edad. MedScoutX solo para personas de 18 años o más.",
    gender: "Género",
    genderPlaceholder: "Seleccione…",
    genderFemale: "Mujer",
    genderMale: "Hombre",
    genderDiverse: "Otro",
    genderNone: "Prefiero no indicarlo",
    consents: "Consentimientos",
    ageConfirm: "Confirmo que tengo al menos 18 años",
    termsOpen: "Abrir términos y condiciones",
    privacyOpen: "Abrir política de privacidad",
    disclaimerOpen: "Abrir información legal sobre límites médicos",
    legalTextStart: "He leído los",
    legalTextMiddle: "la política de privacidad",
    legalTextEnd: " y acepto lo indicado en ellos.",
    submit: "Continuar",
    saving: "Guardando…",
    cancel: "Cancelar",
    imprint: "Aviso legal",
    privacy: "Privacidad",
    disclaimer: "Descargo médico",
    terms: "Términos y condiciones",
    language: "Idioma",
    enterBirth: "Indique la fecha de nacimiento.",
    underage:
      "Es menor de edad. MedScoutX solo para mayores de 18 años.",
    confirmAge: "Confirme que tiene al menos 18 años.",
    checkFields: "Revise los campos obligatorios y consentimientos.",
    emailExists: "Este correo ya está registrado.",
    failed: "No se pudo completar el registro.",
    requestError: "Error de registro.",
    srRequired: "(obligatorio)",
    firstNamePlaceholder: "p. ej., Ana",
    lastNamePlaceholder: "p. ej., García",
    conjunctionAnd: "y el",
    legalLinksAria: "Información jurídica",
  },
  footer: {
    imprint: "Aviso legal",
    privacy: "Privacidad",
    terms: "Términos",
    disclaimer: "Descargo",
    ariaLabel: "Enlaces legales",
  },
  landing,
  common: {
    continue: "Continuar",
    cancel: "Cancelar",
    close: "Cerrar",
  },
  startseite,
  forgotPassword: {
    title: "Restablecer contraseña",
    text: "Introduzca su correo. Le enviaremos un enlace.",
    email: "Correo electrónico",
    placeholder: "nombre@correo.com",
    submit: "Solicitar enlace",
    submitting: "Enviando…",
    back: "Volver al inicio de sesión",
    badge: "Recuperación segura de cuenta",
    success: "Si el correo existe, se ha enviado un enlace.",
    error: "Algo salió mal. Inténtelo más tarde.",
    network: "Error de red. Inténtelo más tarde.",
  },
  checkEmail: {
    badge: "Inicio de sesión seguro MedScoutX",
    title: "Confirme su correo",
    text: "Le hemos enviado un correo de verificación. Ábralo y confirme para activar la cuenta.",
    tip: "Consejo:",
    tipText: "Revise spam o promociones si no lo ve de inmediato.",
    resend: "Reenviar correo",
    resending: "Enviando…",
    success: "Correo reenviado.",
    error: "Algo salió mal. Inténtelo más tarde.",
    network: "Error de red. Compruebe la conexión.",
    missing: "No hay correo pendiente. Regístrese de nuevo.",
    footer:
      "Si no solicitó MedScoutX, puede ignorar este mensaje.",
  },
  resetPassword: {
    title: "Nueva contraseña",
    text: "Introduzca una contraseña segura.",
    label: "Nueva contraseña",
    placeholder: "Al menos 8 caracteres",
    hint: "Al menos 8 caracteres; se recomienda número y símbolo.",
    save: "Guardar contraseña",
    saving: "Guardando…",
    invalidLink: "Enlace no válido o ausente.",
    shortPassword: "La contraseña debe tener al menos 8 caracteres.",
    unknownError: "Error desconocido.",
    requestError: "Error: ",
    success: "Contraseña actualizada. Redirigiendo…",
    network: "Error de red. Inténtelo más tarde.",
  },
};

const esComposed = deepMerge(
  deepMerge(
    deepMerge(deepMerge(deepMerge(esBase, esCore), esAccount), esModules),
    esPractice,
  ),
  deepMerge(
    deepMerge(deepMerge(esPatient, esMedicalInterpreter), esPracticeModules),
    deepMerge(
      deepMerge(deepMerge(deepMerge(deepMerge(deepMerge({ vaccinations: esVaccinations }, { vitals: esVitals }), { healthHistory: esHealthHistory }), { symptomDiary: esSymptomDiary }), { erezept: esErezept }), { sosCard: esSosCard }),
      deepMerge(
        deepMerge(
          { practiceBillingPlausibility: esPracticeBillingPlausibility },
          { practiceIntegrations: esPracticeIntegrationsVendors },
        ),
        deepMerge({ patientBillingExplain: esPatientBillingExplain }, { practiceDirectory: esPracticeDirectory }),
      ),
    ),
  ),
);

export default deepMerge(esComposed, esTelemedicine);
