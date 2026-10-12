import React, { useMemo, useState } from "react";
import type { SaveData } from "../lib/save";
import {
  ACHIEVEMENT_STATS,
  normalizeFieldValue,
  readMetadata,
  readStat,
  setMetadataField,
  writeStat,
} from "../lib/metadata";
import type { MetadataField } from "../lib/metadata";
import "./metadata-editor.css";
import { useI18n } from "../i18n";

interface Props {
  save: SaveData;
  /** Bumped by the controller whenever the save is mutated, to trigger a re-render. */
  revision: number;
  onChanged: () => void;
}

const MONOSPACE_GROUPS = new Set(["Input"]);

export default function MetadataEditor({
  save,
  revision,
  onChanged,
}: Props): React.JSX.Element {
  const { t, fieldLabel, fieldGroup } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Profile: true,
    Currency: true,
  });

  const fields = useMemo(() => readMetadata(save), [save, revision]);
  const counters = useMemo(
    () =>
      ACHIEVEMENT_STATS.map((s) => ({
        ...s,
        value: readStat(save, s.name),
      })).filter((s) => s.value !== undefined),
    [save, revision],
  );

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? fields.filter(
        (f) =>
          f.name.toLowerCase().includes(needle) ||
          (f.spec.label ?? "").toLowerCase().includes(needle) ||
          f.value.toLowerCase().includes(needle),
      )
    : fields;

  const groups: Array<[string, MetadataField[]]> = [];
  for (const f of visible) {
    const last = groups[groups.length - 1];
    if (last && last[0] === f.spec.group) last[1].push(f);
    else groups.push([f.spec.group, [f]]);
  }

  const handleField = (field: MetadataField, raw: string): void => {
    setMetadataField(save, field.name, normalizeFieldValue(field.spec, raw));
    onChanged();
  };

  const handleCounter = (name: string, raw: string): void => {
    writeStat(
      save,
      name,
      normalizeFieldValue({ group: "", kind: "integer" }, raw),
    );
    onChanged();
  };

  const toggleGroup = (group: string): void =>
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  return (
    <section className="metadata-editor">
      <div className="section-head">
        <h2 style={{ margin: 0 }}>{t("saveMetadata")}</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="search"
            className="form-control"
            placeholder={t("filterFields")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: "16rem" }}
          />
          <button
            type="button"
            className="chip"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide" : `Show ${fields.length} fields`}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <p className="hint">
            {t("metadataBlurb")} <code>{t("metadataVersionWord")}</code>{" "}
            {t("metadataBlurbTail")}
          </p>

          {groups.map(([group, items]) => {
            const isOpen = needle ? true : (openGroups[group] ?? false);
            return (
              <div className="group" key={group}>
                <button
                  type="button"
                  className="group-head"
                  onClick={() => toggleGroup(group)}
                >
                  <span className="caret">{isOpen ? "▾" : "▸"}</span>
                  {group}
                  <span className="count">{items.length}</span>
                </button>
                {isOpen ? (
                  <div className="fields">
                    {items.map((f) => (
                      <Field
                        key={f.name}
                        field={f}
                        mono={MONOSPACE_GROUPS.has(f.spec.group)}
                        onChange={(v) => handleField(f, v)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="group">
            <button
              type="button"
              className="group-head"
              onClick={() => toggleGroup("AchievementCounters")}
            >
              <span className="caret">
                {(openGroups["AchievementCounters"] ?? false) ? "▾" : "▸"}
              </span>
              {t("achievementCounters")}
              <span className="count">{counters.length}</span>
            </button>
            {(openGroups["AchievementCounters"] ?? false) ? (
              <>
                <p className="hint">
                  Several achievements read these counters. Granting an
                  achievement does not update them, which is why an unlocked
                  achievement can still show 0 progress in game.
                </p>
                <div className="fields">
                  {counters.map((c) => (
                    <label className="field" key={c.name}>
                      <span className="field-label" title={c.name}>
                        {c.label}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={c.value ?? "0"}
                        onChange={(e) => handleCounter(c.name, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

interface FieldProps {
  field: MetadataField;
  mono: boolean;
  onChange: (value: string) => void;
}

function Field({ field, mono, onChange }: FieldProps): React.JSX.Element {
  const { spec, name, value } = field;
  const label = spec.label ?? name;

  if (spec.kind === "boolean") {
    return (
      <label className="field field-boolean">
        <span className="field-label" title={name}>
          {label}
        </span>
        <input
          type="checkbox"
          checked={value === "1"}
          onChange={(e) => onChange(e.target.checked ? "1" : "0")}
        />
      </label>
    );
  }

  if (spec.kind === "select") {
    const options = spec.options ?? [];
    // A value the game wrote that is not in our list still has to be visible, or the field would
    // silently look like it changed.
    const extra = value !== "" && !options.includes(value) ? [value] : [];
    return (
      <label className="field">
        <span className="field-label" title={spec.note ?? name}>
          {label}
          {spec.note ? <em className="field-note"> ⚠</em> : null}
        </span>
        <select
          value={value}
          title={spec.note ?? name}
          onChange={(e) => onChange(e.target.value)}
        >
          {[...extra, ...options].map((o) => (
            <option key={o} value={o}>
              {o}
              {!options.includes(o) ? " (unknown)" : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      <span className="field-label" title={name}>
        {label}
        {spec.note ? <em className="field-note"> ⚠</em> : null}
      </span>
      <input
        type={spec.kind === "text" ? "text" : "number"}
        className={mono ? "mono" : undefined}
        value={value}
        step={spec.kind === "float" ? "any" : undefined}
        min={spec.kind === "integer" ? 0 : undefined}
        max={spec.max}
        title={spec.note ?? name}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
