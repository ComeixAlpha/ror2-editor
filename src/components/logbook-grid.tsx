/**
 * The logbook grid.
 *
 * An entry is "seen" when its token is present in `viewedViewables`. Anything the player has not
 * looked at is drawn dim, which is the black tile the game shows; seen entries get the same yellow
 * treatment as a granted challenge, so "have I looked at this" reads the same way in both tabs.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LOGBOOK_CATEGORY_ORDER,
  logbookByCategory,
  logbookEntries,
  logbookEntryToken,
  logbookIconUrl,
} from "../data/logbook";
import type { LogbookEntry } from "../data/logbook";
import type { SaveData } from "../lib/save";
import "./logbook-grid.css";
import RichText from "./rich-text";
import { useI18n } from "../i18n";
import type { I18n } from "../i18n";

/**
 * The game's own name for a journal category, so the chips read the same as the in-game journal.
 *
 * `LOGBOOK_CATEGORY_LABELS` holds hardcoded English; the game's language files key off the token,
 * which is built from the catalogue's category id.
 */
function categoryLabel(gameString: I18n["g"], category: string): string {
  return gameString(`LOGBOOK_CATEGORY_${category.toUpperCase()}`, category);
}

/**
 * How long the card survives after the pointer leaves one tile for another.
 *
 * Only ever applies to tile -> tile movement. Leaving the grid at all, or leaving the tile for a
 * spot with no entry under it, closes the card straight away.
 */
const TIP_GRACE_MS = 260;

/** Must match the `tip-out` animation in logbook-grid.css. */
const TIP_EXIT_MS = 130;

/** Which entry the card is describing, and where the pointer was when it appeared. */
interface TipState {
  entry: LogbookEntry;
  x: number;
  y: number;
}

interface Props {
  save: SaveData;
  /** Bumped by the controller whenever the save is mutated, to trigger a re-render. */
  revision: number;
  onChanged: () => void;
}

export default function LogbookGrid({
  save,
  revision,
  onChanged,
}: Props): React.JSX.Element {
  const { t, g, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | "all">("all");
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  // The token just marked seen, so its tile can play a one-shot flourish. A class-driven keyframe
  // is used rather than a plain transition because a transition on its own was too subtle to read
  // on a 90px tile.
  const [justSeen, setJustSeen] = useState<string | null>(null);
  // The hover card. Captions under each tile were removed because they crowded the grid; the name
  // and the entry's game data now live in a card that follows the pointer.
  const [tip, setTip] = useState<TipState | null>(null);
  // While true the card plays its exit animation; it unmounts when that finishes.
  const [closing, setClosing] = useState(false);
  const tipGrace = useRef<number | null>(null);
  const tipExit = useRef<number | null>(null);

  const clearTimers = (): void => {
    if (tipGrace.current !== null) {
      window.clearTimeout(tipGrace.current);
      tipGrace.current = null;
    }
    if (tipExit.current !== null) {
      window.clearTimeout(tipExit.current);
      tipExit.current = null;
    }
  };

  const showTip = (entry: LogbookEntry, x: number, y: number): void => {
    // Cancelling the pending close is what makes a quick sweep across tiles feel like one card:
    // the element stays mounted and only its contents change.
    clearTimers();
    setClosing(false);
    setTip({ entry, x, y });
  };

  /** Starts the close. The card stays mounted, shrinking away, until the animation is done. */
  const closeTip = (): void => {
    clearTimers();
    setClosing(true);
    tipExit.current = window.setTimeout(() => {
      setTip(null);
      setClosing(false);
      tipExit.current = null;
    }, TIP_EXIT_MS);
  };

  /** Pointer left a tile. Another tile may still claim the card within the grace window. */
  const leaveTile = (): void => {
    clearTimers();
    tipGrace.current = window.setTimeout(() => {
      tipGrace.current = null;
      closeTip();
    }, TIP_GRACE_MS);
  };

  // A pending timer must not fire into an unmounted component.
  useEffect(() => clearTimers, []);

  const seen = useMemo(() => new Set(save.viewables), [save, revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logbookEntries.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      // "unseen" is the useful filter: those are the black tiles.
      if (onlyUnseen && seen.has(e.token)) return false;
      if (!needle) return true;
      return (
        e.name.toLowerCase().includes(needle) ||
        e.token.toLowerCase().includes(needle)
      );
    });
  }, [search, category, onlyUnseen, seen]);

  const unseenTotal = logbookEntries.length - seen.size;

  const toggle = (entry: LogbookEntry): void => {
    const nowSeen = !seen.has(entry.token);
    save.setViewableViewed(entry.token, nowSeen);
    save.commit();
    onChanged();
    if (nowSeen) {
      setJustSeen(entry.token);
      window.setTimeout(() => setJustSeen((t) => (t === entry.token ? null : t)), 700);
    }
  };

  const markAll = (viewed: boolean): void => {
    const scope =
      category === "all"
        ? logbookEntries
        : (logbookByCategory[category] ?? ([] as LogbookEntry[]));
    for (const e of scope) save.setViewableViewed(e.token, viewed);
    save.commit();
    onChanged();
  };

  return (
    <div className="logbook-pane">
      <div className="list-head">
        <div className="search-row">
          <input
            type="search"
            className="form-control"
            placeholder={t("searchLogbook")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="chip" onClick={() => markAll(true)}>
            {t("markSeen")}
            {category === "all" ? "" : ` · ${categoryLabel(g, category)}`}
          </button>
          <button type="button" className="chip" onClick={() => markAll(false)}>
            {t("markUnseen")}
          </button>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${category === "all" ? "active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All ({logbookEntries.length})
          </button>
          {LOGBOOK_CATEGORY_ORDER.map((c) => {
            const n = logbookByCategory[c]?.length ?? 0;
            if (!n) return null;
            return (
              <button
                type="button"
                key={c}
                className={`chip ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {categoryLabel(g, c)} ({n})
              </button>
            );
          })}
          <label className="chip-toggle">
            <input
              type="checkbox"
              checked={onlyUnseen}
              onChange={(e) => setOnlyUnseen(e.target.checked)}
            />
            {t("onlyUnseen")}
          </label>
          <span className="list-count">
            {unseenTotal} not seen · showing {filtered.length}
          </span>
        </div>
      </div>

      <div className="list-body">
        {filtered.length === 0 ? (
          <p className="empty">{t("noLogbookEntries")}</p>
        ) : category === "Stage" ? (
          // Stage previews are landscape (480x288, or 512x256 for the expansions). A square tile
          // letterboxes them down to a stamp, so opening this category gives each stage its own
          // full-width card whose height is whatever the picture makes.
          <div className="stage-list">
            {filtered.map((e) => (
              <StageCard
                key={e.token}
                entry={e}
                seen={seen.has(e.token)}
                justSeen={justSeen === e.token}
                onToggle={() => toggle(e)}
              />
            ))}
          </div>
        ) : (
          // Leaving this container means the pointer is nowhere near an entry, so the card is
          // closed at once rather than waiting out the tile-to-tile grace window.
          <div className="logbook-grid" onMouseLeave={closeTip}>
            {filtered.map((e) => (
              <LogbookTile
                key={e.token}
                entry={e}
                seen={seen.has(e.token)}
                justSeen={justSeen === e.token}
                onToggle={() => toggle(e)}
                onHoverStart={(x, y) => showTip(e, x, y)}
                onHoverEnd={leaveTile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rendered into `document.body`: the list scrolls, so a card inside the tile would be
          clipped by the scroll container. The constant key keeps the element alive across a quick
          move between tiles, which is what lets it slide instead of blinking. */}
      {tip
        ? createPortal(
            <LogbookTooltip
              key="logbook-tip"
              entry={tip.entry}
              seen={seen.has(tip.entry.token)}
              initial={{ x: tip.x, y: tip.y }}
              closing={closing}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

interface TooltipProps {
  entry: LogbookEntry;
  seen: boolean;
  /** Where the pointer was when the card first appeared. Ignored after the first render. */
  initial: { x: number; y: number };
  /** True while the exit animation is playing. */
  closing: boolean;
}

/**
 * Floating card describing one entry, pinned to the upper right of the pointer.
 *
 * It tracks the mouse itself rather than taking a position as a prop: the position changes every
 * frame, and keeping that state in here means the grid of several hundred tiles never re-renders
 * just because the pointer moved.
 *
 * Two nested elements on purpose. The outer one carries the placement on `transform`, the inner one
 * carries the scale animation -- they cannot share an element, because a running animation overrides
 * an inline `transform` and would yank the card back to the viewport origin for its duration.
 */
function LogbookTooltip({
  entry,
  seen,
  initial,
  closing,
}: TooltipProps): React.JSX.Element {
  const { t, g } = useI18n();
  const WIDTH = 320;
  const GAP = 14;
  const MARGIN = 8;

  /**
   * The card is pulled toward the pointer by a spring rather than pinned to it, so it reads as a
   * body with mass: it accelerates, trails the cursor while the cursor is moving, and coasts to a
   * stop. `DAMPING` is exactly critical, which is what keeps it from overshooting.
   */
  const STIFFNESS = 380;
  const DAMPING = 2 * Math.sqrt(STIFFNESS);

  const ref = useRef<HTMLDivElement>(null);
  // Each of these needs its own object. `useRef(initial)` three times hands out the SAME object, so
  // moving one would move the others and the position comparison could never detect a change.
  const target = useRef({ ...initial });
  const current = useRef({ ...initial });
  const velocity = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState(initial);
  const [size, setSize] = useState({ w: WIDTH, h: 0 });

  useEffect(() => {
    const onMove = (ev: MouseEvent): void => {
      target.current = { x: ev.clientX, y: ev.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    let raf = 0;
    let prev = performance.now();

    const tick = (now: number): void => {
      const dt = Math.min((now - prev) / 1000, 1 / 30);
      prev = now;

      const c = current.current;
      const v = velocity.current;
      const t = target.current;

      // Semi-implicit Euler: stable at these step sizes, and simpler than solving the ODE.
      v.x += (-STIFFNESS * (c.x - t.x) - DAMPING * v.x) * dt;
      v.y += (-STIFFNESS * (c.y - t.y) - DAMPING * v.y) * dt;
      c.x += v.x * dt;
      c.y += v.y * dt;

      // Settle exactly, so the card truly goes still and the update below stops firing.
      if (
        Math.abs(c.x - t.x) < 0.3 &&
        Math.abs(c.y - t.y) < 0.3 &&
        Math.abs(v.x) < 0.5 &&
        Math.abs(v.y) < 0.5
      ) {
        c.x = t.x;
        c.y = t.y;
        v.x = 0;
        v.y = 0;
      }

      // Returning the previous object makes React bail out, so an idle card costs no renders.
      setPos((p) =>
        Math.abs(p.x - c.x) > 0.1 || Math.abs(p.y - c.y) > 0.1 ? { x: c.x, y: c.y } : p,
      );
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  // Measured so the card can be flipped at the window edges.
  //
  // `offsetWidth`/`offsetHeight`, never `getBoundingClientRect()`: the rect includes transforms, so
  // measuring during the scale-in reported a shrinking card and made the placement jump every frame.
  // Re-measured only when the contents change, since that is the only thing that resizes it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, [entry]);

  // Upper right of the pointer, flipping across it when there is no room.
  let left = pos.x + GAP;
  if (left + size.w > window.innerWidth - MARGIN) left = pos.x - GAP - size.w;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - size.w - MARGIN));

  let top = pos.y - GAP - size.h;
  if (top < MARGIN) top = Math.min(pos.y + GAP, window.innerHeight - size.h - MARGIN);
  top = Math.max(MARGIN, top);

  // The pickup's own text, in the chosen language. Absent for everything but items and equipment.
  const description = entry.description
    ? g(entry.descriptionToken, entry.description)
    : undefined;

  // The lines the card reports, in the order the game shows them.
  const facts: Array<[string, string]> = [];  if (entry.tier) facts.push([t("factTier"), entry.tier]);
  if (entry.kind && entry.category === "Monster") facts.push([t("factType"), entry.kind]);
  if (entry.health !== undefined && entry.health > 0) {
    facts.push([t("factBaseHealth"), entry.health.toLocaleString()]);
  }
  if (entry.stageOrder) facts.push([t("factStage"), String(entry.stageOrder)]);
  if (entry.droneTier !== undefined) facts.push([t("factDroneTier"), String(entry.droneTier)]);
  if (entry.sortPosition !== undefined && entry.category !== "Drone") {
    facts.push([t("factSortOrder"), String(entry.sortPosition)]);
  }
  if (entry.achievementClass) {
    // Trim the namespace so the row stays a readable width.
    const short = entry.achievementClass.replace(/^RoR2\.Achievements\./, "");
    facts.push([t("factClass"), short]);
  }
  facts.push([t("factCategory"), categoryLabel(g, entry.category)]);
  facts.push([t("factGamePosition"), `#${entry.order + 1}`]);

  return (
    <div
      className="logbook-tip"
      style={{
        width: WIDTH,
        // Placement only. A transform rather than `left`/`top` keeps it on the compositor, so
        // chasing the pointer does not relayout the page on every frame.
        transform: `translate3d(${left}px, ${top}px, 0)`,
      }}
    >
      <div ref={ref} className={`tip-card${closing ? " closing" : ""}`} role="tooltip">
        <div className="tip-head">
          <span className="tip-name">{g(logbookEntryToken(entry), entry.name)}</span>
          <span className={`tip-state ${seen ? "seen" : "unseen"}`}>
            {seen ? t("seen") : t("notSeen")}
          </span>
        </div>
        {/* What the pickup actually does, straight from the game and in its colours. Placed above
            the facts table because for an item this is the part worth reading. */}
        {description ? (
          <p className="tip-desc">
            <RichText text={description} />
          </p>
        ) : null}
        <dl className="tip-facts">
          {facts.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="tip-token">{entry.token}</div>
      </div>
    </div>
  );
}

interface StageCardProps {
  entry: LogbookEntry;
  seen: boolean;
  /** True for the moment right after this entry was marked seen, to play the flourish. */
  justSeen: boolean;
  onToggle: () => void;
}

/**
 * A stage entry: the preview spans the full width of the list and the card's height is whatever
 * that makes the picture, so nothing is cropped, stretched or letterboxed.
 */
function StageCard({ entry, seen, justSeen, onToggle }: StageCardProps): React.JSX.Element {
  const { t, g } = useI18n();
  const url = logbookIconUrl(entry.token);
  const [failed, setFailed] = useState(false);
  const showImage = url !== undefined && !failed;

  return (
    <button
      type="button"
      className={`stage-card ${seen ? "seen" : "unseen"}${justSeen ? " just-seen" : ""}`}
      onClick={onToggle}
      title={`${g(logbookEntryToken(entry), entry.name)}\n${entry.token}\n\n${
        seen ? t("clickToMarkUnseen") : t("clickToMarkSeen")
      }`}
      aria-pressed={seen}
    >
      {showImage ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="glyph" aria-hidden="true">
          ?
        </span>
      )}
      <span className="label">
        {/* Always rendered: the CSS fades it out on `seen`, which a conditional render could not
            animate because the element would be gone before the transition could run. */}
        <span className="new-dot" aria-hidden="true" title={t("notSeenYet")}>
          ●
        </span>
        <span className="name">{g(logbookEntryToken(entry), entry.name)}</span>
        <span className="state">{seen ? t("seen") : t("notSeen")}</span>
      </span>
    </button>
  );
}

interface TileProps {
  entry: LogbookEntry;
  seen: boolean;
  /** True for the moment right after this entry was marked seen, to play the flourish. */
  justSeen: boolean;
  onToggle: () => void;
  /** Pointer position, so the card can appear at the upper right of the cursor. */
  onHoverStart: (x: number, y: number) => void;
  onHoverEnd: () => void;
}

function LogbookTile({
  entry,
  seen,
  justSeen,
  onToggle,
  onHoverStart,
  onHoverEnd,
}: TileProps): React.JSX.Element {
  const { t, g } = useI18n();
  const url = logbookIconUrl(entry.token);
  const [failed, setFailed] = useState(false);
  const showImage = url !== undefined && !failed;

  return (
    <button
      type="button"
      className={`logbook-tile ${seen ? "seen" : "unseen"}${justSeen ? " just-seen" : ""}`}
      onClick={onToggle}
      // `title` is left off on purpose: the hover card replaces it, and a native tooltip would
      // appear on top of it after a delay.
      aria-label={`${g(logbookEntryToken(entry), entry.name)}${seen ? "" : ` (${t("notSeen")})`}`}
      onMouseEnter={(ev) => onHoverStart(ev.clientX, ev.clientY)}
      onMouseLeave={onHoverEnd}
      // Keyboard users get the same card. There is no pointer, so it anchors to the tile's middle
      // and then stays put, since no mousemove will arrive to move it.
      onFocus={(ev) => {
        const r = ev.currentTarget.getBoundingClientRect();
        onHoverStart(r.left + r.width / 2, r.top + r.height / 2);
      }}
      onBlur={onHoverEnd}
      aria-pressed={seen}
    >
      <span className="art">
        {showImage ? (
          <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <span className="glyph" aria-hidden="true">
            ?
          </span>
        )}
        {/* Always rendered: the CSS fades it out on `seen`, which a conditional render could not
            animate because the element would be gone before the transition could run. */}
        <span className="new-dot" aria-hidden="true">
          ●
        </span>
      </span>
      {/* No caption: the name lives in the hover card, which keeps the grid dense. The name is
          still announced, via `aria-label` above. */}
    </button>
  );
}
