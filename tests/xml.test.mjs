import { test, fixture } from "./_fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  parseXml,
  serializeXml,
  findChild,
  findAll,
  textOf,
  setText,
  setAttribute,
} from "../src/lib/xml.ts";
import { loadSave } from "../src/lib/save.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");


test("round-trips a real save byte-for-byte", () => {
  const doc = parseXml(fixture);
  const out = serializeXml(doc);
  assert.equal(out.length, fixture.length, "serialized length differs");
  assert.equal(
    out,
    fixture,
    "serialized output is not byte-identical to the input",
  );
});

test("round-trips after a no-op edit reverted", () => {
  const doc = parseXml(fixture);
  const rootEl = doc.find((n) => n.type === "elem");
  const name = findChild(rootEl, "name");
  const original = textOf(name);
  setText(name, "SomethingElse");
  setText(name, original);
  assert.equal(serializeXml(doc), fixture);
});

test("preserves CRLF inside space-separated lists", () => {
  const doc = parseXml(fixture);
  const rootEl = doc.find((n) => n.type === "elem");
  const raw = textOf(findChild(rootEl, "achievementsList"));
  assert.ok(
    raw.includes("\n"),
    "achievement list should still contain its original newlines",
  );
});

test("preserves escaped nested XML in input maps", () => {
  const doc = parseXml(fixture);
  const rootEl = doc.find((n) => n.type === "elem");
  for (const tag of ["keyboardMap", "mouseMap", "joystickMap"]) {
    const el = findChild(rootEl, tag);
    assert.ok(el, `${tag} element missing`);
    const text = textOf(el);
    assert.ok(
      text.includes("&lt;?xml"),
      `${tag} should still hold escaped XML`,
    );
  }
  assert.equal(serializeXml(doc), fixture);
});

test("finds the achievement and unlock collections", () => {
  const doc = parseXml(fixture);
  const rootEl = doc.find((n) => n.type === "elem");
  assert.equal(rootEl.name, "UserProfile");

  const version = textOf(findChild(rootEl, "version")).trim();
  assert.equal(version, "3");

  const achievements = textOf(findChild(rootEl, "achievementsList"))
    .trim()
    .split(/\s+/);
  assert.equal(achievements.length, 102);
  assert.ok(achievements.includes("AcolyteClearGameMonsoon"));

  const stats = findChild(rootEl, "stats");
  const unlocks = findAll(stats, "unlock").map((u) => textOf(u).trim());
  assert.equal(unlocks.length, 186);
  assert.ok(unlocks.includes("Characters.Acolyte"));
  assert.ok(unlocks.includes("Karma.StartingKarma.8"));

  const statsCount = findAll(stats, "stat").length;
  assert.equal(statsCount, 8157);
});

test("editing one node leaves every other node untouched", () => {
  const doc = parseXml(fixture);
  const rootEl = doc.find((n) => n.type === "elem");
  const coins = findChild(rootEl, "coins");
  setText(coins, "123");
  const out = serializeXml(doc);

  assert.ok(out.includes("<coins>123</coins>"));
  // Everything after the edit must be unchanged.
  const tailIn = fixture.slice(fixture.indexOf("</coins>"));
  const tailOut = out.slice(out.indexOf("</coins>"));
  assert.equal(tailOut, tailIn);
  // And the prefix too.
  assert.equal(
    out.slice(0, out.indexOf("<coins>")),
    fixture.slice(0, fixture.indexOf("<coins>")),
  );
});

test("reports structural errors with a location", () => {
  assert.throws(() => parseXml("<a><b></a>"), /mismatched tag/);
  assert.throws(() => parseXml("<a>"), /unclosed tag/);
  assert.throws(() => parseXml("<a x=1>"), /not quoted/);
});

test("handles self-closing, comments, CDATA and attributes", () => {
  const xml = `<?xml version="1.0"?><!-- c --><r a="1" b='2'><e/><![CDATA[x<y]]></r>`;
  assert.equal(serializeXml(parseXml(xml)), xml);
});

test("preserves the exact self-closing style, with or without a space", () => {
  // The game writes `<RebirthItem />` in some places and `<Foo/>` in others. Both must survive.
  for (const xml of [
    "<r><RebirthItem /></r>",
    "<r><RebirthItem/></r>",
    "<r><a /><b/><c  /></r>",
    "<r x='1' />",
    "<r x='1'/>",
  ]) {
    assert.equal(serializeXml(parseXml(xml)), xml, `failed for ${xml}`);
  }
});

test("a self-closing element keeps its spacing after a commit", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><UserProfile><achievementsList>x</achievementsList><RebirthItem /><coins>1</coins></UserProfile>`;
  const save = loadSave(xml);
  save.achievements.push("y");
  const out = save.toXml();
  assert.ok(out.includes("<RebirthItem />"), "self-closing space must be preserved");
  assert.ok(!out.includes("<RebirthItem/>"), "must not be normalised to the no-space form");
});

test("an element that gains a body stops being written as self-closing", () => {
  const doc = parseXml(`<r><a /></r>`);
  setText(doc[0].children[0], "v");
  assert.equal(serializeXml(doc), `<r><a>v</a></r>`);
});

test("an empty open/close pair is never collapsed into a self-closing tag", () => {
  // Collapsing this would emit `<a/>` and then a stray `</a>`, which is not well-formed XML and
  // makes the game reject the save.
  const xml = `<r><a></a><b/><c></c></r>`;
  const doc = parseXml(xml);
  setText(doc[0].children[0], "");
  setText(doc[0].children[2], "");
  const out = serializeXml(doc);
  assert.equal(out, xml);
  assert.ok(!out.includes("<a/>"), "empty open/close pair must stay an open/close pair");
});

test("every serialisation of a save is itself parseable", () => {
  // A cheap structural invariant: nothing we emit may be malformed.
  const save = loadSave(fixture);
  save.achievements.push("AnExtraAchievement");
  save.unlocks.push("Characters.Someone");
  const out = save.toXml();
  assert.doesNotThrow(() => parseXml(out), "serialised save must round-trip through the parser");
  assert.equal(serializeXml(parseXml(out)), out);
});

test("leaves attribute quoting style alone", () => {
  const xml = `<r a="dq" b='sq'/>`;
  const doc = parseXml(xml);
  setAttribute(doc[0], "c", "new");
  assert.equal(serializeXml(doc), `<r a="dq" b='sq' c="new"/>`);
});
