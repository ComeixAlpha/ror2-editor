/**
 * Access to the generated challenge catalogue.
 *
 * `generated/challenges.json` is produced from the installed game by `tools/build-data.ps1`
 * (see tools/KNOWN-GAPS.md). It is the single source of truth for achievements, their
 * unlockable rewards, prerequisites and DLC attribution -- there are no hand-written tables.
 *
 * Icons come from two places, in priority order:
 *   1. `public/images/achievements/<slug>.png`, extracted straight out of the game's own asset
 *      bundles by `tools/extract-icons/extract.py` (see that script's docstring). This is the
 *      authoritative source and covers most achievements.
 *   2. `challenge-icons.json`, a curated table carried over from the pre-rewrite editor, which
 *      points at `public/images/{webp,png}/<path>`. Used for anything step 1 does not cover.
 *
 * Achievements with neither render a placeholder.
 */
import generated from "../data/generated/challenges.json";
import iconTable from "./challenge-icons.json";
import extracted from "./generated/extracted-icons.json";
import { publicUrl } from "../lib/public-url";

const ICONS: Record<string, string> = iconTable.icons as Record<string, string>;
const EXTRACTED: Record<string, string> = extracted.icons as Record<string, string>;

/** Achievement id -> URL path of its icon. */
export function iconUrlFor(achievement: string): string | undefined {
  const extractedSlug = EXTRACTED[achievement];
  if (extractedSlug) return publicUrl(`images/achievements/${extractedSlug}.png`);
  const legacy = ICONS[achievement];
  if (legacy) return publicUrl(`images/webp/${legacy}.webp`);
  return undefined;
}

/** URL path of the PNG fallback for a legacy icon, used when the browser cannot take webp. */
export function iconFallbackUrlFor(achievement: string): string | undefined {
  const legacy = ICONS[achievement];
  return legacy ? publicUrl(`images/png/${legacy}.png`) : undefined;
}

/** How many catalogue entries have an icon, for reporting in the UI. */
export const iconCoverage = {
  extracted: Object.keys(EXTRACTED).length,
  curated: Object.keys(ICONS).length,
  covered: (generated.challenges as Array<{ achievement: string }>).filter(
    (c) => EXTRACTED[c.achievement] || ICONS[c.achievement],
  ).length,
  total: (generated.challenges as unknown[]).length,
};

export type Dlc = "base" | "sotv" | "sots" | "ac" | "hc";

export const DLC_ORDER: Dlc[] = ["base", "sotv", "sots", "ac", "hc"];

export const DLC_LABELS: Record<Dlc, string> = {
  base: "Base Game",
  sotv: "Survivors of the Void",
  sots: "Seekers of the Storm",
  ac: "Alloyed Collective",
  hc: "Hallowed Concepts",
};

export const DLC_SHORT_LABELS: Record<Dlc, string> = {
  base: "Base",
  sotv: "Void",
  sots: "Storm",
  ac: "Alloyed",
  hc: "Hallowed",
};

export type ChallengeCategory =
  "survivors" | "skills" | "skins" | "items" | "artifacts" | "other";

export const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  survivors: "Survivors",
  skills: "Skills",
  skins: "Skins",
  items: "Items & Equipment",
  artifacts: "Artifacts",
  other: "Other",
};

export interface Challenge {
  /** Stable slug; equals `achievement` for generated entries. */
  id: string;
  /** The string written to `<achievementsList>`. */
  achievement: string;
  name: string;
  description: string;
  /** UnlockableDef asset names written to `<stats><unlock>`. */
  unlocks: string[];
  category: ChallengeCategory;
  dlc: Dlc;
  lunarCoins: number | null;
  /** Achievement that must be earned first, if any. */
  prerequisite: string | null;
  /** "game" when the display name came from the game's own language files. */
  displayNameSource: "game" | "identifier";
  /** Language file the display name was read from, e.g. "DLC4.json". */
  languageFile: string | null;
}

export const challenges: Challenge[] = generated.challenges as Challenge[];

/** Total number of achievements the catalogue knows about. */
export const challengeCount = challenges.length;

/** Achievement ids grouped by DLC, for bulk operations. */
export const challengesByDlc: Record<string, Challenge[]> = challenges.reduce(
  (acc, c) => {
    (acc[c.dlc] ??= []).push(c);
    return acc;
  },
  {} as Record<string, Challenge[]>,
);

/** DLCs actually present in the catalogue, in display order. */
export const availableDlcs: Dlc[] = DLC_ORDER.filter(
  (d) => (challengesByDlc[d]?.length ?? 0) > 0,
);

/**
 * Which DLC unlocks the reward a challenge grants.
 * Used to tell the UI "this is a base-game survivor's skin, but it needs the Hallowed Concepts
 * expansion" -- the achievement's own DLC is about where its text lives, not what it needs.
 */
export function requiredDlcForUnlock(unlock: string): Dlc {
  const [ns, survivor] = unlock.split(".");
  if (ns === "Characters") return SURVIVOR_DLC[survivor] ?? "base";
  if ((ns === "Skills" || ns === "Skins") && survivor)
    return SURVIVOR_DLC[survivor] ?? "base";
  if (ns === "Karma") return "hc";
  return "base";
}

const SURVIVOR_DLC: Record<string, Dlc> = {
  Railgunner: "sotv",
  VoidSurvivor: "sotv",
  Seeker: "sots",
  Chef: "sots",
  FalseSon: "sots",
  Drifter: "ac",
  DroneTech: "ac",
  Acolyte: "hc",
  Enforcer2: "hc",
};

/** Display name for a challenge's reward, for use as a subtitle. */
export function describeUnlocks(challenge: Challenge): string {
  return challenge.unlocks
    .map((u) => {
      const i = u.indexOf(".");
      const ns = u.slice(0, i);
      const rest = u.slice(i + 1);
      return ns === "Items" || ns === "Equipment"
        ? rest
        : `${ns.replace(/s$/, "")}: ${rest}`;
    })
    .join(", ");
}
