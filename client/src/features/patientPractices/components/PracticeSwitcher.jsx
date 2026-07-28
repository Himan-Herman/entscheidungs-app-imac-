import { useRef } from "react";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import "./PracticeSwitcher.css";

/**
 * Accessible switch between the patient's connected practices.
 *
 * A real ARIA tablist: arrow keys move between practices, Home/End jump to the
 * ends, and the selected practice is announced through aria-selected rather
 * than being signalled by colour alone (it also carries a check mark and a
 * heavier weight).
 *
 * With a single connection there is nothing to switch, so no control is
 * rendered at all — the practice name is shown by the section heading.
 *
 * The practice id never reaches the DOM as visible text or a data attribute;
 * it is used only as the React key and the selection value.
 *
 * @param {{
 *   links: Array<{ id: string, practice?: object | null }>,
 *   activeLinkId: string,
 *   onSelect: (linkId: string) => void,
 *   label: string,
 * }} props
 */
export default function PracticeSwitcher({ links, activeLinkId, onSelect, label }) {
  const refs = useRef({});

  if (!Array.isArray(links) || links.length < 2) return null;

  function focusAt(index) {
    const next = links[(index + links.length) % links.length];
    if (!next) return;
    onSelect(next.id);
    // Keep the focus on the practice the user moved to, so a keyboard user
    // never loses their place after switching.
    refs.current[next.id]?.focus();
  }

  function handleKeyDown(event, index) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(links.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className="practice-switcher" role="tablist" aria-label={label}>
      {links.map((link, index) => {
        const name = practiceDisplayLabel(link.practice);
        const specialty = link.practice?.specialty?.trim() || "";
        const selected = link.id === activeLinkId;
        return (
          <button
            key={link.id}
            ref={(el) => { refs.current[link.id] = el; }}
            type="button"
            role="tab"
            id={`practice-tab-${index}`}
            aria-selected={selected}
            aria-current={selected ? "true" : undefined}
            aria-controls={`practice-panel-${index}`}
            tabIndex={selected ? 0 : -1}
            className={`practice-switcher__tab${selected ? " practice-switcher__tab--active" : ""}`}
            onClick={() => onSelect(link.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="practice-switcher__check" aria-hidden="true">
              {selected ? "✓" : ""}
            </span>
            <span className="practice-switcher__name">{name}</span>
            {specialty ? (
              <span className="practice-switcher__specialty">{specialty}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
