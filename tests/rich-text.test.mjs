/**
 * The game's inline text markup parser.
 *
 * The descriptions in the logbook catalogue are stored with the markup the game renders, so the
 * parser is what keeps the colouring that carries meaning -- which numbers are damage, which are
 * per-stack bonuses -- instead of showing raw `<style=...>` tags.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { parseRichText, hasStyledRuns } from "../src/lib/rich-text.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Stands in for the generated colour table, which a `.ts` module cannot import. */
const LOOKUP = (name) =>
  ({ cIsDamage: "#e5c962", cIsUtility: "#95cde5", cStack: "#8990a7" })[name];

const plain = (runs) => runs.map((r) => r.text).join("");

test("a styled run carries its colour and the text survives intact", () => {
  const runs = parseRichText("Deal <style=cIsDamage>100% damage</style> on hit.", LOOKUP);
  assert.equal(plain(runs), "Deal 100% damage on hit.");
  assert.deepEqual(
    runs.map((r) => r.color),
    [undefined, "#e5c962", undefined],
  );
  assert.equal(hasStyledRuns(runs), true);
});

test("nested styles resolve to the innermost colour", () => {
  // The shape the game actually ships for Soldier's Syringe, whose inner style is left open.
  const runs = parseRichText(
    "<style=cIsDamage>15%<style=cStack>(+15% per stack)</style></style> attack speed",
    LOOKUP,
  );
  assert.equal(plain(runs), "15%(+15% per stack) attack speed");
  // Both `</style>` tags close, so the trailing text is unstyled again.
  assert.deepEqual(
    runs.map((r) => r.color),
    ["#e5c962", "#8990a7", undefined],
  );
});

test("an unknown style name does not swallow the text", () => {
  // A sheet that does not define the name must degrade to unstyled text, never to a dropped run.
  const runs = parseRichText("a <style=cNobodyKnows>keep me</style> b", LOOKUP);
  assert.equal(plain(runs), "a keep me b");
  assert.deepEqual(
    runs.map((r) => r.color),
    [undefined, undefined, undefined],
  );
});

test("inline <color> is honoured, including the quoted form the game uses", () => {
  const hex = parseRichText('x <color=#FF7F7F>red</color> y', LOOKUP);
  assert.deepEqual(
    hex.map((r) => r.color),
    [undefined, "#FF7F7F", undefined],
  );
  const named = parseRichText('x <color="orange">orange</color> y', LOOKUP);
  assert.deepEqual(
    named.map((r) => r.color),
    [undefined, "orange", undefined],
  );
});

test("layout tags are dropped rather than shown as text", () => {
  // `<mspace>` and `<nobr>` appear in the game's own strings and mean nothing in HTML.
  const runs = parseRichText("<nobr>100%</nobr> <mspace=1em>x</mspace>", LOOKUP);
  assert.equal(plain(runs), "100% x");
});

test("text with no markup comes back as one unstyled run", () => {
  const runs = parseRichText("Just damage.", LOOKUP);
  assert.deepEqual(runs, [{ text: "Just damage.", color: undefined }]);
  assert.equal(hasStyledRuns(runs), false);
});

test("every catalogue description parses without losing characters", () => {
  // The real corpus: 248 pickups, both languages, with the styles the game ships. Stripping the
  // tags must return exactly the source text with the tags removed -- no run may be dropped, and
  // no tag may survive into the output.
  const table = JSON.parse(
    readFileSync(join(root, "src/data/generated/text-styles.json"), "utf8"),
  ).styles;
  const lookup = (name) => table[name]?.color;

  const catalogue = JSON.parse(
    readFileSync(join(root, "src/data/generated/logbook.json"), "utf8"),
  );
  const zh = JSON.parse(
    readFileSync(join(root, "src/data/generated/lang-zh-cn.json"), "utf8"),
  ).strings;

  const texts = [];
  for (const [token, info] of Object.entries(catalogue.entries)) {
    if (info.description) texts.push(info.description);
    const translated = info.descriptionToken ? zh[info.descriptionToken] : undefined;
    if (translated) texts.push(translated);
  }
  assert.ok(texts.length > 400, `only ${texts.length} descriptions found`);

  const stillTagged = [];
  const lostText = [];
  for (const text of texts) {
    const runs = parseRichText(text, lookup);
    const out = runs.map((r) => r.text).join("");
    const expected = text.replace(/<[^>]*>/g, "");
    if (/<(style|color)/i.test(out)) stillTagged.push(text);
    if (out !== expected) lostText.push(text);
  }
  assert.deepEqual(stillTagged.slice(0, 3), [], "markup leaked into the rendered text");
  assert.deepEqual(lostText.slice(0, 3), [], "characters were lost while parsing");

  console.log(`  parsed ${texts.length} descriptions`);
});
