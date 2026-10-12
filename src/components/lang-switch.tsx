/**
 * The EN / 中文 switch.
 *
 * A full-width segmented control with a sliding thumb, sitting under the import/export buttons in
 * the left column. Full width rather than content width so it lines up with the button above it,
 * which spans its column on the import screen.
 *
 * Marked up as a radio group: it is a binary preference, not a set of tabs with panels behind them,
 * so `role="tab"` would promise something that is not there.
 */
import React from "react";
import { LANGS } from "../i18n/lang";
import { useI18n } from "../i18n";
import "./lang-switch.css";

export default function LangSwitch(): React.JSX.Element {
  const { lang, setLang } = useI18n();
  const index = Math.max(
    0,
    LANGS.findIndex((l) => l.id === lang),
  );

  return (
    <div className="lang-switch" role="radiogroup" aria-label="Language / 语言">
      {/* The thumb is a sibling of the buttons, behind them, and slides by its own width. It is
          decorative: the buttons carry the state for assistive tech. */}
      <span
        className="lang-thumb"
        aria-hidden="true"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          className={`lang-option ${lang === l.id ? "active" : ""}`}
          onClick={() => setLang(l.id)}
          title={l.title}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
