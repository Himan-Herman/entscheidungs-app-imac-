import part1 from "./datenschutz.part1.js";
import part2 from "./datenschutz.part2.js";

export default {
  pageTitle: "MedScoutX — تایبەتمەندی",
  title: "سیاستی تایبەتمەندی",
  subtitle: "دوایین نوێکردنەوە: ٢٩ی تشرینی دووەمی ٢٠٢٥",
  privacyLinkPath: "/datenschutz",
  backRegister: "گەڕانەوە بۆ تۆمارکردن",
  backRegisterAria: "گەڕانەوە بۆ پەڕەی تۆمارکردن",
  sections: [...part1, ...part2],
};
