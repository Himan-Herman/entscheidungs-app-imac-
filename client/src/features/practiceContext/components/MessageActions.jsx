import { useEffect, useRef, useState } from "react";

/**
 * The actions available on ONE of the sender's own messages.
 *
 * A small menu rather than two permanent buttons under every line: editing and
 * withdrawing are rare, and a conversation of fifty messages would otherwise
 * carry a hundred controls the reader has to look past.
 *
 * The menu exists only while the message can actually be changed. A disabled
 * control would be worse than none: it advertises something the reader cannot
 * have and gives no reason (§34).
 */
export default function MessageActions({ t, onEdit, onWithdraw, onTranslate, onSimplify, speech }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Escape closes and returns focus to the trigger; clicking elsewhere closes
  // without moving focus, because the click already put it somewhere.
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onPointerDown(e) {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  // Opening moves focus into the menu, so the keyboard does not have to tab
  // through the rest of the message to reach it.
  useEffect(() => {
    if (open) menuRef.current?.querySelector("button")?.focus();
  }, [open]);

  const run = (action) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="practice-context__message-actions">
      <button
        type="button"
        ref={triggerRef}
        className="practice-context__message-actions-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        data-testid="message-actions-trigger"
      >
        {t.messageActions}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className="practice-context__message-menu"
          data-testid="message-actions-menu"
        >
          {onTranslate ? (
            <button
              type="button"
              role="menuitem"
              onClick={run(onTranslate)}
              data-testid="message-translate"
            >
              {t.translate}
            </button>
          ) : null}
          {/*
            * Read aloud sits in the same menu as everything else. One entry per
            * rendering that actually exists, named for what it reads — "read
            * the translation aloud" is a different action from "read the
            * original aloud", and a single button would have to guess.
            */}
          {speech?.speakingHere ? (
            <button
              type="button"
              role="menuitem"
              onClick={run(speech.onStop)}
              data-testid="message-speak-stop"
            >
              {t.speakStop}
            </button>
          ) : (
            (speech?.sources ?? []).map((source) => (
              <button
                key={source}
                type="button"
                role="menuitem"
                onClick={run(() => speech.onSpeak(source))}
                data-testid={`message-speak-${source}`}
              >
                {source === "original"
                  ? t.speakOriginal
                  : source === "simple"
                    ? t.speakSimple
                    : t.speakTranslation}
              </button>
            ))
          )}
          {onSimplify ? (
            <button
              type="button"
              role="menuitem"
              onClick={run(onSimplify)}
              data-testid="message-simplify"
            >
              {t.showSimple}
            </button>
          ) : null}
          {onEdit ? (
            <button type="button" role="menuitem" onClick={run(onEdit)} data-testid="message-edit">
              {t.edit}
            </button>
          ) : null}
          {onWithdraw ? (
            <button
              type="button"
              role="menuitem"
              onClick={run(onWithdraw)}
              data-testid="message-withdraw"
            >
              {t.withdraw}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
