import { test, fixture } from "./_fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadSave } from "../src/lib/save.ts";
import {
  validateSave,
  detectNulFilledFile,
  summariseReport,
  SURVIVOR_PREFERENCE_TOKENS,
  EXPECTED_SAVE_VERSION,
} from "../src/lib/save-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const catalog = JSON.parse(readFileSync(join(root, "src/data/generated/challenges.json"), "utf8")).challenges;
const known = {
  achievements: new Set(catalog.map((c) => c.achievement)),
  unlocks: new Set(catalog.flatMap((c) => c.unlocks)),
};

// ---------------------------------------------------------------- the real save

test("the real fixture passes validation", () => {
  const report = validateSave(loadSave(fixture), known);
  // It must at least have no errors. Warnings are acceptable for a hand-edited real save.
  assert.deepEqual(
    report.errors.map((e) => `${e.where}: ${e.message}`),
    [],
    "the fixture should not produce errors",
  );
});

test("a cleanly round-tripped save still passes", () => {
  const save = loadSave(fixture);
  save.profileName = "RoundTrip";
  const again = loadSave(save.toXml());
  const report = validateSave(again, known);
  assert.deepEqual(report.errors, []);
});

test("the summary line reflects the report", () => {
  assert.equal(summariseReport(validateSave(loadSave(fixture), known)).length > 0, true);
});

// ---------------------------------------------------------------- survivorPreference

test("survivorPreference must be a real survivor token", () => {
  // A bad value makes SurvivorCatalog.FindSurvivorDef return null, and the game then does
  // `if (!survivorPreference)` on a null UnityEngine.Object, which throws.
  for (const bad of ["", "NotASurvivor", "commando"]) {
    const save = loadSave(fixture);
    const el = save.root.children.find((c) => c.type === "elem" && c.name === "survivorPreference");
    assert.ok(el, "fixture should have survivorPreference");
    el.children = [{ type: "text", raw: bad }];
    const report = validateSave(save, known);
    assert.equal(report.ok, false, `"${bad}" should be rejected`);
    assert.ok(
      report.errors.some((e) => e.where === "survivorPreference"),
      `"${bad}" should produce a survivorPreference error`,
    );
  }
});

test("every listed survivor token is accepted", () => {
  for (const token of SURVIVOR_PREFERENCE_TOKENS) {
    const save = loadSave(fixture);
    const el = save.root.children.find((c) => c.type === "elem" && c.name === "survivorPreference");
    el.children = [{ type: "text", raw: token }];
    const report = validateSave(save, known);
    assert.ok(
      !report.errors.some((e) => e.where === "survivorPreference"),
      `${token} should be accepted`,
    );
  }
});

// ---------------------------------------------------------------- version / name

test("an unexpected version is a warning, not an error", () => {
  const save = loadSave(fixture);
  const el = save.root.children.find((c) => c.type === "elem" && c.name === "version");
  el.children = [{ type: "text", raw: "9" }];
  const report = validateSave(save, known);
  assert.ok(report.warnings.some((w) => w.where === "version"));
  assert.ok(report.ok, "a version mismatch alone should not block export");
});

test("the fixture carries the version the game expects", () => {
  const save = loadSave(fixture);
  const el = save.root.children.find((c) => c.type === "elem" && c.name === "version");
  assert.equal(el.children[0].raw.trim(), EXPECTED_SAVE_VERSION);
});

test("a reserved or empty profile name is flagged", () => {
  for (const bad of ["", "default", "DEFAULT"]) {
    const save = loadSave(fixture);
    save.profileName = bad;
    // setName only writes when the element exists; the fixture has one.
    const report = validateSave(save, known);
    assert.ok(
      report.issues.some((i) => i.where === "name"),
      `name ${JSON.stringify(bad)} should be flagged`,
    );
  }
});

// ---------------------------------------------------------------- lists

test("a leading space in a token list is reported", () => {
  // This is exactly what old.xml / SUCK.xml carried.
  const tampered = fixture.replace(
    /<achievementsList>/,
    "<achievementsList> ",
  );
  const report = validateSave(loadSave(tampered), known);
  assert.ok(
    report.warnings.some((w) => w.where === "achievementsList"),
    "leading whitespace should be reported",
  );
});

test("duplicated list entries are reported", () => {
  const tampered = fixture.replace(
    /<achievementsList>([\s\S]*?)<\/achievementsList>/,
    (_m, body) => `<achievementsList>${body.trim()} ${body.trim().split(/\s+/)[0]}</achievementsList>`,
  );
  const report = validateSave(loadSave(tampered), known);
  assert.ok(report.warnings.some((w) => w.where === "achievementsList" && /duplicat/i.test(w.message)));
});

test("a <stat> without a name attribute is an error", () => {
  const tampered = fixture.replace('<stat name="totalKills">73708</stat>', "<stat>73708</stat>");
  assert.notEqual(tampered, fixture, "the replacement should have matched");
  const report = validateSave(loadSave(tampered), known);
  assert.ok(report.errors.some((e) => e.where === "stats" && /name attribute/i.test(e.message)));
});

test("an empty <unlock> element is reported", () => {
  const tampered = fixture.replace("</stats>", "<unlock></unlock></stats>");
  const report = validateSave(loadSave(tampered), known);
  assert.ok(report.warnings.some((w) => /empty <unlock>/i.test(w.message)));
});

test("unknown tokens are notes, not errors", () => {
  const save = loadSave(fixture);
  save.achievements.push("SomeAchievementFromAFuturePatch");
  save.unlocks.push("Characters.SomeoneFromAFuturePatch");
  const report = validateSave(save, known);
  assert.ok(report.ok, "unknown tokens must not block export");
  assert.ok(report.infos.some((i) => i.where === "achievementsList"));
  assert.ok(report.infos.some((i) => i.where === "stats"));
});

test("known runtime token namespaces are not reported as unknown", () => {
  // Logs./NewtStatue./Karma. are not achievement rewards, so they are expected to be unknown.
  const report = validateSave(loadSave(fixture), known);
  const unlockNote = report.infos.find((i) => i.where === "stats" && /unlock string/i.test(i.message));
  // The fixture has 97 runtime tokens; if they leaked into the report the count would be large.
  if (unlockNote) assert.ok(!/9[0-9] unlock/.test(unlockNote.message), unlockNote.message);
});

// ---------------------------------------------------------------- NUL detection

test("an all-NUL file is detected", () => {
  // The failure mode that made the game write bad_profiles.log: right size, zero content.
  assert.equal(detectNulFilledFile(new Uint8Array(500_000)), true);
  assert.equal(detectNulFilledFile(new Uint8Array(0)), false);
  assert.equal(detectNulFilledFile(new TextEncoder().encode("<?xml version=\"1.0\"?>")), false);
});

test("a valid profile is not mistaken for an all-NUL file", () => {
  const bytes = new TextEncoder().encode(fixture);
  assert.equal(detectNulFilledFile(bytes), false);
});

test("a file with NULs only at the start is not an all-NUL file", () => {
  const bytes = new Uint8Array(4096);
  bytes[0] = 0;
  bytes[1] = 0;
  for (let i = 2; i < bytes.length; i++) bytes[i] = 65; // 'A'
  assert.equal(detectNulFilledFile(bytes), false);
});

// ---------------------------------------------------------------- the real broken files

test("the real broken profiles are diagnosed", () => {
  // These live outside the repo; skip when they are not present so CI stays portable.
  const D = "F:/0dev/RE/sz/Risk of Rain 2/Risk of Rain 2/FreeTP/UserSaves/UserProfiles";
  const cases = [
    { file: "old.xml", expectWhere: "achievementsList" },
  ];
  for (const c of cases) {
    const path = join(D, c.file);
    if (!existsSync(path)) {
      console.log(`  skip  ${c.file} not present`);
      continue;
    }
    const report = validateSave(loadSave(readFileSync(path, "utf8")), known);
    console.log(
      `  ${c.file}: ${summariseReport(report)}` +
        (report.errors.length ? ` | errors: ${report.errors.map((e) => e.where).join(", ")}` : "") +
        (report.warnings.length ? ` | warnings: ${[...new Set(report.warnings.map((w) => w.where))].join(", ")}` : ""),
    );
    assert.ok(
      report.issues.some((i) => i.where === c.expectWhere),
      `${c.file} should raise something about ${c.expectWhere}`,
    );
  }
});
