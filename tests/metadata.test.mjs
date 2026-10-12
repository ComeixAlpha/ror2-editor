import { test, fixture as fixtureXml } from "./_fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadSave } from "../src/lib/save.ts";
import { serializeXml } from "../src/lib/xml.ts";
import {
  readMetadata,
  setMetadataField,
  normalizeFieldValue,
  readStat,
  writeStat,
  FIELD_SPECS,
  ACHIEVEMENT_STATS,
} from "../src/lib/metadata.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// ---------------------------------------------------------------- reading

test("reads every top-level scalar field of a real profile", () => {
  const fields = readMetadata(loadSave(fixtureXml));
  assert.equal(
    fields.length,
    58,
    `expected 58 scalar fields, got ${fields.length}`,
  );
  assert.equal(
    new Set(fields.map((f) => f.name)).size,
    fields.length,
    "field names must be unique",
  );
});

test("never offers a subtree as an editable text field", () => {
  const fields = readMetadata(loadSave(fixtureXml));
  const names = new Set(fields.map((f) => f.name));
  for (const subtree of [
    "stats",
    "loadout",
    "achievementsList",
    "viewedViewables",
    "discoveredPickups",
    "keyboardMap",
    "mouseMap",
    "joystickMap",
    "HardwareJoystickMaps2",
  ]) {
    assert.ok(
      !names.has(subtree),
      `${subtree} must not be exposed as a scalar field`,
    );
  }
});

test("classifies known fields and falls back for unknown ones", () => {
  const fields = readMetadata(loadSave(fixtureXml));
  const byName = new Map(fields.map((f) => [f.name, f]));

  assert.equal(byName.get("name").spec.kind, "text");
  assert.equal(byName.get("coins").spec.kind, "integer");
  assert.equal(byName.get("coins").spec.max, 2147483647);
  assert.equal(byName.get("mouseLookSensitivity").spec.kind, "float");
  assert.equal(byName.get("aimAssistEnabled").spec.kind, "boolean");
  // A select, because an unknown survivor token makes the game null-ref while logging in.
  assert.equal(byName.get("survivorPreference").spec.kind, "select");
  assert.ok(byName.get("survivorPreference").spec.options.includes("FalseSon"));

  // Grouping must be set for everything the spec table covers.
  for (const f of fields) {
    assert.ok(f.spec.group, `${f.name} has no group`);
    assert.ok(
      ["text", "integer", "float", "boolean", "select"].includes(f.spec.kind),
      `${f.name} has bad kind`,
    );
    if (f.spec.kind === "select") {
      assert.ok(
        Array.isArray(f.spec.options) && f.spec.options.length > 0,
        `${f.name} is a select with no options`,
      );
    }
  }
});

test("reports the current values", () => {
  const byName = new Map(
    readMetadata(loadSave(fixtureXml)).map((f) => [f.name, f.value]),
  );
  assert.equal(byName.get("name"), "FixtureProfile");
  assert.equal(byName.get("coins"), "463129029");
  assert.equal(byName.get("version"), "3");
  assert.equal(byName.get("survivorPreference"), "FalseSon");
  assert.equal(byName.get("totalRunCount"), "0");
});

// ---------------------------------------------------------------- select fields

test("a select field only accepts a listed value", () => {
  const spec = FIELD_SPECS.survivorPreference;
  assert.equal(spec.kind, "select");
  for (const good of spec.options) {
    assert.equal(normalizeFieldValue(spec, good), good);
  }
  // Anything else falls back to the first option rather than being written through, because an
  // unknown survivor token makes the game throw while logging the profile in.
  assert.equal(normalizeFieldValue(spec, ""), spec.options[0]);
  assert.equal(normalizeFieldValue(spec, "NotASurvivor"), spec.options[0]);
  assert.equal(normalizeFieldValue(spec, "commando"), spec.options[0]);
});

test("selecting a survivor survives a save round-trip", () => {
  const save = loadSave(fixtureXml);
  setMetadataField(
    save,
    "survivorPreference",
    normalizeFieldValue(FIELD_SPECS.survivorPreference, "Huntress"),
  );
  const again = loadSave(save.toXml());
  const byName = new Map(readMetadata(again).map((f) => [f.name, f.value]));
  assert.equal(byName.get("survivorPreference"), "Huntress");
});

test("groups are ordered with Profile first", () => {  const fields = readMetadata(loadSave(fixtureXml));
  assert.equal(fields[0].spec.group, "Profile");
  const groups = fields.map((f) => f.spec.group);
  // Groups must not interleave.
  const seen = new Set();
  let last = groups[0];
  for (const g of groups) {
    if (g !== last) {
      assert.ok(!seen.has(g), `group ${g} appears in two separate runs`);
      seen.add(last);
      last = g;
    }
  }
});

// ---------------------------------------------------------------- writing

test("writes a field and reads it back", () => {
  const save = loadSave(fixtureXml);
  assert.equal(setMetadataField(save, "name", "NewName"), true);
  assert.equal(setMetadataField(save, "coins", "12345"), true);

  const byName = new Map(readMetadata(save).map((f) => [f.name, f.value]));
  assert.equal(byName.get("name"), "NewName");
  assert.equal(byName.get("coins"), "12345");

  const out = save.toXml();
  assert.ok(out.includes("<name>NewName</name>"));
  assert.ok(out.includes("<coins>12345</coins>"));
});

test("refuses to write a field that does not exist", () => {
  const save = loadSave(fixtureXml);
  assert.equal(setMetadataField(save, "notARealField", "x"), false);
  assert.ok(!save.toXml().includes("notARealField"));
});

test("editing one metadata field leaves every other byte untouched", () => {
  const save = loadSave(fixtureXml);
  // Serialise without committing, so this asserts purely about the metadata edit.
  setMetadataField(save, "name", "Zed");
  const out = serializeXml(save.doc);

  const i = fixtureXml.indexOf("<name>");
  const j = fixtureXml.indexOf("</name>") + "</name>".length;
  assert.ok(i > 0 && j > 7, "fixture should contain a <name> element");

  assert.equal(
    out.slice(0, out.indexOf("<name>")),
    fixtureXml.slice(0, i),
    "prefix changed",
  );
  assert.equal(
    out.slice(out.indexOf("</name>") + 7),
    fixtureXml.slice(j),
    "suffix changed",
  );
  assert.equal(
    out.length - fixtureXml.length,
    "Zed".length - "FixtureProfile".length,
  );
});

test("a full commit only rewrites the two lists the editor manages", () => {
  const save = loadSave(fixtureXml);
  setMetadataField(save, "name", "Zed");
  const out = save.toXml();

  // Elements that must be present and identical to the original.
  for (const tag of [
    "coins",
    "viewedViewables",
    "discoveredPickups",
    "HardwareJoystickMaps2",
  ]) {
    const original = fixtureXml.slice(
      fixtureXml.indexOf(`<${tag}>`),
      fixtureXml.indexOf(`</${tag}>`) + tag.length + 3,
    );
    assert.ok(
      out.includes(original),
      `<${tag}> was modified by a metadata edit`,
    );
  }
  // The two managed lists are allowed to be re-serialised (whitespace only here).
  assert.equal(
    save.achievements.length,
    89,
    "de-duplication must not lose achievements",
  );
});

test("a new metadata field added by a future patch is read, editable and preserved", () => {
  const injected = fixtureXml.replace(
    "<coins>",
    "<someFuturePatchToggle>1</someFuturePatchToggle><coins>",
  );
  const save = loadSave(injected);

  const field = readMetadata(save).find(
    (f) => f.name === "someFuturePatchToggle",
  );
  assert.ok(field, "unknown scalar fields must still be listed");
  assert.equal(field.spec.group, "Other");
  assert.equal(field.spec.kind, "boolean");

  setMetadataField(save, "someFuturePatchToggle", "0");
  assert.ok(
    save.toXml().includes("<someFuturePatchToggle>0</someFuturePatchToggle>"),
  );
});

test("clearing a field that was already empty keeps it self-closing", () => {
  const injected = fixtureXml.replace("<coins>", "<maybeEmpty/><coins>");
  const save = loadSave(injected);
  setMetadataField(save, "maybeEmpty", "");
  assert.ok(
    save.toXml().includes("<maybeEmpty/>"),
    "should stay self-closing, not become <maybeEmpty></maybeEmpty>",
  );
});

// ---------------------------------------------------------------- validation

test("integer fields are clamped to their declared maximum", () => {
  const coins = FIELD_SPECS.coins;
  assert.equal(normalizeFieldValue(coins, "99999999999"), "2147483647");
  assert.equal(normalizeFieldValue(coins, "-5"), "0");
  assert.equal(normalizeFieldValue(coins, "72"), "72");
  assert.equal(normalizeFieldValue(coins, "not a number"), "0");
  assert.equal(normalizeFieldValue(coins, "3.9"), "3");
});

test("boolean fields normalize to 0 or 1", () => {
  const spec = FIELD_SPECS.aimAssistEnabled;
  assert.equal(normalizeFieldValue(spec, "1"), "1");
  assert.equal(normalizeFieldValue(spec, "true"), "1");
  assert.equal(normalizeFieldValue(spec, "0"), "0");
  assert.equal(normalizeFieldValue(spec, "false"), "0");
  assert.equal(normalizeFieldValue(spec, ""), "0");
  assert.equal(normalizeFieldValue(spec, "anything"), "1");
});

test("float and text fields pass through", () => {
  assert.equal(
    normalizeFieldValue(FIELD_SPECS.mouseLookSensitivity, "0.25"),
    "0.25",
  );
  assert.equal(
    normalizeFieldValue(FIELD_SPECS.mouseLookSensitivity, "abc"),
    "0",
  );
  assert.equal(
    normalizeFieldValue(FIELD_SPECS.name, "hello world"),
    "hello world",
  );
});

// ---------------------------------------------------------------- achievement counters

test("reads achievement counters", () => {
  const save = loadSave(fixtureXml);
  assert.equal(readStat(save, "totalKills"), "73708");
  assert.equal(readStat(save, "totalEliteKills"), "14155");
  assert.equal(readStat(save, "totalMaulingRockKills"), "248");
  assert.equal(readStat(save, "doesNotExist"), undefined);
});

test("every declared achievement counter exists in the real save", () => {
  const save = loadSave(fixtureXml);
  const missing = ACHIEVEMENT_STATS.filter(
    (s) => readStat(save, s.name) === undefined,
  );
  assert.deepEqual(
    missing.map((s) => s.name),
    [],
    "the counter table must not reference stats the game does not write",
  );
});

test("writes an existing achievement counter", () => {
  const save = loadSave(fixtureXml);
  assert.equal(writeStat(save, "totalEliteKills", "500"), true);
  assert.equal(readStat(save, "totalEliteKills"), "500");
  assert.ok(save.toXml().includes('<stat name="totalEliteKills">500</stat>'));
});

test("creates an achievement counter the game has not written", () => {
  const save = loadSave(fixtureXml);
  assert.equal(readStat(save, "someFutureCounter"), undefined);
  assert.equal(writeStat(save, "someFutureCounter", "7"), true);
  assert.equal(readStat(save, "someFutureCounter"), "7");
  // The other 8157 counters must survive.
  const out = save.toXml();
  assert.ok(out.includes('<stat name="totalKills">73708</stat>'));
  assert.ok(out.includes('<stat name="someFutureCounter">7</stat>'));
});

test("writing counters does not disturb the unlock list", () => {
  const save = loadSave(fixtureXml);
  const before = [...save.unlocks];
  writeStat(save, "totalKills", "1");
  writeStat(save, "brandNewCounter", "2");
  assert.deepEqual(save.unlocks, before);
  assert.ok(save.toXml().includes("<unlock>Characters.Acolyte</unlock>"));
});

test("stat round-trip keeps the save valid", () => {
  const save = loadSave(fixtureXml);
  writeStat(save, "totalKills", "100");
  const reloaded = loadSave(save.toXml());
  assert.equal(readStat(reloaded, "totalKills"), "100");
  assert.equal(reloaded.unlocks.length, save.unlocks.length);
  assert.equal(reloaded.achievements.length, save.achievements.length);
});
