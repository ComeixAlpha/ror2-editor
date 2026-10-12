/**
 * Editing a profile's scalar metadata.
 *
 * The profile is a flat list of simple `<name>value</name>` elements plus a handful of large
 * subtrees (the achievement lists, the input maps, the 8000-entry `<stats>` block). Only the
 * simple fields are exposed here; the subtrees are managed by `save.ts`.
 *
 * Anything the game adds in a future patch shows up automatically under "Other" -- the field list
 * is read from the file, not hard-coded, so a new save field is editable without a code change.
 */
import { findChild, setText, textOf } from "./xml.ts";
// `save-validation` owns the survivor token list. Its dependency on `metadata` is type-only, so
// this value import does not create a runtime cycle.
import { SURVIVOR_PREFERENCE_TOKENS } from "./save-validation.ts";
// Type-only imports must be separate: Node's type stripping removes them.
import type { XmlElement } from "./xml.ts";
import type { SaveData } from "./save.ts";

/** How a field should be presented and validated in the UI. */
export type FieldKind = "text" | "integer" | "float" | "boolean" | "select";

export interface FieldSpec {
  /** Grouping for display. */
  group: string;
  /** Human label. Falls back to the raw element name when unknown. */
  label?: string;
  kind: FieldKind;
  /** Optional upper bound (e.g. int32 for coin counters). */
  max?: number;
  /** Optional warning shown next to the field. */
  note?: string;
  /** Allowed values for `select`. The first entry is used when the stored value is unknown. */
  options?: readonly string[];
}

/**
 * Fields whose element name is not self-explanatory, plus their type and grouping.
 * Everything absent from this table is still editable, grouped under "Other".
 */
export const FIELD_SPECS: Record<string, FieldSpec> = {
  name: { group: "Profile", label: "Profile name", kind: "text" },
  version: {
    group: "Profile",
    label: "Save format version",
    kind: "integer",
    note: "Set by the game. Changing it may stop the save from loading.",
  },

  coins: {
    group: "Currency",
    label: "Lunar coins",
    kind: "integer",
    max: 2147483647,
  },
  totalCollectedCoins: {
    group: "Currency",
    label: "Lunar coins collected (lifetime)",
    kind: "integer",
    max: 2147483647,
  },

  totalLoginSeconds: {
    group: "Playtime",
    label: "Total login seconds",
    kind: "float",
  },
  totalAliveSeconds: {
    group: "Playtime",
    label: "Total seconds alive",
    kind: "float",
  },
  totalRunSeconds: {
    group: "Playtime",
    label: "Total seconds in runs",
    kind: "float",
  },
  totalRunCount: {
    group: "Playtime",
    label: "Total runs started",
    kind: "integer",
    max: 2147483647,
  },

  survivorPreference: {
    // A select, not free text: `SaveFieldAttribute.SetupSurvivorDef` stores whatever
    // `SurvivorCatalog.FindSurvivorDef` returns without a null check, and `UserProfile` later
    // tests it for null. An unknown token therefore makes the game throw while logging in.
    group: "Gameplay",
    label: "Preferred survivor",
    kind: "select",
    options: SURVIVOR_PREFERENCE_TOKENS,
    note: "Must be a real survivor token.",
  },
  rebirthItem: { group: "Gameplay", label: "Rebirth item", kind: "text" },
  RebirthItem: { group: "Gameplay", label: "Rebirth item", kind: "text" },
  disableItemDisplays: {
    group: "Gameplay",
    label: "Disable item displays",
    kind: "boolean",
  },
  increasedDifficultyBarFX: {
    group: "Gameplay",
    label: "Increased difficulty bar FX",
    kind: "boolean",
  },
  useInspectFeature: {
    group: "Gameplay",
    label: "Inspect feature enabled",
    kind: "boolean",
  },
  useInspectAutopause: {
    group: "Gameplay",
    label: "Inspect autopause",
    kind: "boolean",
  },
  useToggleScoreboard: {
    group: "Gameplay",
    label: "Toggle scoreboard",
    kind: "boolean",
  },
  useTeleporterDiscoveryIndicator: {
    group: "Gameplay",
    label: "Teleporter discovery indicator",
    kind: "boolean",
  },
  useTeleporterParticleScaling: {
    group: "Gameplay",
    label: "Teleporter particle scaling",
    kind: "boolean",
  },
  hudSizeMode: { group: "Gameplay", label: "HUD size mode", kind: "integer" },
  screenShakeScale: {
    group: "Gameplay",
    label: "Screen shake scale",
    kind: "float",
  },
  gamepadVibrationScale: {
    group: "Gameplay",
    label: "Gamepad vibration scale",
    kind: "float",
  },

  mouseLookSensitivity: { group: "Input", kind: "float" },
  mouseLookInvertX: { group: "Input", kind: "boolean" },
  mouseLookInvertY: { group: "Input", kind: "boolean" },
  mouseLookScaleX: { group: "Input", kind: "float" },
  mouseLookScaleY: { group: "Input", kind: "float" },
  stickLookSensitivity: { group: "Input", kind: "float" },
  stickLookInvertX: { group: "Input", kind: "boolean" },
  stickLookInvertY: { group: "Input", kind: "boolean" },
  stickLookScaleX: { group: "Input", kind: "float" },
  stickLookScaleY: { group: "Input", kind: "float" },
  gyroEnabled: { group: "Input", kind: "boolean" },
  gyroLookSensitivity: { group: "Input", kind: "float" },
  gyroLookInvertX: { group: "Input", kind: "boolean" },
  gyroLookInvertY: { group: "Input", kind: "boolean" },
  gyroLookScaleX: { group: "Input", kind: "float" },
  gyroLookScaleY: { group: "Input", kind: "float" },
  aimAssistEnabled: { group: "Input", kind: "boolean" },
  aimAssistSensitivity: { group: "Input", kind: "float" },
  inputAimAssistSensitivity: { group: "Input", kind: "float" },
  gamePadTrajectoryAimAssistSensitivity: { group: "Input", kind: "float" },
  mouseTrajectoryAimAssistSensitivity: { group: "Input", kind: "float" },
  directionalDamageIndicatorScale: { group: "Input", kind: "float" },

  tutorialDifficulty: { group: "Tutorial", kind: "integer" },
  tutorialSurvivor: { group: "Tutorial", kind: "integer" },
  tutorialSprint: { group: "Tutorial", kind: "integer" },
  tutorialEquipment: { group: "Tutorial", kind: "integer" },
  tutorialRemoteOp: { group: "Tutorial", kind: "integer" },
};

/** Order groups are shown in. Anything not listed is appended alphabetically. */
export const GROUP_ORDER = [
  "Profile",
  "Currency",
  "Playtime",
  "Gameplay",
  "Input",
  "Tutorial",
  "Other",
];

/**
 * `<stats>` counters that gate in-game achievements. These are worth exposing because an
 * achievement can be granted while its counter still reads 0, which looks wrong in-game.
 */
export const ACHIEVEMENT_STATS: Array<{ name: string; label: string }> = [
  { name: "totalGamesPlayed", label: "Games played" },
  { name: "totalKills", label: "Total kills" },
  { name: "totalDeaths", label: "Total deaths" },
  { name: "totalEliteKills", label: "Elite kills" },
  { name: "totalMinionKills", label: "Minion kills" },
  { name: "totalDamageDealt", label: "Damage dealt" },
  { name: "totalDamageTaken", label: "Damage taken" },
  { name: "totalHealthHealed", label: "Health healed" },
  { name: "highestDamageDealt", label: "Highest single hit" },
  { name: "highestLevel", label: "Highest level" },
  { name: "totalGoldCollected", label: "Gold collected" },
  { name: "maxGoldCollected", label: "Most gold held" },
  { name: "totalDistanceTraveled", label: "Distance travelled" },
  { name: "totalItemsCollected", label: "Items collected" },
  { name: "highestItemsCollected", label: "Most items held" },
  { name: "totalStagesCompleted", label: "Stages completed" },
  { name: "highestStagesCompleted", label: "Most stages in a run" },
  { name: "totalPurchases", label: "Purchases" },
  { name: "totalGoldPurchases", label: "Gold purchases" },
  { name: "totalBloodPurchases", label: "Blood purchases" },
  { name: "totalLunarPurchases", label: "Lunar purchases" },
  { name: "totalTier1Purchases", label: "Tier 1 purchases" },
  { name: "totalTier2Purchases", label: "Tier 2 purchases" },
  { name: "totalTier3Purchases", label: "Tier 3 purchases" },
  { name: "totalDronesPurchased", label: "Drones purchased" },
  { name: "totalTurretsPurchased", label: "Turrets purchased" },
  { name: "totalGreenSoupsPurchased", label: "Green soups purchased" },
  { name: "totalRedSoupsPurchased", label: "Red soups purchased" },
  { name: "firstTeleporterCompleted", label: "Teleporters completed" },
  {
    name: "totalTeleporterBossKillsWitnessed",
    label: "Teleporter bosses killed",
  },
  { name: "totalBurnDeaths", label: "Deaths by burning" },
  { name: "totalDeathsWhileBurning", label: "Deaths while burning" },
  { name: "totalMaulingRockKills", label: "Flying rocks destroyed" },
  { name: "totalCrocoInfectionsInflicted", label: "Acrid poison stacks" },
  { name: "totalCrocoWeakEnemyKills", label: "Acrid 1-HP kills" },
  {
    name: "suicideHermitCrabsAchievementProgress",
    label: "Hermit crabs chased off",
  },
];

/** Elements that are subtrees rather than simple values, and must never be offered as text. */
const SUBTREE_ELEMENTS = new Set([
  "stats",
  "loadout",
  "achievementsList",
  "unviewedAchievementsList",
  "viewedUnlockablesList",
  "viewedViewables",
  "discoveredPickups",
  "keyboardMap",
  "mouseMap",
  "joystickMap",
  "HardwareJoystickMaps2",
]);

export interface MetadataField {
  name: string;
  value: string;
  spec: FieldSpec;
  /** True when the element exists in the file (all reported fields do). */
  present: boolean;
}

/** Read every editable top-level scalar field of the profile. */
export function readMetadata(save: SaveData): MetadataField[] {
  const fields: MetadataField[] = [];
  for (const child of save.root.children) {
    if (child.type !== "elem") continue;
    if (SUBTREE_ELEMENTS.has(child.name)) continue;
    // Only leaf elements with a single text node (or empty) are simple values.
    const isSimple = child.children.every(
      (c) => c.type === "text" || c.type === "cdata",
    );
    if (!isSimple) continue;

    const spec = FIELD_SPECS[child.name] ?? {
      group: "Other",
      kind: inferKind(textOf(child)),
    };
    fields.push({
      name: child.name,
      value: textOf(child),
      spec,
      present: true,
    });
  }
  return fields.sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.spec.group);
    const gb = GROUP_ORDER.indexOf(b.spec.group);
    const oa = ga < 0 ? GROUP_ORDER.length : ga;
    const ob = gb < 0 ? GROUP_ORDER.length : gb;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
}

/** Guess a sensible control for a field with no explicit spec. */
function inferKind(value: string): FieldKind {
  if (value === "0" || value === "1") return "boolean";
  if (/^-?\d+$/.test(value)) return "integer";
  if (/^-?\d*\.\d+$/.test(value)) return "float";
  return "text";
}

/** Set a top-level scalar field. Returns false when the element does not exist. */
export function setMetadataField(
  save: SaveData,
  name: string,
  value: string,
): boolean {
  const el = findChild(save.root, name);
  if (!el) return false;
  setText(el, value);
  return true;
}

/**
 * Coerce and validate a raw UI string for a field, returning the text to store.
 * Keeps the value numeric where the spec says so, and clamps to the spec's maximum.
 */
export function normalizeFieldValue(spec: FieldSpec, raw: string): string {
  switch (spec.kind) {
    case "boolean": {
      if (raw === "1" || raw === "true") return "1";
      if (raw === "0" || raw === "false") return "0";
      return raw === "" ? "0" : "1";
    }
    case "integer": {
      const n = Math.trunc(Number(raw));
      if (!Number.isFinite(n)) return "0";
      const max = spec.max ?? Number.MAX_SAFE_INTEGER;
      return String(Math.max(0, Math.min(max, n)));
    }
    case "float": {
      const n = Number(raw);
      return Number.isFinite(n) ? String(n) : "0";
    }
    case "select": {
      // Only accept a listed value. `survivorPreference` in particular must never hold an
      // unknown token: the game stores it as a SurvivorDef and null-refs on a miss.
      const options = spec.options ?? [];
      if (options.includes(raw)) return raw;
      return options[0] ?? raw;
    }
    case "text":
    default:
      return raw;
  }
}

/** Read a `<stats><stat name="...">` counter, or undefined. */
export function readStat(save: SaveData, name: string): string | undefined {
  const statsEl = findChild(save.root, "stats");
  if (!statsEl) return undefined;
  for (const child of statsEl.children) {
    if (child.type !== "elem" || child.name !== "stat") continue;
    const attr = child.attrs.find((a) => a.name === "name");
    if (attr?.value === name) return textOf(child);
  }
  return undefined;
}

/**
 * Write a `<stats><stat name="...">` counter, creating the element if the game has not written it
 * yet. Returns false only when the profile has no `<stats>` block at all.
 */
export function writeStat(
  save: SaveData,
  name: string,
  value: string,
): boolean {
  const statsEl = findChild(save.root, "stats");
  if (!statsEl) return false;

  for (const child of statsEl.children) {
    if (child.type !== "elem" || child.name !== "stat") continue;
    const attr = child.attrs.find((a) => a.name === "name");
    if (attr?.value === name) {
      setText(child, value);
      return true;
    }
  }

  const created: XmlElement = {
    type: "elem",
    name: "stat",
    attrs: [{ name: "name", value: name, quote: '"' }],
    children: [{ type: "text", raw: value }],
    selfClosing: false,
  };
  statsEl.children.push(created);
  return true;
}
