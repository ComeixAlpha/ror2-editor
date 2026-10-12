/**
 * Client-side validation of a profile, derived from the game's own deserialiser.
 *
 * Every rule here comes from `RoR2.UserProfile` / `RoR2.XmlUtility` / `RoR2.SaveFieldAttribute`
 * (decompiled from the shipping `RoR2.dll`). The goal is to never hand the user a save the game
 * will reject or crash on.
 *
 * Notable facts this encodes:
 *
 *  - `SaveFieldAttribute.SetupSurvivorDef` calls `SurvivorCatalog.FindSurvivorDef(token)` and
 *    stores the result without a null check. `UserProfile` then does `if (!survivorPreference)`,
 *    which throws on a null `SurvivorDef`. So `survivorPreference` must be a real survivor token.
 *  - `SetupBool` parses with `TryParseInvariant(out int)`, so only digits work. `"true"` is
 *    silently ignored; the field keeps its default. Booleans must be written as 0 or 1.
 *  - `SetupTokenList` splits on a single `' '` and adds **every** piece, including empty ones.
 *    An empty token is harmless but noise, so we refuse to emit one.
 *  - `SetupPickupsSet` resolves each token with `PickupCatalog.FindPickupIndex` and ignores
 *    unknown ones. Unknown tokens are dropped, not fatal.
 *  - `GetStatsField` resolves stat names with `StatDef.Find`; an unknown name is ignored.
 *  - `FixUpSaveDataFields` rewrites stale tokens via `UserProfileRedirectData`, so old token
 *    spellings in an existing save are the game's problem, not ours.
 *  - `SaveSystem.LoadUserProfileFromDisk` loads the file with `XDocument.Load`. Any XML problem
 *    sends the whole profile to `bad_profiles.log` and the profile list drops it. A file that is
 *    entirely NUL bytes (a disk/AV failure) lands here too, which is worth detecting explicitly
 *    because it looks like a valid size.
 */
import { findChild, findAll, textOf } from "./xml.ts";
import type { SaveData } from "./save.ts";

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: IssueSeverity;
  /** Element or list the problem is in, for display. */
  where: string;
  message: string;
  /** Concrete repair advice, when there is one. */
  hint?: string;
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  /** Everything, in severity order, for a flat list in the UI. */
  issues: ValidationIssue[];
}

/**
 * Survivor tokens the game accepts in `<survivorPreference>`.
 *
 * These are `SurvivorDef.cachedName` values. The list is the union of the body-name tokens in the
 * game's `CharacterBodies.json` for every playable survivor across all four expansions.
 */
export const SURVIVOR_PREFERENCE_TOKENS = [
  "Commando",
  "Huntress",
  "Toolbot",
  "Engi",
  "Mage",
  "Merc",
  "Treebot",
  "Loader",
  "Croco",
  "Captain",
  "Bandit2",
  "Railgunner",
  "VoidSurvivor",
  "Seeker",
  "Chef",
  "FalseSon",
  "Drifter",
  "DroneTech",
  "Acolyte",
  "Enforcer2",
] as const;

const SURVIVOR_SET = new Set<string>(SURVIVOR_PREFERENCE_TOKENS);

/** The save format version this build of the game writes. */
export const EXPECTED_SAVE_VERSION = "3";

/** The profile name is free-form, but the in-game UI caps it and very long names are suspicious. */
export const MAX_PROFILE_NAME_LENGTH = 24;

/** Lists the game splits on a single space. */
const TOKEN_LISTS = [
  "achievementsList",
  "unviewedAchievementsList",
  "viewedUnlockablesList",
  "viewedViewables",
  "discoveredPickups",
] as const;

/** Reserved profile names: `SaveSystem.ProfileNameIsReserved` refuses to save "default". */
const RESERVED_NAMES = new Set(["default"]);

/** Sets used to check that achievement ids and unlock strings resolve in this build. */
export interface KnownTokens {
  achievements?: Set<string>;
  unlocks?: Set<string>;
}

/**
 * Validate a loaded profile.
 *
 * @param save the loaded profile
 * @param known optional sets used to check that tokens resolve. Omit to skip those checks.
 */
export function validateSave(
  save: SaveData,
  known?: KnownTokens,
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const add = (
    severity: IssueSeverity,
    where: string,
    message: string,
    hint?: string,
  ): void => {
    issues.push({ severity, where, message, hint });
  };

  // ---------------------------------------------------------------- survivorPreference
  // Worst offender: a bad value here null-refs the game during profile login.
  const prefEl = findChild(save.root, "survivorPreference");
  if (!prefEl) {
    add(
      "warning",
      "survivorPreference",
      "Element is missing.",
      "The game falls back to the default survivor, so this is safe but unusual.",
    );
  } else {
    const token = textOf(prefEl).trim();
    if (token === "") {
      add(
        "error",
        "survivorPreference",
        "Empty. The game stores this as a SurvivorDef and then tests it for null, which throws.",
        "Pick a survivor from the list.",
      );
    } else if (!SURVIVOR_SET.has(token)) {
      add(
        "error",
        "survivorPreference",
        `"${token}" is not a survivor token. SurvivorCatalog.FindSurvivorDef returns null and the game throws.`,
        `Valid values: ${SURVIVOR_PREFERENCE_TOKENS.join(", ")}`,
      );
    }
  }

  // ---------------------------------------------------------------- version
  const versionEl = findChild(save.root, "version");
  if (!versionEl) {
    add(
      "warning",
      "version",
      "Element is missing.",
      `The game's upgrader assumes the newest format, so the file is read as version ${EXPECTED_SAVE_VERSION}.`,
    );
  } else {
    const v = textOf(versionEl).trim();
    if (v !== EXPECTED_SAVE_VERSION) {
      add(
        "warning",
        "version",
        `Value is "${v}" but this game build writes "${EXPECTED_SAVE_VERSION}".`,
        "UserProfileUpgrader will try to migrate it. Prefer editing an existing profile so the version stays correct.",
      );
    }
  }

  // ---------------------------------------------------------------- name
  const nameEl = findChild(save.root, "name");
  const profileName = textOf(nameEl).trim();
  if (profileName === "") {
    add("warning", "name", "Profile name is empty.", "The game will show a blank row in the profile list.");
  } else if (profileName.length > MAX_PROFILE_NAME_LENGTH) {
    add(
      "info",
      "name",
      `Profile name is ${profileName.length} characters; the in-game editor caps it at about ${MAX_PROFILE_NAME_LENGTH}.`,
    );
  }
  if (RESERVED_NAMES.has(profileName.toLowerCase())) {
    add("warning", "name", `"${profileName}" is a reserved profile name and cannot be saved by the game.`);
  }

  // ---------------------------------------------------------------- token lists
  for (const tag of TOKEN_LISTS) {
    const el = findChild(save.root, tag);
    if (!el) {
      add("info", tag, "Element is missing.");
      continue;
    }
    const raw = textOf(el);
    const tokens = raw.split(" ").filter(Boolean);

    if (tokens.length > 0 && /^\s/.test(raw)) {
      add(
        "warning",
        tag,
        "Starts with a space, which produces an empty leading entry.",
        "Harmless in game (the empty name never matches), but it means the file was edited by a tool that did not tidy the list.",
      );
    }
    if (/[^\s] {2,}[^\s]/.test(raw)) {
      add("warning", tag, "Contains a run of spaces between entries.");
    }
    const dupes = tokens.filter((t, i) => tokens.indexOf(t) !== i);
    if (dupes.length > 0) {
      add(
        "warning",
        tag,
        `${dupes.length} duplicated entr${dupes.length === 1 ? "y" : "ies"}, e.g. ${[...new Set(dupes)].slice(0, 3).join(", ")}.`,
        "The game tolerates duplicates; they are a sign of an append-instead-of-replace bug.",
      );
    }
  }

  // ---------------------------------------------------------------- stats
  const statsEl = findChild(save.root, "stats");
  if (!statsEl) {
    add("error", "stats", "Element is missing. Every progression value lives here.");
  } else {
    const statEls = findAll(statsEl, "stat");
    const names = statEls.map((s) => s.attrs.find((a) => a.name === "name")?.value ?? "");
    const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupNames.length > 0) {
      add(
        "warning",
        "stats",
        `${dupNames.length} duplicated <stat name> value(s), e.g. ${[...new Set(dupNames)].slice(0, 3).join(", ")}.`,
        "The game keeps whichever it reads last.",
      );
    }
    const unnamed = statEls.filter((s) => !s.attrs.some((a) => a.name === "name"));
    if (unnamed.length > 0) {
      add(
        "error",
        "stats",
        `${unnamed.length} <stat> element(s) have no name attribute.`,
        "GetStatsField reads the name attribute; without it StatDef.Find is called with null.",
      );
    }
    const unlockEls = findAll(statsEl, "unlock");
    const emptyUnlocks = unlockEls.filter((u) => textOf(u).trim() === "");
    if (emptyUnlocks.length > 0) {
      add(
        "warning",
        "stats",
        `${emptyUnlocks.length} empty <unlock> element(s).`,
        "UnlockableCatalog.GetUnlockableDef(\"\") returns null, which the game skips.",
      );
    }
    if (statEls.length === 0) {
      add(
        "warning",
        "stats",
        "No <stat> elements.",
        "The game writes every stat field, so an empty block suggests the file was hand-built.",
      );
    }
  }

  // ---------------------------------------------------------------- unknown tokens
  if (known?.achievements) {
    const unknown = save.achievements.filter((a) => !known.achievements!.has(a));
    if (unknown.length > 0) {
      add(
        "info",
        "achievementsList",
        `${unknown.length} achievement id(s) are not in this build's catalogue: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? ", …" : ""}.`,
        "This is normal when the save came from a newer game build; the game ignores unknown ids.",
      );
    }
  }
  if (known?.unlocks) {
    const runtime = /^(Logs|NewtStatue|Karma)\./;
    const unknown = save.unlocks.filter((u) => !known.unlocks!.has(u) && !runtime.test(u));
    if (unknown.length > 0) {
      add(
        "info",
        "stats",
        `${unknown.length} unlock string(s) are not in this build's catalogue: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? ", …" : ""}.`,
        "UnlockableCatalog.GetUnlockableDef returns null for these and the game drops them.",
      );
    }
  }

  // ---------------------------------------------------------------- report
  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    ok: !issues.some((i) => i.severity === "error"),
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
    infos: issues.filter((i) => i.severity === "info"),
    issues,
  };
}

/**
 * Detect the failure mode that makes a profile file useless: the bytes are all NUL.
 *
 * The game reports this as a corrupted profile and writes the file to `bad_profiles.log`. It
 * happens when a write lands the file's size but not its data (antivirus interference, cloud
 * "Files On-Demand" placeholders, an interrupted copy). The file looks plausible by size, so it
 * needs an explicit check.
 */
export function detectNulFilledFile(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  // Sampling is enough in practice and keeps this cheap for a 500 KB profile.
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

/** One-line summary for a status bar. */
export function summariseReport(report: ValidationReport): string {
  if (report.issues.length === 0) return "No problems found.";
  const parts: string[] = [];
  if (report.errors.length) parts.push(`${report.errors.length} error(s)`);
  if (report.warnings.length) parts.push(`${report.warnings.length} warning(s)`);
  if (report.infos.length) parts.push(`${report.infos.length} note(s)`);
  return parts.join(", ");
}
