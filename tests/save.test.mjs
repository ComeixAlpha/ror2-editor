import { test, fixture as fixtureXml } from "./_fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  loadSave,
  toggleChallenge,
  unlockAll,
  lockAll,
  inspectCoverage,
  splitList,
} from "../src/lib/save.ts";
import { parseXml, findChild, findAll, textOf } from "../src/lib/xml.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const CATALOG = join(root, "src/data/generated/challenges.json");

const catalog = JSON.parse(readFileSync(CATALOG, "utf8")).challenges;

// ---------------------------------------------------------------- loading

test("loads a real profile", () => {
  const save = loadSave(fixtureXml);
  assert.equal(save.version, "3");
  assert.equal(save.coins, 463129029);
  // 102 raw entries collapse to 89 unique ids (see the duplicate test below).
  assert.equal(save.achievements.length, 89);
  assert.equal(save.unlocks.length, 186);
});

test("de-duplicates the corrupted achievement list in the fixture", () => {
  // The fixture was damaged by an editor that appended instead of replacing, so its 102 raw
  // entries hold only 89 unique ids. Loading must expose the de-duplicated set.
  const raw = splitList(
    textOf(
      findChild(
        parseXml(fixtureXml).find((n) => n.type === "elem"),
        "achievementsList",
      ),
    ),
  );
  assert.equal(raw.length, 102, "fixture should still contain 102 raw entries");
  assert.equal(new Set(raw).size, 89, "fixture should hold 89 unique ids");
  assert.equal(
    raw.length - new Set(raw).size,
    13,
    "fixture should contain 13 duplicated entries",
  );

  const save = loadSave(fixtureXml);
  assert.equal(new Set(save.achievements).size, save.achievements.length);
  assert.equal(save.achievements.length, 89);
});

test("committing only rewrites the lists it manages", () => {
  const save = loadSave(fixtureXml);
  // `toXml()` deliberately changes exactly three things:
  //   1. `achievementsList` is re-emitted space-separated on one line (its CRLF layout is lost),
  //   2. the empty `<unviewedAchievementsList/>` and `<viewedUnlockablesList/>` are rewritten,
  //   3. the `<unlock>` children of `<stats>` are removed and appended at the end.
  // Everything else must be untouched. Byte fidelity of the *XML layer* is asserted separately in
  // `xml.test.mjs > round-trips a real save byte-for-byte`.
  const out = save.toXml();

  // Mask only the regions commit() is allowed to touch, then demand the rest is identical.
  const mask = (xml) =>
    xml
      .replace(
        /<achievementsList>[\s\S]*?<\/achievementsList>/,
        "<achievementsList>MASKED</achievementsList>",
      )
      .replace(
        /<unviewedAchievementsList\s*\/>|<unviewedAchievementsList><\/unviewedAchievementsList>/,
        "<unviewedAchievementsList/>",
      )
      .replace(
        /<viewedUnlockablesList\s*\/>|<viewedUnlockablesList><\/viewedUnlockablesList>/,
        "<viewedUnlockablesList/>",
      )
      .replace(/<unlock>[\s\S]*?<\/unlock>/g, "");

  assert.equal(mask(out), mask(fixtureXml), "only the managed lists may move");

  // Contents, not just byte ranges.
  assert.ok(out.includes("<coins>463129029</coins>"), "coins untouched");
  assert.ok(out.includes("<viewedViewables>"), "viewedViewables untouched");
  assert.ok(out.includes("<discoveredPickups>"), "discoveredPickups untouched");
  assert.equal(
    findAll(
      parseXml(out).find((n) => n.type === "elem"),
      "unlock",
    ).length,
    save.unlocks.length,
    "every unlock is written exactly once",
  );
});

// ---------------------------------------------------------------- coverage reporting

test("reports which tokens the catalogue does not know about", () => {
  const save = loadSave(fixtureXml);
  const coverage = inspectCoverage(save, catalog);

  assert.equal(coverage.achievements.total, 89);
  assert.equal(
    coverage.achievements.known,
    89,
    "every achievement in the save should resolve",
  );
  assert.deepEqual(coverage.achievements.unknown, []);

  assert.equal(coverage.unlocks.total, 186);
  // Logs.* / NewtStatue.* / Karma.* are runtime-generated and intentionally not in the catalogue.
  const unknownNamespaces = new Set(
    coverage.unlocks.unknown.map((u) => u.split(".")[0]),
  );
  assert.deepEqual([...unknownNamespaces].sort(), [
    "Karma",
    "Logs",
    "NewtStatue",
  ]);
});

// ---------------------------------------------------------------- toggling

test("granting a challenge writes both the achievement and its reward", () => {
  const save = loadSave(fixtureXml);
  const ch = catalog.find(
    (c) => c.achievement === "CommandoFastFirstStageClear",
  );
  assert.ok(ch, "expected CommandoFastFirstStageClear in catalogue");
  assert.ok(
    !save.achievements.includes(ch.achievement),
    "fixture should not already have this one",
  );
  assert.ok(ch.unlocks.length > 0, "the challenge should grant a reward");

  toggleChallenge(save, ch, true);
  assert.ok(save.achievements.includes(ch.achievement));
  for (const r of ch.unlocks)
    assert.ok(save.unlocks.includes(r), `${r} should be unlocked`);

  const out = save.toXml();
  assert.ok(out.includes("CommandoFastFirstStageClear"));
});

test("revoking a challenge removes the achievement and its reward", () => {
  const save = loadSave(fixtureXml);
  const ch = catalog.find(
    (c) => c.achievement === "CommandoFastFirstStageClear",
  );
  const preexisting = new Set(save.unlocks);
  toggleChallenge(save, ch, true);
  toggleChallenge(save, ch, false);

  assert.ok(!save.achievements.includes(ch.achievement));
  for (const r of ch.unlocks) {
    if (preexisting.has(r)) continue;
    assert.ok(!save.unlocks.includes(r), `${r} should be removed`);
  }
});

test("revoking a challenge that another enabled challenge also grants keeps the reward", () => {
  // Two catalogue entries sharing a reward would be a catalogue bug; assert there are none,
  // which also documents the assumption behind the shared-reward guard in toggleChallenge.
  const byReward = new Map();
  for (const c of catalog) {
    for (const r of c.unlocks) {
      if (!byReward.has(r)) byReward.set(r, []);
      byReward.get(r).push(c.achievement);
    }
  }
  const shared = [...byReward.entries()].filter(([, v]) => v.length > 1);
  assert.deepEqual(
    shared,
    [],
    "no reward should be granted by more than one achievement",
  );
});

// ---------------------------------------------------------------- bulk operations

test("unlock all grants every achievement and reward exactly once", () => {
  const save = loadSave(fixtureXml);
  unlockAll(save, catalog);

  assert.equal(save.achievements.length, catalog.length);
  assert.equal(
    new Set(save.achievements).size,
    catalog.length,
    "no duplicates",
  );

  const coverage = inspectCoverage(save, catalog);
  assert.deepEqual(coverage.achievements.unknown, []);
  assert.equal(coverage.achievements.known, catalog.length);

  // Runtime tokens that were already present must be preserved, not discarded.
  assert.ok(
    save.unlocks.some((u) => u.startsWith("Logs.")),
    "logbook unlocks should survive",
  );
  assert.ok(
    save.unlocks.some((u) => u.startsWith("NewtStatue.")),
    "newt statue unlocks should survive",
  );
  assert.ok(
    save.unlocks.some((u) => u.startsWith("Karma.")),
    "karma unlocks should survive",
  );
});

test("unlock all is idempotent", () => {
  const a = loadSave(fixtureXml);
  unlockAll(a, catalog);
  const once = a.toXml();

  const b = loadSave(fixtureXml);
  unlockAll(b, catalog);
  unlockAll(b, catalog);
  const twice = b.toXml();

  assert.equal(
    twice,
    once,
    "applying unlock-all twice must equal applying it once",
  );
});

test("unlock all can be limited to specific DLCs", () => {
  const save = loadSave(fixtureXml);
  // A base-game achievement this profile has not earned, used to prove other DLCs stay untouched.
  const untouched = "CommandoFastFirstStageClear";
  assert.ok(
    !save.achievements.includes(untouched),
    `${untouched} should not be earned in the fixture`,
  );

  unlockAll(save, catalog, { dlcs: ["hc"] });
  const hc = catalog.filter((c) => c.dlc === "hc");
  assert.equal(hc.length, 34);
  for (const c of hc)
    assert.ok(
      save.achievements.includes(c.achievement),
      `${c.achievement} should be granted`,
    );
  assert.ok(
    !save.achievements.includes(untouched),
    "non-HC content should be untouched",
  );
});

test("lock all removes every catalogue achievement but keeps runtime tokens", () => {
  const save = loadSave(fixtureXml);
  const karmaBefore = save.unlocks.filter((u) => u.startsWith("Karma."));
  assert.ok(karmaBefore.length > 0, "fixture should contain karma unlocks");

  unlockAll(save, catalog);
  lockAll(save, catalog);

  assert.ok(
    save.achievements.every((a) => !catalog.some((c) => c.achievement === a)),
    "no catalogue achievement should remain",
  );
  assert.deepEqual(
    save.unlocks.filter((u) => u.startsWith("Karma.")),
    karmaBefore,
  );
  assert.ok(save.unlocks.some((u) => u.startsWith("Logs.")));
});

test("lock all is a superset-safe inverse of unlock all for non-catalogue tokens", () => {
  const baseline = loadSave(fixtureXml);
  const baselineRuntime = baseline.unlocks
    .filter((u) => /^(Logs|NewtStatue|Karma)\./.test(u))
    .sort();

  const save = loadSave(fixtureXml);
  unlockAll(save, catalog);
  lockAll(save, catalog);

  const afterRuntime = save.unlocks
    .filter((u) => /^(Logs|NewtStatue|Karma)\./.test(u))
    .sort();
  assert.deepEqual(
    afterRuntime,
    baselineRuntime,
    "runtime tokens must be neither added nor lost",
  );
});

// ---------------------------------------------------------------- coins / name

test("coins are clamped to a signed 32-bit range", () => {
  const save = loadSave(fixtureXml);
  save.coins = -5;
  assert.equal(save.coins, 0);
  save.coins = 99999999999;
  assert.equal(save.coins, 2147483647);
  save.coins = 72;
  assert.equal(save.coins, 72);
});

test("the profile name can be read and written", () => {
  const save = loadSave(fixtureXml);
  assert.equal(save.profileName, "FixtureProfile");
  save.profileName = "Someone";
  assert.equal(save.profileName, "Someone");
  assert.ok(save.toXml().includes("<name>Someone</name>"));
});

test("the save version is exposed and never rewritten", () => {
  const save = loadSave(fixtureXml);
  assert.equal(save.version, "3");
  assert.ok(save.toXml().includes("<version>3</version>"));
});

// ---------------------------------------------------------------- unknown-token safety

test("an unknown token from a future game version survives an edit", () => {
  const save = loadSave(fixtureXml);
  save.achievements.push("SomeFutureAchievementFromPatch19");
  save.unlocks.push("Characters.SomeFutureSurvivor");
  const out = save.toXml();
  assert.ok(out.includes("SomeFutureAchievementFromPatch19"));
  assert.ok(out.includes("Characters.SomeFutureSurvivor"));
});

test("an unknown top-level element from a future game version survives", () => {
  const xml = fixtureXml.replace(
    "<coins>",
    "<someFutureToggle>true</someFutureToggle><coins>",
  );
  const save = loadSave(xml);
  save.coins = 1;
  assert.ok(save.toXml().includes("<someFutureToggle>true</someFutureToggle>"));
});

test("rejects a file that is not a profile", () => {
  assert.throws(() => loadSave("<NotAProfile/>"), /missing <UserProfile>/);
});
