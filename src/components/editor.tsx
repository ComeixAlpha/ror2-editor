import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  DLC_LABELS,
  availableDlcs,
  challenges,
} from "../data/catalog";
import type { Challenge, ChallengeCategory, Dlc } from "../data/catalog";
import { viewables } from "../data/viewables";
import {
  inspectCoverage,
  lockAll,
  toggleChallenge,
  unlockAll,
} from "../lib/save";
import type { SaveData } from "../lib/save";
import {
  FIELD_SPECS,
  normalizeFieldValue,
  setMetadataField,
} from "../lib/metadata";
import ChallengeBox from "./challenge-box";
import Button from "./button";
import MetadataEditor from "./metadata-editor";
import ValidationPanel from "./validation-panel";
import ViewableGrid from "./viewable-grid";
import LogbookGrid from "./logbook-grid";
import { logbookEntries } from "../data/logbook";
import type { KnownTokens, ValidationReport } from "../lib/save-validation";
import { useI18n } from "../i18n";
import "./editor.css";

interface Props {
  save: SaveData;
  /** Bumped by the controller whenever the save is mutated, to trigger a re-render. */
  revision: number;
  onChanged: () => void;
  /**
   * Title, import/export controls and the intro text, rendered at the top of the left column.
   * A function so the export control can be told whether the save currently passes validation
   * and can ask for the reasons to be revealed.
   */
  header: (state: {
    blockedBy: string | undefined;
    onBlockedClick: () => void;
  }) => React.ReactNode;
}

const ALL_CATEGORIES: ChallengeCategory[] = [
  "survivors",
  "skills",
  "skins",
  "items",
  "artifacts",
];

/** How many challenges to append each time the list is scrolled near its end. */
const PAGE_SIZE = 24;

/**
 * The loadout/survivor viewables view is complete but not what the editor should show first: its
 * tokens are the loadout screens' seen-flags, whereas the logbook entries are the ones a player
 * actually wants to clear (an item can be unlocked and still be black in the logbook). Kept
 * behind a flag rather than deleted so it can come back once the logbook view has its own art.
 */
const SHOW_LOADOUT_VIEWABLES = false;

/**
 * Achievement ids and unlock strings this build knows about. Module-level and immutable, so it can
 * be handed to `validateSave` without invalidating a memo on every render.
 */
const KNOWN_TOKENS: KnownTokens = {
  achievements: new Set(challenges.map((c) => c.achievement)),
  unlocks: new Set(challenges.flatMap((c) => c.unlocks)),
};

export default function Editor({
  save,
  revision,
  onChanged,
  header,
}: Props): React.JSX.Element {
  const { t, dlcLabel } = useI18n();
  const [search, setSearch] = useState("");
  const [dlcFilter, setDlcFilter] = useState<Dlc | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<
    ChallengeCategory | "all"
  >("all");
  const [hideUnlocked, setHideUnlocked] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // The last validation report, passed up by the panel so export can be gated on it.
  const [report, setReport] = useState<ValidationReport | undefined>(undefined);
  // Set when the user clicks a blocked export button, to reveal the reasons.
  const [reviewRequested, setReviewRequested] = useState(false);
  // Which of the right-hand views is showing.
  const [tab, setTab] = useState<"challenges" | "viewables" | "logbook">(
    "challenges",
  );

  const unlockedSet = useMemo(
    () => new Set(save.achievements),
    [save, revision],
  );

  const coverage = useMemo(
    () => inspectCoverage(save, challenges),
    [save, revision],
  );

  // How many logbook entries are still black. Surfaced on the tab so the thing the user came here
  // for is visible without opening the tab.
  const unseenLogbook = useMemo(() => {
    const seen = new Set(save.viewables);
    return logbookEntries.reduce((n, e) => (seen.has(e.token) ? n : n + 1), 0);
  }, [save, revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return challenges.filter((c) => {
      if (dlcFilter !== "all" && c.dlc !== dlcFilter) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;
      if (hideUnlocked && unlockedSet.has(c.achievement)) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.description.toLowerCase().includes(needle) ||
        c.achievement.toLowerCase().includes(needle) ||
        c.unlocks.some((u) => u.toLowerCase().includes(needle))
      );
    });
  }, [search, dlcFilter, categoryFilter, hideUnlocked, unlockedSet]);

  // The scroll container itself, so changing a filter can snap the list back to the top.
  const listBodyRef = useRef<HTMLDivElement | null>(null);

  // The challenge just granted, so its card can play the same flourish the logbook uses.
  const [justGranted, setJustGranted] = useState<string | null>(null);

  // Any change to the filters restarts the list from the top: both the page size *and* the scroll
  // offset. Resetting only the count left the container scrolled past the end of the shorter
  // result, which made the list look like it could not return to the top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    listBodyRef.current?.scrollTo({ top: 0 });
  }, [search, dlcFilter, categoryFilter, hideUnlocked]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Infinite scroll: observe a sentinel at the end of the list and extend when it comes into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => n + PAGE_SIZE);
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return (): void => observer.disconnect();
  }, [hasMore, visibleCount, filtered.length]);

  const commit = (): void => {
    save.commit();
    onChanged();
  };

  // Stable, and it ignores a report identical to the one already stored. Without the guard the
  // panel's effect would set state on every render of the panel.
  const handleReport = React.useCallback((next: ValidationReport): void => {
    setReport((prev) => (prev === next ? prev : next));
  }, []);

  const handleToggle = (challenge: Challenge, selected: boolean): void => {
    toggleChallenge(save, challenge, selected);
    commit();
    if (selected) {
      // Drives the one-shot flourish on the card that was just granted. Only on grant: locking a
      // challenge removing the highlight does not need celebrating.
      setJustGranted(challenge.achievement);
      window.setTimeout(
        () => setJustGranted((a) => (a === challenge.achievement ? null : a)),
        700,
      );
    }
  };

  const handleUnlockAll = (): void => {
    unlockAll(
      save,
      challenges,
      dlcFilter === "all" ? {} : { dlcs: [dlcFilter] },
    );
    commit();
  };

  const handleLockAll = (): void => {
    const scoped =
      dlcFilter === "all"
        ? challenges
        : challenges.filter((c) => c.dlc === dlcFilter);
    lockAll(save, scoped);
    commit();
  };

  const applyField = (name: string, raw: string): void => {
    const spec = FIELD_SPECS[name] ?? { group: "", kind: "text" as const };
    setMetadataField(save, name, normalizeFieldValue(spec, raw));
    save.commit();
    onChanged();
  };

  const scopeLabel =
    dlcFilter === "all" ? t("unlockScopeAll") : dlcLabel(dlcFilter);

  // A save with errors would be rejected by the game, so exporting is held back until the user
  // has seen why. Warnings and notes do not block: the game tolerates both.
  const errorCount = report?.errors.length ?? 0;
  const blockedBy =
    errorCount > 0
      ? t(errorCount === 1 ? "blockedRejectOne" : "blockedReject", {
          count: errorCount,
        })
      : undefined;

  return (
    <div className="editor-layout">
      {/* ---------------------------------------------------------------- left: profile */}
      <aside className="editor-side">
        <header className="editor-header">
          {header({
            blockedBy,
            onBlockedClick: () => setReviewRequested(true),
          })}
        </header>

        <section className="panel excerpt">
          <h2>{t("profile")}</h2>

          <div className="form-group row">
            <label htmlFor="name" className="label">
              {t("profileName")}
            </label>
            <input
              type="text"
              className="form-control"
              id="name"
              value={save.profileName}
              onChange={(e) => applyField("name", e.target.value)}
            />
          </div>

          <div className="form-group row">
            <label htmlFor="coins" className="label">
              {t("lunarCoins")}
            </label>
            <input
              type="number"
              className="form-control"
              id="coins"
              min="0"
              max="2147483647"
              value={String(save.coins)}
              onChange={(e) => applyField("coins", e.target.value)}
            />
          </div>

          <div className="stats-summary">
            <span>
              <strong>{coverage.achievements.known}</strong> /{" "}
              {challenges.length} {t("achievementsWord")}
            </span>
            <span>
              <strong>{coverage.unlocks.total}</strong> {t("unlockedEntries")}
            </span>
            <span>
              {t("saveVersion")} {save.version}
            </span>
            {coverage.achievements.unknown.length > 0 ? (
              <span className="warn">
                {t("unknownAchievementsKept", {
                  count: coverage.achievements.unknown.length,
                })}
              </span>
            ) : null}
          </div>
        </section>

        <ValidationPanel
          save={save}
          revision={revision}
          known={KNOWN_TOKENS}
          onReport={handleReport}
          forceOpen={reviewRequested}
        />

        <MetadataEditor save={save} revision={revision} onChanged={onChanged} />
      </aside>

      {/* ---------------------------------------------------------------- right: challenges */}
      <section className="editor-main">
        {/* One horizontal tab strip spanning the right region. */}
        <div className="main-tabs" role="tablist" aria-label={t("saveContents")}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "challenges"}
            className={`main-tab ${tab === "challenges" ? "active" : ""}`}
            onClick={() => setTab("challenges")}
          >
            {t("tabChallenges")}
            <span className="tab-count">{challenges.length}</span>
          </button>
          {SHOW_LOADOUT_VIEWABLES ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "viewables"}
              className={`main-tab ${tab === "viewables" ? "active" : ""}`}
              onClick={() => setTab("viewables")}
            >
              {t("tabViewables")}
              <span className="tab-count">{viewables.length}</span>
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "logbook"}
            className={`main-tab ${tab === "logbook" ? "active" : ""}`}
            onClick={() => setTab("logbook")}
          >
            {t("tabLogbook")}
            <span className="tab-count">{logbookEntries.length}</span>
            {unseenLogbook > 0 ? (
              <span className="tab-alert" title={t("tabAlertTitle", { count: unseenLogbook })}>
                {unseenLogbook} {t("notSeenCount")}
              </span>
            ) : (
              <span className="tab-ok" title={t("allSeen")}>
                ✓
              </span>
            )}
          </button>
        </div>

        {tab === "logbook" ? (
          <LogbookGrid save={save} revision={revision} onChanged={onChanged} />
        ) : tab === "viewables" && SHOW_LOADOUT_VIEWABLES ? (
          <ViewableGrid save={save} revision={revision} onChanged={onChanged} />
        ) : (
          <>
            <div className="list-head">
          <div className="search-row">
            <input
              type="search"
              className="form-control"
              placeholder={t("searchChallenges")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button onClick={handleUnlockAll}>Unlock {scopeLabel}</Button>
            <Button onClick={handleLockAll}>Lock {scopeLabel}</Button>
          </div>

          <div className="chip-row">
            <button
              type="button"
              className={`chip ${dlcFilter === "all" ? "active" : ""}`}
              onClick={() => setDlcFilter("all")}
            >
              {t("allDlcs")} ({challenges.length})
            </button>
            {availableDlcs.map((d) => (
              <button
                type="button"
                key={d}
                className={`chip ${dlcFilter === d ? "active" : ""}`}
                onClick={() => setDlcFilter(d)}
              >
                {DLC_LABELS[d]} ({challenges.filter((c) => c.dlc === d).length})
              </button>
            ))}
          </div>

          <div className="chip-row">
            <button
              type="button"
              className={`chip ${categoryFilter === "all" ? "active" : ""}`}
              onClick={() => setCategoryFilter("all")}
            >
              {t("allTypes")}
            </button>
            {ALL_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                className={`chip ${categoryFilter === c ? "active" : ""}`}
                onClick={() => setCategoryFilter(c)}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
            <label className="chip-toggle">
              <input
                type="checkbox"
                checked={hideUnlocked}
                onChange={(e) => setHideUnlocked(e.target.checked)}
              />
              {t("hideUnlocked")}
            </label>
            <span className="list-count">
              showing {visible.length} of {filtered.length}
            </span>
          </div>
        </div>

        <div className="list-body" ref={listBodyRef}>
          {filtered.length === 0 ? (
            <p className="empty">{t("noChallenges")}</p>
          ) : (
            <>
              <div className="challenge-grid">
                {visible.map((challenge) => (
                  <ChallengeBox
                    key={challenge.achievement}
                    challenge={challenge}
                    unlocked={unlockedSet.has(challenge.achievement)}
                    justGranted={justGranted === challenge.achievement}
                    onToggle={handleToggle}
                  />
                ))}
              </div>

              {hasMore ? (
                <div className="sentinel" ref={sentinelRef}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Load more ({filtered.length - visible.length} remaining)
                  </button>
                </div>
              ) : (
                <p className="list-end">
                  All {filtered.length} matching challenges shown.
                </p>
              )}
            </>
          )}
        </div>
          </>
        )}
      </section>
    </div>
  );
}
