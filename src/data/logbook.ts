/**
 * Access to the generated logbook catalogue.
 *
 * The logbook is the in-game journal. An entry appears once its unlock exists, and it stays BLACK
 * until the player has actually looked at it. That "looked at" flag is the token in
 * `UserProfile.viewedViewables`, shaped `/Logbook/<LOGBOOK_CATEGORY_*>/<language token>`.
 *
 * `generated/logbook.json` is produced by `tools/extract-icons/build-logbook.py`. The language
 * token in each entry is the asset's own `nameToken`, and the art comes from that same asset
 * (`ItemDef.pickupIconSpriteReference`) or, for achievements, from the achievement icon set.
 */
import generated from "./generated/logbook.json";
import { publicUrl } from "../lib/public-url";

export interface LogbookEntry {
  /** The string written to `<viewedViewables>`. */
  token: string;
  name: string;
  /** The game's own category label, e.g. "Itemandequipment", "Monster". */
  category: string;
  /** The game's own position within the category. See `logbookEntries` below. */
  order: number;

  // The rest is what the hover card reports. Which fields are present depends on the category, and
  // they come straight from the assets (`build-logbook.py` passes them through untouched):
  //   Item / Equipment  tier, tierIndex
  //   Monster           health, bodyName
  //   Stage             stageOrder, sceneName
  //   Drone             droneTier, sortPosition
  //   Survivor          survivorAsset, sortPosition
  //   Achievement       achievementClass
  kind?: string;
  tier?: string;
  tierIndex?: number;
  /**
   * A pickup's functional description, with the game's inline colour markup intact.
   *
   * Items and equipment only; the game gives no such text for monsters, stages or the rest. Present
   * in whatever language the catalogue was built against (English), so `descriptionToken` is what
   * the other locales are looked up by.
   */
  description?: string;
  descriptionToken?: string;
  health?: number;
  bodyName?: string;
  stageOrder?: number;
  sceneName?: string;
  droneTier?: number;
  sortPosition?: number;
  survivorAsset?: string;
  achievementClass?: string;
}

type RawEntry = {
  name: string;
  category: string;
  order: number;
} & Partial<Omit<LogbookEntry, "token" | "name" | "category" | "order">>;

const TABLE = generated.entries as Record<string, RawEntry>;
const ICONS = generated.icons as Record<string, string>;

/** The game's category ids, spelled as the language file spells them. */
export const LOGBOOK_CATEGORY_LABELS: Record<string, string> = {
  Achievements: "Achievements",
  Drone: "Drones",
  Itemandequipment: "Items & Equipment",
  Monster: "Monsters",
  Stage: "Stages",
  Survivor: "Survivors",
};

/**
 * The order the game's logbook lists its categories in.
 *
 * Taken from the in-game journal, not from the enumeration: items and equipment first, then
 * monsters, environments, survivors and drones. Achievements come last -- the game keeps them in
 * the same catalogue but they are not part of the progression run the other five follow.
 */
export const LOGBOOK_CATEGORY_ORDER = [
  "Itemandequipment",
  "Monster",
  "Stage",
  "Survivor",
  "Drone",
  "Achievements",
];

/**
 * Every entry, in the order the game itself shows them.
 *
 * Not alphabetical. The logbook follows the content catalogs' registration order, and the game's
 * language files preserve that order in their key sequence (see `key_sequence` in
 * build-logbook.py). `order` carries each entry's position in it, so the grid reads the same as
 * the in-game journal: items by item index, monsters by body index, stages in progression order,
 * achievements by class name (which is how `AchievementManager` registers them).
 */
export const logbookEntries: LogbookEntry[] = Object.entries(TABLE)
  .map(([token, info]) => ({
    ...info,
    token,
    name: info.name,
    category: info.category,
    order: info.order ?? 0,
  }))
  .sort((a, b) => {
    const ca = LOGBOOK_CATEGORY_ORDER.indexOf(a.category);
    const cb = LOGBOOK_CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
    // Within a category the game's own sequence decides. It is unique per category, so this is a
    // total order and the list is stable across renders.
    return a.order - b.order;
  });

export const logbookByCategory: Record<string, LogbookEntry[]> =
  logbookEntries.reduce(
    (acc, e) => {
      (acc[e.category] ??= []).push(e);
      return acc;
    },
    {} as Record<string, LogbookEntry[]>,
  );

/** URL of an entry's art, or undefined for the entries the bundles give no picture for. */
export function logbookIconUrl(token: string): string | undefined {
  const path = ICONS[token];
  return path ? publicUrl(`images/${path}.png`) : undefined;
}

/**
 * The language token behind an entry.
 *
 * The catalogue's viewable path ends in the asset's own `nameToken`, and that token is what the
 * game's language files key on -- which is how an entry gets its name in a language other than the
 * English baked in here.
 */
export function logbookEntryToken(entry: LogbookEntry): string {
  return entry.token.slice(entry.token.lastIndexOf("/") + 1);
}

export const logbookIconCoverage = {
  withIcon: Object.keys(ICONS).length,
  total: logbookEntries.length,
};

/** How much of the logbook the editor can draw, for reporting in the UI. */
export const logbookCategoryCounts: Record<string, number> = generated.categories as Record<
  string,
  number
>;
