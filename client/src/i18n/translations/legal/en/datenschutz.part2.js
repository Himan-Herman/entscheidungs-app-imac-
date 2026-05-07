/** Sections 8–15 — merged in datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Retention periods",
    blocks: [
      {
        type: "p",
        text:
          "As a rule MedScoutX does not permanently store chat histories, symptoms or images on the server. Health-related content is stored only locally on your device (for example in LocalStorage) and can be deleted at any time.",
      },
      {
        type: "ul",
        items: [
          "Account data: email address, password hash and language setting are stored for the lifetime of your user account. After account deletion these data are erased or anonymised unless statutory retention duties apply.",
          "Chat and symptom data: are not stored on the server. They remain only on your device and are fully deleted when you use “New conversation” or “Delete history”.",
          "Image uploads: are processed only briefly for forwarding to the AI service, then discarded. There is no permanent storage.",
          "Technical logs / server logs: for operations, security and error analysis, hosting services automatically store technical logs (for example time, truncated IP address, error details), typically for 14–30 days. These data are not linked to your profile or your content and are not used for advertising.",
          "Local data (LocalStorage, app storage): chat histories, settings (for example language, accessibility) and history entries are stored only on your device and can be removed at any time via “Delete history” or device settings.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Security",
    blocks: [
      {
        type: "p",
        text:
          "We implement appropriate technical and organisational measures to protect your data against loss, alteration, unauthorised access or other misuse. These include in particular:",
      },
      {
        type: "p",
        text:
          "Processing of your health data occurs only after you give explicit consent on first use of the relevant functions (symptom chat, body map, image analysis) (checkbox + confirmation). You may withdraw this consent at any time in the app settings.",
      },
      {
        type: "ul",
        items: [
          "Transport encryption (TLS/HTTPS),",
          "access restrictions and role/permission systems,",
          "data minimisation and pseudonymous processing where possible,",
          "regular system updates.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Children and young people",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX is not directed at children under 16. Minors should use the app only with consent of their legal guardians. If we learn that data of a child under 16 has been processed without guardian consent, we will delete those data.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Your rights (data subject rights)",
    blocks: [
      {
        type: "p",
        text:
          "Under the GDPR you have in particular the following rights:",
      },
      {
        type: "ul",
        items: [
          "Access (Art. 15 GDPR): you may request information about which personal data we process about you.",
          "Rectification (Art. 16 GDPR): you may request correction of inaccurate data or completion of incomplete data.",
          "Erasure (Art. 17 GDPR): you may request erasure of your personal data unless statutory retention obligations prevent this.",
          "Restriction (Art. 18 GDPR): you may request restriction of processing.",
          "Data portability (Art. 20 GDPR): you may request your data in a structured, commonly used and machine-readable format.",
          "Objection (Art. 21 GDPR): where we rely on legitimate interests, you may object on grounds relating to your particular situation.",
          "Withdrawal of consent (Art. 7(3) GDPR): consent you have given, in particular for health data, may be withdrawn at any time with effect for the future.",
          "Complaint (Art. 77 GDPR): you have the right to lodge a complaint with a supervisory authority, for example at your place of residence or at our establishment.",
        ],
      },
      {
        type: "p",
        text:
          "To exercise your rights you may contact us at any time using the contact details above.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies & LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX does not use tracking cookies for advertising. For convenience, local storage may be used on your device, for example:",
      },
      {
        type: "ul",
        items: [
          "storing your language preference,",
          "optional storage of chat history,",
          "accessibility options (for example font size).",
        ],
      },
      {
        type: "p",
        text:
          "You can delete this information at any time via functions in the app or via your device or browser settings.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. App permissions",
    blocks: [
      {
        type: "p",
        text:
          "Depending on use, MedScoutX may request the following permissions on your device:",
      },
      {
        type: "ul",
        items: [
          "Camera/file access: to take or select images for image analysis. This permission is optional and can be revoked in your device settings.",
          "Storage access: to process image files or temporary data.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX does not access content without your action and does not send background data to third parties that is not required for the app to function.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Notes on AI processing",
    blocks: [
      {
        type: "ul",
        items: [
          "Your texts and, where applicable, images are processed automatically to generate suggestions and hints.",
          "The AI may err or misjudge situations. Please review outputs critically and use them for orientation only.",
          "Do not submit third-party names or identifying details and avoid unnecessarily extensive personal data.",
          "Use of the app does not replace personal medical advice, diagnosis or treatment by physicians or other healthcare professionals.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. No automated decision-making within the meaning of Art. 22 GDPR",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX does not make diagnoses or automated decisions producing legal or similarly significant effects. AI-generated content serves orientation only and does not replace medical advice. In medically relevant situations you will be prompted to contact a clinician.",
      },
    ],
  },
];
