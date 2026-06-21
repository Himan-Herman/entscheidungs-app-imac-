import part1 from "./datenschutz.part1.js";
import part2 from "./datenschutz.part2.js";

export default {
  pageTitle: "MedScoutX — Informativa sulla privacy",
  title: "Informativa sulla privacy",
  subtitle: "Ultimo aggiornamento: giugno 2026",
  privacyLinkPath: "/datenschutz",
  backRegister: "Torna alla registrazione",
  backRegisterAria: "Torna alla pagina di registrazione",
  sections: [...part1, ...part2],
};
