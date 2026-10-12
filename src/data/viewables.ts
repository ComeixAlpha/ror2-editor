/**
 * Access to the generated viewables catalogue.
 *
 * A "viewable" is a UI entry with a seen/unseen flag. `UserProfile.viewedViewables` stores the
 * token of every entry the player has looked at, and `UserProfile.MarkViewableAsViewed` appends to
 * it. The tokens are:
 *
 *   /Survivors/{survivorDefName}
 *   /Loadout/Bodies/{bodyName}/{skillFamilyName}.{skillDefName}
 *   /Loadout/Bodies/{bodyName}/Skins/{skinDefName}
 *   /Settings/...
 *
 * `generated/viewables.json` is produced by `tools/extract-icons/build-viewables.py`, which reads
 * the SkillLocator/SkillFamily/SkillDef/SkinDef assets out of the game's bundles and resolves each
 * icon through the serialized file's external references. Display names come from the game's own
 * language files.
 */
import generated from "./generated/viewables.json";
import { publicUrl } from "../lib/public-url";

export type ViewableCategory =
  | "survivor"
  | "skill"
  | "skin"
  | "logbook"
  | "setting"
  | "signup";

export const VIEWABLE_CATEGORY_LABELS: Record<ViewableCategory, string> = {
  survivor: "Survivors",
  skill: "Skills",
  skin: "Skins",
  logbook: "Logbook",
  setting: "Settings",
  signup: "Other",
};

/** Display order, matching the in-game loadout screen's emphasis. */
export const VIEWABLE_CATEGORY_ORDER: ViewableCategory[] = [
  "survivor",
  "skill",
  "skin",
  "logbook",
  "setting",
  "signup",
];

export interface Viewable {
  /** The string written to `<viewedViewables>`. */
  token: string;
  name: string;
  category: ViewableCategory;
}

const TABLE = generated.viewables as Record<
  string,
  { name: string; category: ViewableCategory }
>;
const ICONS = generated.icons as Record<string, string>;

export const viewables: Viewable[] = Object.entries(TABLE)
  .map(([token, info]) => ({ token, name: info.name, category: info.category }))
  .sort((a, b) => {
    const ca = VIEWABLE_CATEGORY_ORDER.indexOf(a.category);
    const cb = VIEWABLE_CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });

/** How many entries each category holds, for the filter chips. */
export const viewablesByCategory: Record<string, Viewable[]> = viewables.reduce(
  (acc, v) => {
    (acc[v.category] ??= []).push(v);
    return acc;
  },
  {} as Record<string, Viewable[]>,
);

/** URL of a viewable's icon, or undefined when the entry has no art (all settings). */
export function viewableIconUrl(token: string): string | undefined {
  const slug = ICONS[token];
  return slug ? publicUrl(`images/viewables/${slug}.png`) : undefined;
}

export const viewableIconCoverage = {
  withIcon: Object.keys(ICONS).length,
  total: viewables.length,
};
