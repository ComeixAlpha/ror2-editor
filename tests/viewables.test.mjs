import { test, fixture } from "./_fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadSave } from "../src/lib/save.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Read the generated artefact directly rather than importing `src/data/viewables.ts`: that module
// imports JSON, which Node's ESM loader rejects without an import attribute. Same approach as
// catalog.test.mjs, and it keeps this file a guard on the artefact itself.
const generated = JSON.parse(
  readFileSync(join(root, "src/data/generated/viewables.json"), "utf8"),
);
const TABLE = generated.viewables;
const ICONS = generated.icons;
const tokens = Object.keys(TABLE);
const byCategory = {};
for (const [token, info] of Object.entries(TABLE)) {
  (byCategory[info.category] ??= []).push(token);
}

// ---------------------------------------------------------------- catalogue shape

test("the catalogue covers the six token namespaces", () => {
  const cats = Object.keys(byCategory).sort();
  assert.deepEqual(cats, [
    "logbook",
    "setting",
    "signup",
    "skill",
    "skin",
    "survivor",
  ]);
  assert.ok(tokens.length > 1000, `expected a full catalogue, got ${tokens.length}`);
});

test("every token matches one of the game's path shapes", () => {
  // RoR2.dll formats survivor tokens as "/Survivors/{0}"; loadout tokens live under
  // "/Loadout/Bodies/{0}/"; settings tokens are authored in prefabs; logbook tokens are
  // "<LOGBOOK_CATEGORY_*>/<language token>" pairs; "/Signup" is the EULA marker.
  //
  // Two things are less tidy in the shipped data and are allowed deliberately:
  //   - skin names may contain dots (`Drifter.Skin.Alt1`), because the asset is literally named
  //     that;
  //   - the game also writes bare container tokens such as `/Survivors/` and `/Settings/Gameplay/`
  //     to mean "the whole group was seen".
  const shapes = [
    /^\/Signup$/,
    /^\/Survivors\/[A-Za-z0-9]*\/?$/,
    /^\/Loadout\/Bodies\/[^/]+\/[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/,
    /^\/Loadout\/Bodies\/[^/]+\/Skins\/[A-Za-z0-9_.]+$/,
    /^\/Logbook(\/LOGBOOK_CATEGORY_[A-Z]+\/[A-Z0-9_]+)?\/?$/,
    /^\/Settings(\/[A-Za-z0-9_]+)*\/?$/,
    /^\/Loadouts\/?$/,
  ];
  const bad = tokens.filter((t) => !shapes.some((re) => re.test(t)));
  assert.deepEqual(bad.slice(0, 6), [], "unexpected token shape");
});

test("spaces and empties never leak into a token", () => {
  // The game splits <viewedViewables> on a single space, so a token containing one would become
  // two bogus entries.
  for (const t of tokens) {
    assert.ok(t === t.trim(), `${t} has surrounding whitespace`);
    assert.ok(!t.includes(" "), `${t} contains a space`);
  }
});

test("display names are populated", () => {
  const fallback = tokens.filter((t) => !TABLE[t].name || TABLE[t].name === t);
  assert.ok(
    fallback.length < 20,
    `${fallback.length} entries fell back to the asset name: ${fallback.slice(0, 5).join(", ")}`,
  );
  const distinct = new Set(tokens.map((t) => TABLE[t].name)).size;
  assert.ok(distinct > 150, `only ${distinct} distinct names`);
});

// ---------------------------------------------------------------- icons

test("icons point at the extracted image directory", () => {
  for (const [token, slug] of Object.entries(ICONS)) {
    assert.ok(tokens.includes(token), `${token} has an icon but is not in the catalogue`);
    assert.match(slug, /^[a-z0-9]+$/, `${token}: bad slug ${slug}`);
  }
});

test("loadout entries are covered by icons except known non-survivor bodies", () => {
  // Settings are UI options authored in prefabs, the logbook's art lives in the logbook UI rather
  // than in per-entry assets, and /Signup is a marker, so none of the three has a texture this
  // extraction can name.
  //
  // Two loadout gaps remain and are deliberate:
  //   - Engineer's turrets and False Son's boss forms are deployable/boss bodies, not survivors;
  //     their "skins" are models and no achievement-style art exists for them.
  //   - Void Fiend has no standalone body portrait in the bundles (only an atlas), so it keeps a
  //     placeholder rather than being mapped to unrelated art.
  const without = tokens.filter((t) => !ICONS[t]);
  const unexpected = without.filter(
    (t) =>
      !["setting", "logbook", "signup"].includes(TABLE[t].category) &&
      !/TurretBody|BossBody/.test(t) &&
      t !== "/Survivors/VoidSurvivor",
  );
  assert.deepEqual(
    unexpected.slice(0, 8),
    [],
    `${unexpected.length} survivors/skills/skins have no icon`,
  );

  const loadout = tokens.filter((t) =>
    ["survivor", "skill", "skin"].includes(TABLE[t].category),
  );
  const covered = loadout.filter((t) => ICONS[t]).length;
  assert.ok(
    covered / loadout.length > 0.9,
    `only ${covered}/${loadout.length} loadout entries have an icon`,
  );
});

// ---------------------------------------------------------------- save editing

test("a real profile's viewables are read", () => {
  const save = loadSave(fixture);
  assert.ok(save.viewables.length > 0, "the fixture has viewed viewables");
  assert.ok(save.viewables.every((v) => v.startsWith("/")));
});

test("marking seen then unseen round-trips, and repeats are no-ops", () => {
  const save = loadSave(fixture);
  const token = "/Survivors/Commando";
  const had = save.viewables.includes(token);

  if (!had) {
    assert.equal(save.setViewableViewed(token, true), true);
    assert.equal(save.viewables.includes(token), true);
    // Idempotent, so a caller can invoke it unconditionally.
    assert.equal(save.setViewableViewed(token, true), false);
    assert.equal(save.setViewableViewed(token, false), true);
    assert.equal(save.viewables.includes(token), false);
  } else {
    assert.equal(save.setViewableViewed(token, true), false);
    assert.equal(save.setViewableViewed(token, false), true);
    assert.equal(save.viewables.includes(token), false);
    assert.equal(save.setViewableViewed(token, true), true);
  }
});

/** The raw `<viewedViewables>` body, so formatting can be compared without other lists in the way. */
function viewablesElement(xml) {
  const m = /<viewedViewables>([\s\S]*?)<\/viewedViewables>/.exec(xml);
  assert.ok(m, "no <viewedViewables> element");
  return m[1];
}

test("a profile whose viewables are untouched keeps that element byte-for-byte", () => {
  // `commit` always rewrites the achievement lists, so the whole document is not a fixed point.
  // What must hold is that <viewedViewables> is left exactly as the game wrote it, including its
  // own newlines and indentation, unless the user edited it.
  const save = loadSave(fixture);
  assert.equal(save.hasViewableEdits, false);
  assert.equal(viewablesElement(save.toXml()), viewablesElement(fixture));
});

test("editing viewables replaces that element and survives a reload", () => {
  const save = loadSave(fixture);
  // Pick a token the profile has not seen, so the edit is a real change.
  const token = tokens.find((t) => !save.viewables.includes(t));
  assert.ok(token, "every catalogue token is already viewed; pick another fixture");

  save.setViewableViewed(token, true);
  assert.equal(save.hasViewableEdits, true);

  const xml = save.toXml();
  assert.notEqual(viewablesElement(xml), viewablesElement(fixture));
  assert.ok(loadSave(xml).viewables.includes(token));
});

test("every catalogue token can be written and read back", () => {
  const save = loadSave(fixture);
  for (const t of tokens) save.setViewableViewed(t, true);
  const again = loadSave(save.toXml());
  const missing = tokens.filter((t) => !again.viewables.includes(t));
  assert.deepEqual(missing.slice(0, 5), [], `${missing.length} tokens did not survive`);
});

test("unknown tokens in a real profile are preserved", () => {
  const save = loadSave(fixture);
  const known = new Set(tokens);
  const unknown = save.viewables.filter((t) => !known.has(t));
  console.log(`  fixture viewables: ${save.viewables.length}, unknown: ${unknown.length}`);
  // A real profile is the acceptance test for the catalogue: everything it has viewed must be
  // something the editor can show and toggle.
  assert.deepEqual(
    unknown.slice(0, 8),
    [],
    `${unknown.length}/${save.viewables.length} viewables are unknown to the catalogue`,
  );
});
