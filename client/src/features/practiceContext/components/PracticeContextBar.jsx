import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePracticeContext } from "../usePracticeContext.js";
import PracticeSwitcherDialog from "./PracticeSwitcherDialog.jsx";
import PracticeAvatar from "./PracticeAvatar.jsx";
import { switchTargetPath } from "../lib/switchTarget.js";
import { patientContextLabel } from "../lib/patientContextLabel.js";
import { rememberLastUsedPracticeLinkId } from "../lib/lastUsedPractice.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";

/**
 * Which practice you are in, and how to leave it.
 *
 * Compact by design: a second full header would compete with the app's own.
 * The practice is named in text, so the context never rests on colour, and the
 * switch control states the current practice in its accessible name so a screen
 * reader user knows where they are before they open anything.
 */
export default function PracticeContextBar() {
  const { linkId, practice, patientProfileName, isActiveRelationship } = usePracticeContext();
  const { language } = useLanguage();
  const t = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const navigate = useNavigate();
  const location = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const headingRef = useRef(null);
  const justSwitchedRef = useRef(false);

  // Remembering is a sorting hint for the chooser only — never a context.
  useEffect(() => {
    if (linkId) rememberLastUsedPracticeLinkId(linkId);
  }, [linkId]);

  // After an actual switch the focus belongs on the new practice, not back on a
  // control that now says something else. FocusModal restores focus on a plain
  // close, which is the right behaviour when nothing changed.
  useEffect(() => {
    if (!justSwitchedRef.current) return;
    justSwitchedRef.current = false;
    headingRef.current?.focus();
  }, [linkId]);

  const name = practice?.displayName || t.unnamedPractice;
  const details = [practice?.specialty, practice?.city].filter(Boolean).join(" · ");
  // After a switch the practice name alone is not orientation: the patient may
  // hold a second relationship with the same practice for a family profile.
  const forWhom = patientContextLabel(patientProfileName, t);

  const handleSelect = (nextLinkId) => {
    justSwitchedRef.current = true;
    setSwitcherOpen(false);
    navigate(switchTargetPath(location.pathname, nextLinkId));
  };

  return (
    <div className="practice-context-bar">
      <PracticeAvatar practice={practice} />

      <div className="practice-context-bar__identity">
        <h2
          className="practice-context-bar__name"
          ref={headingRef}
          tabIndex={-1}
          data-testid="scoped-practice-name"
        >
          {name}
        </h2>
        <p className="practice-context-bar__for" data-testid="scoped-patient-context">
          {forWhom}
        </p>
        {details ? <p className="practice-context-bar__details">{details}</p> : null}
        {!isActiveRelationship ? (
          <p className="practice-context-bar__status">{t.statusFormer}</p>
        ) : null}
      </div>

      <button
        type="button"
        className="practice-context-bar__switch"
        onClick={() => setSwitcherOpen(true)}
        aria-haspopup="dialog"
        aria-label={t.switchAria.replace("{practice}", `${name}, ${forWhom}`)}
      >
        {t.switchAction}
      </button>

      <PracticeSwitcherDialog
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onSelect={handleSelect}
        currentLinkId={linkId}
        t={t}
      />
    </div>
  );
}
