// Public trade-show / DemoDay showcase ("/demo"). Sample-data only — no real data, no API.
const publicDemo = {
  pageTitle: "MedScoutX — Live demo",
  badge: "Live demo · sample data",
  entryButton: "View the demo",

  heading: "MedScoutX at a glance",
  sub: "Click through a safe demo with sample data — no sign-in required. All content is fictional and for illustration only.",

  bannerTitle: "This is a demo with sample data.",
  bannerBody:
    "No real patient or practice data is shown. To use the real app with your own data, please sign in as usual.",

  backToSite: "Back to home",
  loginCta: "Go to sign-in",

  notice: {
    badge: "DemoDay / Trade fair",
    title: "Welcome to MedScoutX",
    body: "A public sample demo is available for the trade fair and DemoDay. You can explore MedScoutX without an account, using sample data, and get to know the most important areas.",
    body2: "Existing users can still sign in as usual. The demo contains sample data only and shows no real patient data.",
    primary: "View the trade fair demo",
    secondary: "Sign in",
    dismiss: "Continue to home page",
  },

  sectionPatient: "For patients",
  sectionPatientSub: "What insured people can see and manage in MedScoutX.",
  sectionPractice: "For practices",
  sectionPracticeSub: "How practice teams work with MedScoutX.",

  openLabel: "View example",
  modalClose: "Close",
  sampleNote: "Sample data — for illustration only.",

  badges: {
    ok: "Current",
    pending: "Open",
    info: "Info",
    done: "Done",
    scheduled: "Scheduled",
    review: "Review",
  },

  tiles: {
    // Patient
    appointments: {
      label: "Appointments",
      sub: "Upcoming appointments",
      detail: "Upcoming and requested appointments — clearly in one place.",
    },
    messages: {
      label: "Messages",
      sub: "Secure exchange with the practice",
      detail: "Messages between patient and practice when a connection exists.",
    },
    medication: {
      label: "Medication plan",
      sub: "Current medication",
      detail: "The current medication plan with dosage and intake notes.",
    },
    documents: {
      label: "Findings & documents",
      sub: "Records stored securely",
      detail: "Findings shared by the practice and personal documents.",
    },
    vitals: {
      label: "Vital signs",
      sub: "Blood pressure, pulse & more",
      detail: "Self-recorded vital signs over time.",
    },
    vaccinations: {
      label: "Vaccination record",
      sub: "Vaccinations & boosters",
      detail: "A digital overview of vaccinations and upcoming boosters.",
    },

    // Practice
    patients: {
      label: "Patients",
      sub: "Linked people",
      detail: "People linked to the practice — only with active consent.",
    },
    booking: {
      label: "Appointments & requests",
      sub: "Handle requests",
      detail: "Accept, schedule and confirm incoming appointment requests.",
    },
    anamnesis: {
      label: "Anamnesis",
      sub: "Templates & submissions",
      detail: "Create anamnesis templates and review incoming answers.",
    },
    billing: {
      label: "GOÄ / PKV check",
      sub: "Check plausibility",
      detail: "Deterministic catalogue check of billing items — non-binding.",
    },
    telemedicine: {
      label: "Video consultation",
      sub: "Appointments by video",
      detail: "Schedule and run video consultations.",
    },
    activity: {
      label: "Activity",
      sub: "Recent events",
      detail: "A traceable overview of the team's recent activity.",
    },
  },
};

export default publicDemo;
