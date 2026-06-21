/** Sections 1–7 — merged in datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Controller",
    blocks: [
      {
        type: "p",
        text:
          "This privacy policy explains how the MedScoutX app processes personal data.",
      },
      {
        type: "address",
        lineStrong: "Controller within the meaning of the GDPR",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Germany",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "Email", dd: "contact@medscoutx.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Phone", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. What is this about?",
    blocks: [
      {
        type: "p",
        text:
          "This notice describes how MedScoutX processes your personal data when you:",
      },
      {
        type: "ul",
        items: [
          "install the app and create an account,",
          "capture information for a medical appointment in a structured way and optionally prepare it as a PDF,",
          "enter symptoms via the text chat,",
          "select body regions via the body map,",
          "upload images (for example skin photos or medical images).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX is not a diagnostic or treatment tool and does not replace medical examination or advice. The application supports structured preparation and documentation of your own information before medical appointments. If you generate a PDF purely locally without transmission, the special notes described there apply.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Categories of personal data",
    blocks: [
      {
        type: "p",
        text:
          "Depending on how you use the app, the following categories of personal data may be processed:",
      },
      {
        type: "ul",
        items: [
          "Account data: email address, possibly name or username, password hash (no plaintext password), language setting.",
          "Health-related data: text entries about symptoms, responses in the symptom chat, selection of body regions on the body map, health-related information in free-text fields.",
          "Image data: images you upload (for example skin changes, photos of body regions or other health-related areas). MedScoutX uses these images to describe notable findings, but not for standalone medical diagnosis.",
          "Usage and log data: timestamps of requests, technical error logs, possibly truncated IP address, browser/device information, operating system, app version used.",
          "Subscription and contract data (if you use a paid subscription): booked plan, term, subscription status, technical purchase information (via App Store / Play Store). Full payment data (such as credit card numbers) are not stored by MedScoutX but processed by the respective platform payment service.",
          "Local data on your device: for example locally stored chat history or settings (such as language, accessibility options) in LocalStorage or comparable storage mechanisms.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Purposes of processing",
    blocks: [
      {
        type: "ul",
        items: [
          "Providing app functions: login, registration, account management and core MedScoutX features.",
          "Symptom chat & AI-assisted follow-up questions: processing your text input to provide questions and hints for further clarification.",
          "Body map: mapping your selected body regions to suitable AI follow-up questions and hints.",
          "Image analysis: processing your uploaded images to describe notable findings and suggest possible next steps (for example clarification by a clinician). No automatic diagnosis is made in a medical-legal sense.",
          "Stability & security: error analysis, abuse detection, protection of systems and data.",
          "Legal requirements: compliance with statutory obligations (for example documentation of IT security measures, retention periods).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Legal bases (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "Depending on the situation, we rely on the following legal bases for processing:",
      },
      {
        type: "ul",
        items: [
          "Art. 6 (1)(b) GDPR – contract performance: for providing technical app functions such as registration, login and management of your user account.",
          "Art. 6 (1)(f) GDPR – legitimate interests: to ensure IT security, error analysis and abuse detection.",
          "Art. 6 (1)(c) GDPR – legal obligation: where statutory retention obligations exist (for example tax-related obligations in connection with subscriptions).",
          "Art. 9 (2)(a) GDPR – explicit consent: this is the primary legal basis for processing your health data. This includes symptoms you voluntarily enter in the text chat, body region selections on the body map, and uploading and analysing images. Before first use of these functions you will be asked explicitly for consent (for example via a checkbox and confirmation button). You may withdraw consent at any time with effect for the future.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Processors & disclosure to third parties",
    blocks: [
      {
        type: "p",
        text:
          "For certain functions MedScoutX uses service providers as processors under Art. 28 GDPR. The main categories are:",
      },
      {
        type: "ul",
        items: [
          "Hosting providers (EU): a European cloud provider supplies infrastructure for servers and databases (for example Render.com with EU location).",
          "AI provider – OpenAI (USA): for AI-based processing of your text input, image data and body-map information, MedScoutX uses services of OpenAI LLC (San Francisco, USA). Content is transmitted encrypted to OpenAI, processed there and deleted after processing.",
          "Email providers: a technical service provider is used to deliver system emails (for example verification emails).",
        ],
      },
      {
        type: "p",
        text:
          "All processors are contractually bound under Art. 28 GDPR and process data only on our instructions. There is no disclosure of your data for advertising or marketing purposes.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Third-country transfers",
    blocks: [
      {
        type: "p",
        text:
          "When using MedScoutX AI functions, content (for example text, symptoms, image data) is transferred to AI provider OpenAI LLC in the USA. Such transfer constitutes a third-country transfer within the meaning of the GDPR.",
      },
      {
        type: "p",
        text:
          "To ensure an adequate level of data protection, transfer is based on EU standard contractual clauses (Art. 46 GDPR) plus additional technical and organisational measures (encryption in transit, short processing duration, deletion after the AI service responds).",
      },
      {
        type: "p_link",
        before: "Further information is available in OpenAI’s privacy documentation: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
