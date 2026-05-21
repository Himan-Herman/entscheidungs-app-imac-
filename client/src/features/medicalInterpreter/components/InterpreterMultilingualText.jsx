import {
  hasMixedScriptText,
  interpreterLangAttribute,
  interpreterTextDirection,
} from "../utils/interpreterLocale.js";

/**
 * Conversation text with per-language direction (Phase 2.6).
 * @param {{
 *   text: string;
 *   languageCode?: string;
 *   className?: string;
 *   as?: 'p' | 'div' | 'span';
 *   role?: string;
 * }} props
 */
export default function InterpreterMultilingualText({
  text,
  languageCode,
  className = "",
  as: Tag = "p",
  role,
}) {
  const content = String(text ?? "").trim() || "—";
  const dir = interpreterTextDirection(languageCode || "en");
  const lang = interpreterLangAttribute(languageCode);
  const mixed = hasMixedScriptText(content);

  const classList = [
    "interpreter-prose",
    "interpreter-multilingual",
    mixed ? "interpreter-multilingual--mixed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const Component = Tag;
  return (
    <Component className={classList} dir={dir} lang={lang} role={role}>
      {content}
    </Component>
  );
}
