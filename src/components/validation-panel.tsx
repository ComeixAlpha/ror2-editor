/**
 * Shows the result of `validateSave` for the profile currently open.
 *
 * The rules come from the game's own deserialiser (`RoR2.UserProfile` / `XmlUtility` /
 * `SaveFieldAttribute`), so an error here means the game would reject the file or throw while
 * loading it. Warnings are things the game tolerates but that usually mean the file was edited by
 * something that did not understand it.
 */
import React, { useMemo, useState } from "react";
import type { SaveData } from "../lib/save";
import { summariseReport, validateSave } from "../lib/save-validation";
import type {
  KnownTokens,
  ValidationIssue,
  ValidationReport,
} from "../lib/save-validation";
import "./validation-panel.css";
import { useI18n } from "../i18n";

interface Props {
  save: SaveData;
  /** Bumped by the controller whenever the save is mutated, to trigger a re-render. */
  revision: number;
  /** Sets used to check that achievement and unlock tokens resolve. Must be referentially stable. */
  known?: KnownTokens;
  /**
   * Called with the current report whenever it changes, so a parent can gate exporting on it.
   * Receives `forceOpen` so a click on a blocked export button can reveal the details.
   */
  onReport?: (report: ValidationReport) => void;
  /** When true, the panel expands even with no issues. */
  forceOpen?: boolean;
}

const SEVERITY_MARK: Record<ValidationIssue["severity"], string> = {
  error: "✖",
  warning: "!",
  info: "·",
};

export default function ValidationPanel({
  save,
  revision,
  known,
  onReport,
  forceOpen,
}: Props): React.JSX.Element {
  const { t } = useI18n();
  const report = useMemo(
    () => validateSave(save, known),
    // `revision` is the signal that the in-place save document changed.
    [save, revision, known],
  );

  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;

  // Report upward for the export gate. `useEffect` would run a frame late; the parent only needs
  // the latest value to decide whether the button is blocked, so calling during render is fine
  // as long as the callback is stable.
  React.useEffect(() => {
    onReport?.(report);
  }, [report, onReport]);

  if (report.issues.length === 0 && !forceOpen) {
    return (
      <section className="validation-panel ok">
        <span className="badge ok">✓</span>
        <span className="summary">{t("saveCheckOk")}</span>
      </section>
    );
  }

  const tone = report.errors.length ? "bad" : "warn";

  return (
    <section className={`validation-panel ${tone}`}>
      <button
        type="button"
        className="head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
      >
        <span className={`badge ${tone}`}>
          {report.errors.length ? "✖" : "!"}
        </span>
        <span className="summary">Save check: {summariseReport(report)}</span>
        <span className="caret">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <ul className="issues">
          {report.issues.map((issue, i) => (
            <li key={`${issue.where}-${i}`} className={issue.severity}>
              <span className="mark">{SEVERITY_MARK[issue.severity]}</span>
              <span className="body">
                <code className="where">{issue.where}</code> {issue.message}
                {issue.hint ? <span className="hint">{issue.hint}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
