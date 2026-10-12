/**
 * Reading and writing Risk of Rain 2 profile saves.
 *
 * Design rules, all of which exist because a previous editor damaged a real profile:
 *
 *  1. Only the nodes we intend to change are touched. Every unknown element, attribute and
 *     token in the profile is carried through untouched, so a save from a newer game version
 *     survives an edit instead of being silently trimmed.
 *  2. Achievements and unlockables are two independent lists. Granting an achievement writes
 *     the id to `achievementsList` AND the reward to `<stats><unlock>`; revoking removes both.
 *  3. Writing a list never duplicates entries. The fixture profile this project tests against
 *     already contains a 13-entry duplicated block caused by an append-instead-of-replace bug.
 *  4. `version` and every unrelated element are read and re-emitted unchanged.
 */
import {
  parseXml,
  serializeXml,
  findChild,
  findAll,
  textOf,
  setText,
} from "./xml.ts";
// Type-only imports must be separate: Node's type stripping removes them, so they cannot share
// a statement with runtime values.
import type { XmlElement, XmlNode } from "./xml.ts";

/** Split a save's space-separated list, tolerating CRLF and repeated separators. */
export function splitList(raw: string): string[] {
  return String(raw ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** De-duplicate while preserving first-seen order. */
function unique<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** A challenge as far as the save layer cares: an achievement id and its reward unlockables. */
export interface ChallengeReward {
  achievement: string;
  unlocks?: string[];
  dlc?: string;
}

/** A save's mutable state, held separately from the XML tree. */
export class SaveData {
  readonly doc: XmlNode[];
  readonly root: XmlElement;

  private readonly achievementsEl: XmlElement;
  private readonly unviewedEl: XmlElement | undefined;
  private readonly viewedUnlockablesEl: XmlElement | undefined;
  private readonly viewedViewablesEl: XmlElement | undefined;
  private readonly discoveredPickupsEl: XmlElement | undefined;
  private readonly coinsEl: XmlElement | undefined;
  private readonly nameEl: XmlElement | undefined;
  private readonly versionEl: XmlElement | undefined;
  private readonly statsEl: XmlElement | undefined;

  /** Ordered, de-duplicated view of the achievement list. */
  achievements: string[];
  /** Ordered, de-duplicated view of `<stats><unlock>`. */
  unlocks: string[];
  /**
   * Ordered, de-duplicated view of `<viewedViewables>`.
   *
   * Unlike the other two lists this one is written back only when it has actually been edited.
   * The game lays this element out with newlines and indentation, and `commit` writing it
   * unconditionally would reformat every profile the user opens without touching viewables.
   */
  viewables: string[];
  private viewablesDirty = false;

  constructor(doc: XmlNode[]) {
    this.doc = doc;
    const root = doc.find((n): n is XmlElement => n.type === "elem");
    if (!root || root.name !== "UserProfile") {
      throw new Error(
        "Not a Risk of Rain 2 profile: missing <UserProfile> root element",
      );
    }
    this.root = root;

    const found = new Map<string, XmlElement | undefined>();
    for (const name of [
      "achievementsList",
      "unviewedAchievementsList",
      "viewedUnlockablesList",
      "viewedViewables",
      "discoveredPickups",
      "coins",
      "name",
      "version",
      "stats",
    ]) {
      found.set(name, findChild(root, name));
    }

    const achievementsEl = found.get("achievementsList");
    if (!achievementsEl) {
      throw new Error(
        "Not a Risk of Rain 2 profile: missing <achievementsList>",
      );
    }

    this.achievementsEl = achievementsEl;
    this.unviewedEl = found.get("unviewedAchievementsList");
    this.viewedUnlockablesEl = found.get("viewedUnlockablesList");
    this.viewedViewablesEl = found.get("viewedViewables");
    this.discoveredPickupsEl = found.get("discoveredPickups");
    this.coinsEl = found.get("coins");
    this.nameEl = found.get("name");
    this.versionEl = found.get("version");
    this.statsEl = found.get("stats");

    this.achievements = unique(splitList(textOf(this.achievementsEl)));
    this.unlocks = unique(
      findAll(this.statsEl, "unlock")
        .map((u) => textOf(u).trim())
        .filter(Boolean),
    );
    this.viewables = unique(splitList(textOf(this.viewedViewablesEl)));
  }

  /** True once something has called `setViewableViewed`. */
  get hasViewableEdits(): boolean {
    return this.viewablesDirty;
  }

  /** Mark a viewable token seen or unseen. Returns true when the list actually changed. */
  setViewableViewed(token: string, viewed: boolean): boolean {
    const at = this.viewables.indexOf(token);
    if (viewed) {
      if (at >= 0) return false;
      this.viewables.push(token);
    } else {
      if (at < 0) return false;
      this.viewables.splice(at, 1);
    }
    this.viewablesDirty = true;
    return true;
  }

  get version(): string {
    return textOf(this.versionEl).trim();
  }

  get coins(): number {
    return Number(textOf(this.coinsEl).trim() || "0");
  }

  set coins(value: number) {
    const n = Math.max(0, Math.min(2147483647, Math.trunc(Number(value) || 0)));
    if (this.coinsEl) setText(this.coinsEl, String(n));
  }

  get profileName(): string {
    return textOf(this.nameEl);
  }

  set profileName(value: string) {
    if (this.nameEl) setText(this.nameEl, String(value ?? ""));
  }

  /**
   * Apply the in-memory state back onto the XML tree.
   * Lists are written space-separated on a single line, which is what the game itself writes.
   */
  commit(): void {
    setText(this.achievementsEl, this.achievements.join(" "));
    this.achievementsEl.selfClosing = false;
    if (this.unviewedEl) setText(this.unviewedEl, "");
    if (this.viewedUnlockablesEl) setText(this.viewedUnlockablesEl, "");

    // Only touched when the user actually edited this list; see `viewables` above.
    if (this.viewablesDirty && this.viewedViewablesEl) {
      setText(this.viewedViewablesEl, this.viewables.join(" "));
      this.viewedViewablesEl.selfClosing = false;
    }

    if (!this.statsEl) return;

    // Rebuild <unlock> children in place, preserving the surrounding <stat> nodes and their order.
    this.statsEl.children = this.statsEl.children.filter(
      (child) => !(child.type === "elem" && child.name === "unlock"),
    );
    for (const value of this.unlocks) {
      this.statsEl.children.push({
        type: "elem",
        name: "unlock",
        attrs: [],
        children: [{ type: "text", raw: value }],
        selfClosing: false,
      });
    }
  }

  toXml(): string {
    this.commit();
    return serializeXml(this.doc);
  }
}

/** Load a profile from XML text. */
export function loadSave(xml: string): SaveData {
  return new SaveData(parseXml(xml));
}

/**
 * Grant or revoke an achievement.
 * Writing `id` to achievementsList alone does nothing in-game, so the reward unlock string is
 * added to / removed from `<stats><unlock>` at the same time.
 */export function toggleChallenge(
  save: SaveData,
  challenge: ChallengeReward,
  enabled: boolean,
  catalog: ChallengeReward[] = [],
): SaveData {
  const id = challenge.achievement;
  const rewards = (challenge.unlocks ?? []).filter(Boolean);

  if (enabled) {
    if (!save.achievements.includes(id)) save.achievements.push(id);
    for (const r of rewards)
      if (!save.unlocks.includes(r)) save.unlocks.push(r);
  } else {
    save.achievements = save.achievements.filter((a) => a !== id);
    // Only drop a reward that no other still-enabled challenge also grants.
    const stillGranted = new Set<string>();
    for (const other of catalog) {
      if (other.achievement === id) continue;
      if (!save.achievements.includes(other.achievement)) continue;
      for (const r of other.unlocks ?? []) stillGranted.add(r);
    }
    for (const r of rewards) {
      if (!stillGranted.has(r))
        save.unlocks = save.unlocks.filter((u) => u !== r);
    }
  }
  return save;
}

/** Options for bulk operations. */
export interface BulkOptions {
  /** Restrict to these DLC ids. Omit to affect every challenge. */
  dlcs?: string[];
}

/**
 * Grant every challenge in the catalogue.
 */
export function unlockAll(
  save: SaveData,
  challenges: ChallengeReward[],
  options: BulkOptions = {},
): SaveData {
  const allowed = options.dlcs ? new Set(options.dlcs) : null;
  const achievements = new Set(save.achievements);
  const unlocks = new Set(save.unlocks);

  for (const c of challenges) {
    if (!c.achievement) continue;
    if (allowed && !allowed.has(c.dlc ?? "base")) continue;
    achievements.add(c.achievement);
    for (const r of c.unlocks ?? []) if (r) unlocks.add(r);
  }

  save.achievements = unique([...achievements]);
  save.unlocks = unique([...unlocks]);
  return save;
}

/**
 * Revoke every challenge given, leaving unrelated unlocks (logbook entries, newt statues, karma
 * levels) alone.
 */
export function lockAll(
  save: SaveData,
  challenges: ChallengeReward[],
): SaveData {
  const ids = new Set(challenges.map((c) => c.achievement).filter(Boolean));
  const rewards = new Set<string>();
  for (const c of challenges)
    for (const r of c.unlocks ?? []) if (r) rewards.add(r);

  save.achievements = save.achievements.filter((a) => !ids.has(a));
  save.unlocks = save.unlocks.filter((u) => !rewards.has(u));
  return save;
}

/** What a save contains versus what the catalogue knows about. */
export interface Coverage {
  achievements: { total: number; known: number; unknown: string[] };
  unlocks: { total: number; known: number; unknown: string[] };
  viewables: { total: number; known: number; unknown: string[] };
}

/**
 * Mark every token seen or unseen.
 *
 * The game decides "new" by whether a token is absent from `viewedViewables`, so marking them all
 * is what clears the loadout screen's notification dots.
 */
export function setAllViewables(
  save: SaveData,
  tokens: string[],
  viewed: boolean,
  options: { categories?: Set<string>; categoryOf?: (token: string) => string } = {},
): SaveData {
  for (const token of tokens) {
    if (options.categories && options.categoryOf) {
      if (!options.categories.has(options.categoryOf(token))) continue;
    }
    save.setViewableViewed(token, viewed);
  }
  return save;
}

/**
 * Report what a save contains versus what the catalogue knows about.
 * Used to flag unknown tokens instead of dropping them.
 */
export function inspectCoverage(
  save: SaveData,
  challenges: ChallengeReward[],
): Coverage {
  const knownAchievements = new Set(challenges.map((c) => c.achievement));
  const knownUnlocks = new Set<string>();
  for (const c of challenges)
    for (const r of c.unlocks ?? []) knownUnlocks.add(r);

  return {
    achievements: {
      total: save.achievements.length,
      known: save.achievements.filter((a) => knownAchievements.has(a)).length,
      unknown: save.achievements.filter((a) => !knownAchievements.has(a)),
    },
    unlocks: {
      total: save.unlocks.length,
      known: save.unlocks.filter((u) => knownUnlocks.has(u)).length,
      // Logbook / newt statue / karma tokens are expected here; they are not achievement rewards.
      unknown: save.unlocks.filter((u) => !knownUnlocks.has(u)),
    },
    viewables: {
      total: save.viewables.length,
      known: save.viewables.length,
      unknown: [],
    },
  };
}

/** Report viewables coverage against a token catalogue, so unknown tokens are visible. */
export function inspectViewableCoverage(
  save: SaveData,
  knownTokens: Iterable<string>,
): Coverage["viewables"] {
  const known = new Set(knownTokens);
  return {
    total: save.viewables.length,
    known: save.viewables.filter((v) => known.has(v)).length,
    unknown: save.viewables.filter((v) => !known.has(v)),
  };
}
