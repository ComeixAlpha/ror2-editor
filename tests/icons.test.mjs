import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const catalog = read("src/data/generated/challenges.json").challenges;
const extracted = read("src/data/generated/extracted-icons.json").icons;
const curated = read("src/data/challenge-icons.json").icons;

// ---------------------------------------------------------------- extracted icons

test("extracted icons are a manifest of real files", () => {
  assert.ok(
    Object.keys(extracted).length > 100,
    `expected a substantial set, got ${Object.keys(extracted).length}`,
  );

  const missing = [];
  for (const [achievement, slug] of Object.entries(extracted)) {
    const file = join(root, "public/images/achievements", `${slug}.png`);
    if (!existsSync(file)) missing.push(`${achievement} -> ${slug}.png`);
  }
  assert.deepEqual(missing, [], "every manifest entry must have its PNG on disk");
});

test("extracted icon slugs are file-safe and unique", () => {
  const seen = new Map();
  for (const [achievement, slug] of Object.entries(extracted)) {
    assert.match(slug, /^[a-z0-9]+$/, `${achievement} has an unsafe slug "${slug}"`);
    if (seen.has(slug)) {
      // Duplicate slugs would mean two achievements overwrite each other's file.
      assert.fail(`slug "${slug}" used by both ${seen.get(slug)} and ${achievement}`);
    }
    seen.set(slug, achievement);
  }
});

test("extracted icons only reference real achievements", () => {
  const ids = new Set(catalog.map((c) => c.achievement));
  const orphans = Object.keys(extracted).filter((a) => !ids.has(a));
  assert.deepEqual(orphans, [], "manifest must not contain unknown achievements");
});

// ---------------------------------------------------------------- curated (legacy) icons

test("the curated table still points at real files in both formats", () => {
  const missingWebp = [];
  const missingPng = [];
  for (const [achievement, icon] of Object.entries(curated)) {
    if (!existsSync(join(root, "public/images/webp", `${icon}.webp`)))
      missingWebp.push(`${achievement} -> ${icon}`);
    if (!existsSync(join(root, "public/images/png", `${icon}.png`)))
      missingPng.push(`${achievement} -> ${icon}`);
  }
  assert.deepEqual(missingWebp, [], "webp icons must exist (the <source> the browser prefers)");
  assert.deepEqual(missingPng, [], "png icons must exist (the <img> fallback)");
});

test("curated icon paths are relative and use a known asset directory", () => {
  const known = new Set(["items", "skills", "skins", "characters", "artifacts"]);
  for (const [achievement, icon] of Object.entries(curated)) {
    assert.ok(!icon.startsWith("/"), `${achievement}: icon path must be relative`);
    assert.ok(known.has(icon.split("/")[0]), `${achievement}: unknown icon directory`);
  }
});

// ---------------------------------------------------------------- combined coverage

test("every base-game achievement has an icon", () => {
  // The game bundles an icon for all of them, so a gap here means the extractor regressed.
  const covered = new Set([...Object.keys(extracted), ...Object.keys(curated)]);
  const missingBase = catalog
    .filter((c) => c.dlc === "base" && !covered.has(c.achievement))
    .map((c) => c.achievement);
  assert.deepEqual(missingBase, [], "base-game achievements must all have icons");
});

test("combined coverage is reported and the gaps are expansion content", () => {
  const covered = new Set([...Object.keys(extracted), ...Object.keys(curated)]);
  assert.ok(covered.size <= catalog.length, "cannot cover more than the catalogue");

  const uncovered = catalog.filter((c) => !covered.has(c.achievement));
  const byDlc = {};
  for (const c of uncovered) byDlc[c.dlc] = (byDlc[c.dlc] ?? 0) + 1;

  console.log(
    `  icon coverage: ${covered.size}/${catalog.length} ` +
      `(extracted ${Object.keys(extracted).length}, curated ${Object.keys(curated).length}); ` +
      `gaps by DLC ${JSON.stringify(byDlc)}`,
  );
});

test("every catalogued achievement has an icon", () => {
  const covered = new Set([...Object.keys(extracted), ...Object.keys(curated)]);
  const gaps = catalog
    .filter((c) => !covered.has(c.achievement))
    .map((c) => c.achievement);

  // `AchievementManager` resolves an icon one of two ways:
  //
  //   if (unlockableDef && unlockableDef.HasValidIcon) use unlockableDef.achievementIcon
  //   else                                            "Textures/AchievementIcons/tex<Id>Icon"
  //
  // The first path is the awkward one: the asset name lives in the unlockable's
  // `achievementIconRef.m_SubObjectName` and is often unrelated to the achievement id or the
  // skill name. `Skills.Croco.CloyingBreath` -> `texCrocoDevour`, `Skills.Mage.TectonicBlast` ->
  // `texMageRockoClap`. `tools/extract-icons/read-unlockable-icons.py` reads that straight out of
  // the bundles, so extraction no longer depends on guessing names.
  assert.deepEqual(gaps, [], "every achievement must have an icon");
});
