/**
 * The game's `<style=...>` colour table.
 *
 * Item and equipment descriptions are stored with the same inline markup the game renders, e.g.
 * `<style=cIsUtility>+15%</style>`. The colours come from the TextMeshPro style sheet the game
 * ships, extracted by `tools/extract-icons/read-text-styles.py` -- they are not in RoR2.dll and not
 * in the language files, which only ever contain the markup.
 */
import generated from "./generated/text-styles.json";

interface StyleEntry {
  color: string;
  opening: string;
  closing: string;
}

const STYLES = generated.styles as Record<string, StyleEntry>;

/** The colour a named style resolves to, or undefined for a name the sheet does not define. */
export function styleColor(name: string): string | undefined {
  return STYLES[name]?.color;
}

export const textStyleCount = generated.count as number;
