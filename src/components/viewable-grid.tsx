/**
 * The viewables grid: one compact icon tile per entry in `UserProfile.viewedViewables`.
 *
 * Seen entries get the same yellow treatment as a granted challenge, so "what have I looked at"
 * reads the same way in both tabs.
 */
import React, { useMemo, useState } from "react";
import {
  VIEWABLE_CATEGORY_LABELS,
  VIEWABLE_CATEGORY_ORDER,
  viewableIconUrl,
  viewables,
  viewablesByCategory,
} from "../data/viewables";
import type { Viewable, ViewableCategory } from "../data/viewables";
import type { SaveData } from "../lib/save";
import { useI18n } from "../i18n";
import "./viewable-grid.css";

interface Props {
  save: SaveData;
  /** Bumped by the controller whenever the save is mutated, to trigger a re-render. */
  revision: number;
  onChanged: () => void;
}

export default function ViewableGrid({
  save,
  revision,
  onChanged,
}: Props): React.JSX.Element {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ViewableCategory | "all">("all");
  const [hideSeen, setHideSeen] = useState(false);

  const seen = useMemo(() => new Set(save.viewables), [save, revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return viewables.filter((v) => {
      if (category !== "all" && v.category !== category) return false;
      if (hideSeen && seen.has(v.token)) return false;
      if (!needle) return true;
      return (
        v.name.toLowerCase().includes(needle) ||
        v.token.toLowerCase().includes(needle)
      );
    });
  }, [search, category, hideSeen, seen]);

  const knownTokens = useMemo(() => viewables.map((v) => v.token), []);
  const known = useMemo(() => new Set(knownTokens), [knownTokens]);
  const unknownCount = save.viewables.filter((t) => !known.has(t)).length;

  const toggle = (viewable: Viewable): void => {
    save.setViewableViewed(viewable.token, !seen.has(viewable.token));
    save.commit();
    onChanged();
  };

  const setAll = (viewed: boolean): void => {
    // Scope the bulk action to whatever the filters currently show, so "mark all seen" while
    // filtered to Skills does not touch skins.
    const scope =
      category === "all"
        ? viewables
        : (viewablesByCategory[category] ?? ([] as Viewable[]));
    for (const v of scope) {
      if (hideSeen && viewed === false) continue;
      save.setViewableViewed(v.token, viewed);
    }
    save.commit();
    onChanged();
  };

  return (
    <div className="viewable-pane">
      <div className="list-head">
        <div className="search-row">
          <input
            type="search"
            className="form-control"
            placeholder={t("searchViewables")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="chip" onClick={() => setAll(true)}>
            {t("markSeen")}
          </button>
          <button type="button" className="chip" onClick={() => setAll(false)}>
            {t("markUnseen")}
          </button>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${category === "all" ? "active" : ""}`}
            onClick={() => setCategory("all")}
          >
            {t("allWord")} ({viewables.length})
          </button>
          {VIEWABLE_CATEGORY_ORDER.map((c) => {
            const n = viewablesByCategory[c]?.length ?? 0;
            if (!n) return null;
            return (
              <button
                type="button"
                key={c}
                className={`chip ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {VIEWABLE_CATEGORY_LABELS[c]} ({n})
              </button>
            );
          })}
          <label className="chip-toggle">
            <input
              type="checkbox"
              checked={hideSeen}
              onChange={(e) => setHideSeen(e.target.checked)}
            />
            {t("hideSeen")}
          </label>
          <span className="list-count">
            {t("seenOfTotal", { seen: seen.size, total: viewables.length })}
            {unknownCount > 0 ? ` ${t("unknownKept", { count: unknownCount })}` : ""}
          </span>
        </div>
      </div>

      <div className="list-body">
        {filtered.length === 0 ? (
          <p className="empty">{t("noViewables")}</p>
        ) : (
          <div className="viewable-grid">
            {filtered.map((v) => (
              <ViewableTile
                key={v.token}
                viewable={v}
                seen={seen.has(v.token)}
                onToggle={() => toggle(v)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TileProps {
  viewable: Viewable;
  seen: boolean;
  onToggle: () => void;
}

function ViewableTile({ viewable, seen, onToggle }: TileProps): React.JSX.Element {
  const url = viewableIconUrl(viewable.token);
  const [failed, setFailed] = useState(false);
  const showImage = url !== undefined && !failed;

  return (
    <button
      type="button"
      className={`viewable-tile ${seen ? "seen" : ""}`}
      onClick={onToggle}
      title={`${viewable.name}\n${viewable.token}`}
      aria-pressed={seen}
    >
      <span className="art">
        {showImage ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          // Settings entries ship no art; a glyph keeps the grid's rhythm.
          <span className="glyph" aria-hidden="true">
            {viewable.category === "setting" ? "⚙" : "?"}
          </span>
        )}
      </span>
      <span className="caption">{viewable.name}</span>
    </button>
  );
}
