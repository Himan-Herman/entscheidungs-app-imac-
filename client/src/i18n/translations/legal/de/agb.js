import partA from "./agb.partA.js";
import partB from "./agb.partB.js";
import partC from "./agb.partC.js";
import partD from "./agb.partD.js";

export default {
  pageTitle: "MedScoutX — AGB",
  title: "Allgemeine Geschäftsbedingungen (AGB)",
  subtitle: "Version 1.0 – gültig ab 01.12.2025",
  backLabel: "Zurück zur Registrierung",
  backAria: "Zurück zur Registrierungsseite",
  sections: [...partA, ...partB, ...partC, ...partD],
};
