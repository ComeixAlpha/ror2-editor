import { test, fixture } from "./_fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadSave } from "../src/lib/save.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Read the artefact directly: `src/data/logbook.ts` imports JSON, which Node's ESM loader rejects
// without an import attribute. Same approach as catalog.test.mjs.
const generated = JSON.parse(
  readFileSync(join(root, "src/data/generated/logbook.json"), "utf8"),
);
const TABLE = generated.entries;
const ICONS = generated.icons;
const tokens = Object.keys(TABLE);

const KNOWN_CATEGORIES = [
  "Achievements",
  "Drone",
  "Itemandequipment",
  "Monster",
  "Stage",
  "Survivor",
];

// ---------------------------------------------------------------- catalogue

test("the logbook catalogue is populated", () => {
  assert.ok(
    tokens.length > 500,
    `expected a full logbook, got ${tokens.length} (run tools/extract-icons/build-logbook.py)`,
  );
});

test("entries the game hides for having no lore are excluded", () => {
  // `RegisterViewables` skips every entry whose `isWIPImplementation` is true, and each of those is
  // a `Language.english.TokenIsRegistered(loreToken)` check. Elite affix equipment and the ally
  // bodies are the bulk of what this removes; shipping them would inflate the "not seen" count
  // with entries the game never draws.
  const hidden = tokens.filter((t) => t.split("/").pop().startsWith("EQUIPMENT_AFFIX"));
  assert.deepEqual(hidden, []);
});

test("every entry is a /Logbook token in a category the game defines", () => {
  const bad = [];
  for (const t of tokens) {
    const m = /^\/Logbook\/LOGBOOK_CATEGORY_([A-Z]+)\/([A-Z0-9_]+)$/.exec(t);
    if (!m) {
      bad.push(`shape: ${t}`);
      continue;
    }
    const cat = m[1].charAt(0) + m[1].slice(1).toLowerCase();
    if (!KNOWN_CATEGORIES.includes(cat)) bad.push(`category: ${t}`);
    if (TABLE[t].category !== cat) bad.push(`mismatch: ${t} says ${TABLE[t].category}`);
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

test("entry tokens are language tokens, not free text", () => {
  // The last path segment is the asset's `nameToken`, so it must look like SCREAMING_SNAKE.
  for (const t of tokens) {
    const entry = t.split("/").pop();
    assert.match(entry, /^[A-Z0-9_]+$/, `${t}: entry is not a language token`);
  }
});

test("every entry has a display name from the language files", () => {
  const unnamed = tokens.filter((t) => !TABLE[t].name || TABLE[t].name === t);
  assert.deepEqual(
    unnamed.slice(0, 8),
    [],
    `${unnamed.length} entries have no name`,
  );
});

test("malformed language template keys are excluded", () => {
  // The shipped files contain keys such as `ACHIEVEMENT__NAME` with an empty middle segment.
  const bogus = tokens.filter((t) => t.includes("__"));
  assert.deepEqual(bogus, []);
});

test("the item category is populated from the game's own item assets", () => {
  const items = tokens.filter((t) => TABLE[t].category === "Itemandequipment");
  assert.ok(items.length > 150, `only ${items.length} item entries`);
});

// ---------------------------------------------------------------- the game's ordering

/** Entries of one category, in the game's own order. */
function ordered(category) {
  return tokens
    .filter((t) => TABLE[t].category === category)
    .sort((a, b) => TABLE[a].order - TABLE[b].order);
}

test("the achievements category matches the registered achievement set exactly", () => {
  // DLC4.json carries twelve `ACHIEVEMENT_*_NAME` keys whose classes exist in no assembly, so the
  // game can never unlock them and the logbook never lists them. Including them would inflate the
  // "not seen" count with entries that cannot be cleared.
  const registered = JSON.parse(
    readFileSync(join(root, "src/data/generated/achievements.json"), "utf8"),
  ).achievements;
  const expected = registered
    .map((a) => `ACHIEVEMENT_${a.identifier.toUpperCase()}_NAME`)
    .sort();
  const actual = tokens
    .filter((t) => TABLE[t].category === "Achievements")
    .map((t) => t.split("/").pop())
    .sort();
  assert.deepEqual(actual, expected);
});

test("every registered achievement has its icon", () => {
  const missing = tokens.filter(
    (t) => TABLE[t].category === "Achievements" && !ICONS[t],
  );
  assert.deepEqual(missing.slice(0, 5), [], `${missing.length} achievements lack art`);
});

test("every entry carries a game position, unique within its category", () => {
  for (const t of tokens) {
    assert.equal(typeof TABLE[t].order, "number", `${t} has no order`);
  }
  const byCat = {};
  for (const t of tokens) {
    (byCat[TABLE[t].category] ??= []).push(TABLE[t].order);
  }
  for (const [cat, orders] of Object.entries(byCat)) {
    assert.equal(
      new Set(orders).size,
      orders.length,
      `${cat} has duplicate positions, so the order is not total`,
    );
  }
});

test("items lead with the game's own first item", () => {
  // From `BuildPickupEntries`: items are stable-ordered by
  // `(int)(tier + (tier == Lunar ? 100 : 0))`, and the source order is ItemCatalog's index order,
  // which is the ItemDef asset names compared with `string.CompareOrdinal`. Common items come
  // first, so the head is the alphabetically-first asset name within Tier1 -- `ArmorPlate`.
  const head = ordered("Itemandequipment")
    .slice(0, 5)
    .map((t) => TABLE[t].name);
  assert.deepEqual(head, [
    "Repulsion Armor Plate",
    "Mocha",
    "Bolstering Lantern",
    "Eclipse Lite",
    "Topaz Brooch",
  ]);
});

test("lunar equipment sorts after everything else", () => {
  // `orderby !equipmentDef.isLunar` puts lunar equipment at the very end of the pickup grid.
  // Spinel Tonic is a lunar equipment, so it is the last pickup entry.
  const seq = ordered("Itemandequipment");
  const last = TABLE[seq[seq.length - 1]].name;
  assert.equal(last, "Spinel Tonic");
});

test("monsters are ordered by base health, not by name or index", () => {
  // From `BuildMonsterEntries`: `orderby characterBody.baseMaxHealth`, then the first entry per
  // nameToken wins. That puts the fragile summons and wisps first and the big bosses last.
  const seq = ordered("Monster").map((t) => TABLE[t].name);
  assert.deepEqual(seq.slice(0, 4), [
    "Lynx Deadeye",
    "Lesser Wisp",
    "Larva",
    "Void Infestor",
  ]);
  assert.equal(seq[seq.length - 1], "Overloading Worm");
});

test("stages run in stageOrder, which starts at the first stage", () => {
  const head = ordered("Stage")
    .slice(0, 3)
    .map((t) => TABLE[t].name);
  assert.deepEqual(head, ["Distant Roost", "Titanic Plains", "Viscous Falls"]);
});

test("survivors follow SurvivorCatalog's desiredSortPosition order", () => {
  const seq = ordered("Survivor").map((t) => TABLE[t].name);
  assert.deepEqual(seq.slice(0, 5), [
    "Commando",
    "Huntress",
    "Bandit",
    "MUL-T",
    "Engineer",
  ]);
  assert.deepEqual(seq.slice(-3), ["Drifter", "Enforcer", "Acolyte"]);
});

test("drones follow tier then desiredSortPosition", () => {
  const seq = ordered("Drone").map((t) => TABLE[t].name);
  assert.deepEqual(seq.slice(0, 3), ["Gunner Drone", "Healing Drone", "Gunner Turret"]);
});

test("achievements follow the class-name order AchievementManager registers them in", () => {
  const head = ordered("Achievements")
    .slice(0, 5)
    .map((t) => TABLE[t].name);
  // `RoR2.Achievements.Acolyte.*` sorts first among the achievement classes.
  assert.deepEqual(head, [
    "Acolyte: Mastery",
    "Acolyte: Memento Mori",
    "Acolyte: Not Even Close",
    "Acolyte: Bloodbath",
    "Acolyte: Hit List",
  ]);
});

test("the ordering is not alphabetical", () => {
  // A regression to `name.localeCompare` would still produce a stable list, so assert the
  // distinguishing property directly.
  const names = ordered("Itemandequipment").map((t) => TABLE[t].name);
  const alphabetical = [...names].sort((a, b) => a.localeCompare(b));
  assert.notDeepEqual(names.slice(0, 20), alphabetical.slice(0, 20));
});

// ---------------------------------------------------------------- icons

test("every icon points at an existing file under public/images", () => {
  const missing = [];
  for (const [token, path] of Object.entries(ICONS)) {
    assert.ok(tokens.includes(token), `${token} has an icon but is not in the catalogue`);
    assert.match(path, /^(logbook|achievements)\/[a-z0-9]+$/);
    if (!existsSync(join(root, "public/images", `${path}.png`))) missing.push(path);
  }
  assert.deepEqual([...new Set(missing)].slice(0, 8), [], "manifest lists files that do not exist");
});

test("items and equipment mostly have art", () => {
  // The item journal is the reason to open this tab, so its coverage is the one that matters.
  const items = tokens.filter((t) => TABLE[t].category === "Itemandequipment");
  const covered = items.filter((t) => ICONS[t]).length;
  console.log(`  item logbook art: ${covered}/${items.length}`);
  assert.ok(
    covered / items.length > 0.8,
    `only ${covered}/${items.length} item entries have art`,
  );
});

// ---------------------------------------------------------------- stage cards

/** PNG dimensions straight from the IHDR chunk, so the test needs no image library. */
function pngSize(path) {
  const b = readFileSync(path);
  assert.equal(b.subarray(1, 4).toString("latin1"), "PNG", `${path} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test("stage previews keep their native resolution and stay landscape", () => {
  // Stages render as full-width cards, so a preview downscaled to the 128px tile size would only
  // be scaled back up and look soft. The source textures are 480x288 for the base game and
  // 512x256 (2:1) for the expansions -- landscape, but not one fixed ratio.
  const stages = tokens.filter((t) => TABLE[t].category === "Stage" && ICONS[t]);
  assert.ok(stages.length > 30, `only ${stages.length} stage previews`);

  const sizes = stages.map((t) => ({
    token: t,
    ...pngSize(join(root, "public/images", `${ICONS[t]}.png`)),
  }));

  const tooSmall = sizes.filter((s) => s.w < 480);
  assert.deepEqual(
    tooSmall.slice(0, 5).map((s) => `${s.token} ${s.w}x${s.h}`),
    [],
    `${tooSmall.length} stage previews were downscaled`,
  );

  const notLandscape = sizes.filter((s) => s.w / s.h < 1.5);
  assert.deepEqual(
    notLandscape.slice(0, 5).map((s) => `${s.token} ${s.w}x${s.h}`),
    [],
    `${notLandscape.length} stage previews are not landscape`,
  );
});

test("no icon was force-squared", () => {
  // `Image.resize((n, n))` stretched every non-square texture; `thumbnail` keeps the ratio. A
  // forced-square icon is the fingerprint of that bug, so assert the set is not all 1:1.
  const loadout = tokens.filter((t) =>
    ["Monster", "Drone", "Survivor", "Itemandequipment"].includes(TABLE[t].category),
  );
  const sizes = loadout
    .filter((t) => ICONS[t])
    .map((t) => pngSize(join(root, "public/images", `${ICONS[t]}.png`)));
  const square = sizes.filter((s) => s.w === s.h).length;
  assert.ok(
    square < sizes.length,
    `${square}/${sizes.length} icons are square, which suggests the aspect ratio is being forced`,
  );
});

// ---------------------------------------------------------------- save integration

test("the fixture's logbook tokens are known to the catalogue", () => {
  const save = loadSave(fixture);
  const known = new Set(tokens);
  const fixtureLogs = save.viewables.filter((t) => t.startsWith("/Logbook/"));
  const unknown = fixtureLogs.filter((t) => !known.has(t));
  console.log(
    `  fixture logbook tokens: ${fixtureLogs.length}, unknown: ${unknown.length}`,
  );
  assert.deepEqual(unknown.slice(0, 8), []);
});

test("marking a logbook entry seen clears its black state", () => {
  const save = loadSave(fixture);
  // Find an entry the profile has NOT seen: that is the black tile the user wants to clear.
  const unseen = tokens.find((t) => !save.viewables.includes(t));
  assert.ok(unseen, "every logbook entry is already seen; pick another fixture");

  assert.equal(save.setViewableViewed(unseen, true), true);
  assert.ok(save.viewables.includes(unseen));
  assert.ok(loadSave(save.toXml()).viewables.includes(unseen));
});

test("bulk-marking the whole logbook is reversible", () => {
  const save = loadSave(fixture);
  // Record each token's original state. Un-marking everything is NOT the inverse of marking
  // everything: the profile already had some logbook entries seen, and those must come back.
  const before = new Map(tokens.map((t) => [t, save.viewables.includes(t)]));
  const nonLogbookBefore = save.viewables.filter((t) => !before.has(t));

  for (const t of tokens) save.setViewableViewed(t, true);
  const marked = loadSave(save.toXml());
  assert.deepEqual(
    tokens.filter((t) => !marked.viewables.includes(t)),
    [],
    "every logbook entry should be seen",
  );

  // Restore each token to the state it started in.
  const undo = loadSave(save.toXml());
  for (const [t, wasSeen] of before) undo.setViewableViewed(t, wasSeen);

  const restored = loadSave(undo.toXml());
  const wrong = tokens.filter((t) => restored.viewables.includes(t) !== before.get(t));
  assert.deepEqual(
    wrong.slice(0, 5),
    [],
    `${wrong.length} tokens did not return to their original state`,
  );
  // Tokens outside the logbook must be untouched and still in their original order.
  assert.deepEqual(
    restored.viewables.filter((t) => !before.has(t)),
    nonLogbookBefore,
  );
});

test("toggling persists through a full round-trip without disturbing other lists", () => {
  const save = loadSave(fixture);
  const achievementsBefore = [...save.achievements];
  const unlocksBefore = [...save.unlocks];

  const token = tokens[0];
  save.setViewableViewed(token, !save.viewables.includes(token));
  const again = loadSave(save.toXml());

  assert.deepEqual(again.achievements, achievementsBefore);
  assert.deepEqual(again.unlocks, unlocksBefore);
});
