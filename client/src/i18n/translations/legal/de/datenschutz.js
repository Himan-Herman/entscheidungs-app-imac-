import part1 from "./datenschutz.part1.js";
import part2 from "./datenschutz.part2.js";

export default {
  pageTitle: "MedScoutX — Datenschutz",
  title: "Datenschutzerklärung",
  subtitle: "Letzte Aktualisierung: 29.11.2025",
  privacyLinkPath: "/datenschutz",
  backRegister: "Zurück zur Registrierung",
  backRegisterAria: "Zurück zur Registrierungsseite",
  sections: [...part1, ...part2],
};
