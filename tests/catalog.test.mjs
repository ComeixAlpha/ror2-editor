import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const generated = JSON.parse(
  readFileSync(join(root, "src/data/generated/challenges.json"), "utf8"),
);
const challenges = generated.challenges;

// These constants mirror src/data/catalog.ts. They are duplicated on purpose: this file guards
// the generated artefact, and must not silently follow a change in the runtime module.
const DLCS = ["base", "sotv", "sots", "ac", "hc"];
const CATEGORIES = ["survivors", "skills", "skins", "items", "artifacts"];

const REQUIRED_FIELDS = [
  "id",
  "achievement",
  "name",
  "description",
  "unlocks",
  "category",
  "dlc",
  "lunarCoins",
  "prerequisite",
  "displayNameSource",
  "languageFile",
];

test("catalogue is non-empty and self-describing", () => {
  assert.ok(
    challenges.length > 150,
    `expected a full catalogue, got ${challenges.length}`,
  );
  assert.equal(generated.count, challenges.length);
  assert.deepEqual(generated.generatedFrom, ["RoR2.dll", "Language/en"]);
});

test("every entry carries the fields the editor relies on", () => {
  for (const c of challenges) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in c, `${c.id ?? "?"} is missing field "${field}"`);
    }
  }
});

test("ids and achievements are unique and identical", () => {
  const ids = new Set();
  for (const c of challenges) {
    assert.equal(c.id, c.achievement, `${c.id} should have id === achievement`);
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
  }
});

test("every entry has a display name and description from the game", () => {
  const unnamed = challenges.filter((c) => !c.name || c.name === c.achievement);
  assert.deepEqual(
    unnamed.map((c) => c.id),
    [],
    "all display names should resolve",
  );

  const undescribed = challenges.filter((c) => !c.description);
  assert.deepEqual(
    undescribed.map((c) => c.id),
    [],
    "all descriptions should resolve",
  );

  for (const c of challenges) {
    assert.equal(
      c.displayNameSource,
      "game",
      `${c.id} should come from the game's language files`,
    );
    assert.ok(
      c.languageFile,
      `${c.id} should record which language file it came from`,
    );
  }
});

test("dlc and category values are within the known sets", () => {
  for (const c of challenges) {
    assert.ok(DLCS.includes(c.dlc), `${c.id} has unknown dlc "${c.dlc}"`);
    assert.ok(
      CATEGORIES.includes(c.category),
      `${c.id} has unknown category "${c.category}"`,
    );
  }
});

test("dlc attribution follows the language file for non-overridden entries", () => {
  // The game keeps expansion text in DLC1..DLC4.json, which is the primary DLC signal. A small
  // set of entries is overridden because the game reuses a later file for content that belongs
  // to an earlier expansion (notably Survivors of the Void).
  const byFile = {
    "DLC1.json": "sotv",
    "DLC2.json": "sots",
    "DLC3.json": "ac",
    "DLC4.json": "hc",
  };
  const overridden = new Set([
    "RailgunnerConsecutiveWeakPoints",
    "RailgunnerDealMassiveDamage",
    "RailgunnerAirborneMultiKill",
    "RailgunnerClearGameMonsoon",
    "RailgunnerClearMeridianEvent",
    "CompleteVoidEnding",
    "VoidSurvivorClearGameMonsoon",
    "VoidSurvivorClearMeridianEvent",
  ]);

  for (const c of challenges) {
    const expected = byFile[c.languageFile];
    if (!expected) continue;
    if (overridden.has(c.id)) continue;
    assert.equal(
      c.dlc,
      expected,
      `${c.id} came from ${c.languageFile} so should be ${expected}`,
    );
  }
});

test("every declared dlc override is actually exercised", () => {
  // Guards against a stale override list: each override must name a real entry.
  const ids = new Set(challenges.map((c) => c.id));
  for (const id of [
    "RailgunnerConsecutiveWeakPoints",
    "RailgunnerDealMassiveDamage",
    "RailgunnerAirborneMultiKill",
    "RailgunnerClearGameMonsoon",
    "RailgunnerClearMeridianEvent",
    "CompleteVoidEnding",
    "VoidSurvivorClearGameMonsoon",
    "VoidSurvivorClearMeridianEvent",
  ]) {
    assert.ok(ids.has(id), `override references unknown achievement ${id}`);
  }
});

test("Survivors of the Void owns its survivor content", () => {
  const sotv = challenges.filter((c) => c.dlc === "sotv");
  assert.equal(
    sotv.length,
    8,
    `expected the Survivors of the Void set, got ${sotv.length}`,
  );
  const ids = new Set(sotv.map((c) => c.id));
  // Both SotV survivors must be represented, including their Prime Meridian skins.
  for (const expected of [
    "CompleteVoidEnding",
    "VoidSurvivorClearGameMonsoon",
    "VoidSurvivorClearMeridianEvent",
    "RailgunnerClearGameMonsoon",
    "RailgunnerClearMeridianEvent",
  ]) {
    assert.ok(
      ids.has(expected),
      `${expected} should be attributed to Survivors of the Void`,
    );
  }
});

test("rewards are namespaced unlockable strings", () => {
  const namespaces = new Set([
    "Characters",
    "Items",
    "Equipment",
    "Skills",
    "Skins",
    "Artifacts",
  ]);
  for (const c of challenges) {
    assert.ok(c.unlocks.length > 0, `${c.id} should grant at least one reward`);
    for (const u of c.unlocks) {
      const ns = u.split(".")[0];
      assert.ok(
        namespaces.has(ns),
        `${c.id} grants "${u}" with unknown namespace "${ns}"`,
      );
    }
  }
});

test("prerequisites resolve inside the catalogue", () => {
  const ids = new Set(challenges.map((c) => c.id));
  for (const c of challenges) {
    if (!c.prerequisite) continue;
    assert.ok(
      ids.has(c.prerequisite),
      `${c.id} requires unknown ${c.prerequisite}`,
    );
  }
});

test("lunar coin rewards are sane", () => {
  for (const c of challenges) {
    if (c.lunarCoins === null || c.lunarCoins === undefined) continue;
    assert.ok(
      Number.isInteger(c.lunarCoins),
      `${c.id} has non-integer coin reward`,
    );
    assert.ok(
      c.lunarCoins >= 0 && c.lunarCoins <= 10,
      `${c.id} has implausible coin reward ${c.lunarCoins}`,
    );
  }
});

test("the hallowed concepts set is complete", () => {
  const hc = challenges.filter((c) => c.dlc === "hc");
  assert.equal(
    hc.length,
    34,
    "Hallowed Concepts should contribute exactly 34 achievements",
  );
  const ids = hc.map((c) => c.id);
  // Spot-check ids that were recovered from the game binary, not from any published list.
  for (const expected of [
    "AcolyteClearGameMonsoon",
    "AcolyteClearUltima",
    "ChampRushRitualCompleted",
    "Enforcer2ClearGameMonsoon",
    "Enforcer2ClearChampRush",
    "CommandoBeatBrotherMaxKarma",
  ]) {
    assert.ok(ids.includes(expected), `${expected} should be in the catalogue`);
  }
});

test("summaries agree with the entries", () => {
  const byDlc = {};
  for (const c of challenges) byDlc[c.dlc] = (byDlc[c.dlc] ?? 0) + 1;
  assert.deepEqual(generated.byDlc, byDlc);

  const byCategory = {};
  for (const c of challenges)
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  assert.deepEqual(generated.byCategory, byCategory);
});
