import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import { readUserMode, USER_MODES } from "../../../utils/userMode.js";
import "../styles/PreVisitModuleChrome.css";

/**
 * Where "back" goes, per role.
 *
 * The previous version only named a target for a signed-in PATIENT; everyone
 * else — including a signed-in PRACTICE user, because this chrome also sits on
 * the shared settings pages — fell through to a single fallback. That fallback
 * pointed at a page which no longer exists, so each role now gets its own
 * destination and its own label.
 *
 * @param {object} t preVisit.chrome messages
 * @param {string} practiceLabel preVisit.cases.backPracticeHub — already
 *   translated everywhere, so this needs no new key in 21 language files
 */
function resolveChromeBack(t, practiceLabel) {
  try {
    if (localStorage.getItem("medscout_token")) {
      return readUserMode() === USER_MODES.PRACTICE
        ? { to: "/practice", label: practiceLabel }
        : { to: "/patient", label: t.backPatientHub };
    }
  } catch {
    /* private mode */
  }
  // A guest has no workspace to return to. "/" is the public start page, so the
  // existing label is accurate for this branch and only for this branch.
  return { to: "/", label: t.backHome };
}

/**
 * @param {{ variant?: "workflow" | "library", languageOverride?: string }} props
 */
export default function PreVisitModuleChrome({
  variant = "workflow",
  languageOverride,
}) {
  const { language } = useLanguage();
  const effectiveLanguage = languageOverride || language;
  const t = useMemo(
    () => getMessages(effectiveLanguage).preVisit.chrome,
    [effectiveLanguage]
  );
  const practiceLabel = useMemo(
    () => getMessages(effectiveLanguage).preVisit.cases.backPracticeHub,
    [effectiveLanguage]
  );
  const back = useMemo(
    () => resolveChromeBack(t, practiceLabel),
    [practiceLabel, t]
  );
  const isLibrary = variant === "library";
  const moduleLabel = isLibrary ? t.libraryModuleLabel : t.moduleLabel;
  const safety = isLibrary ? t.librarySafety : t.safety;

  return (
    <div className={`pre-visit-chrome${isLibrary ? " pre-visit-chrome--library" : ""}`}>
      <nav className="pre-visit-chrome__nav" aria-label={t.navAria}>
        <Link className="pre-visit-chrome__back" to={back.to}>
          <ArrowLeft size={16} aria-hidden="true" />
          {back.label}
        </Link>
        <span className="pre-visit-chrome__module">{moduleLabel}</span>
      </nav>
      <p className="pre-visit-chrome__safety" role="note">
        {safety}
      </p>
    </div>
  );
}
