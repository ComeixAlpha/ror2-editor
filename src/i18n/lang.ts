/**
 * Which language the editor is showing, and the lookup for text that comes from the game itself.
 *
 * The project rule is that the game's own translation is the authority, so nothing game-facing is
 * translated by hand. The English names are baked into `logbook.json` / `challenges.json` at
 * extraction time; every other locale is a token -> string table produced by
 * `tools/extract-icons/build-lang.py`, and anything missing falls back to that baked English rather
 * than showing a blank.
 */
import zhCn from "../data/generated/lang-zh-cn.json";

export type Lang = "en" | "zh";

export const LANGS: ReadonlyArray<{ id: Lang; label: string; title: string }> = [
  { id: "en", label: "EN", title: "English" },
  { id: "zh", label: "中文", title: "简体中文" },
];

/** Locale id -> the game's token table. English needs none: it is already in the data. */
const GAME_TABLES: Record<Lang, Record<string, string>> = {
  en: {},
  zh: (zhCn as { strings: Record<string, string> }).strings,
};

/** The game's own string for a token, or undefined when this language has no table for it. */
export function gameText(token: string | undefined, lang: Lang): string | undefined {
  if (!token || lang === "en") return undefined;
  return GAME_TABLES[lang][token];
}

/**
 * A game-provided name in the chosen language.
 *
 * `english` is the value already baked into the generated catalogue, so it is both the English
 * rendering and the fallback for a token the locale table does not carry.
 */
export function localized(token: string | undefined, english: string, lang: Lang): string {
  return gameText(token, lang) ?? english;
}

/**
 * The achievement token pair the game uses for a challenge card.
 *
 * The challenge catalogue stores the resolved English text rather than the tokens, so the token is
 * rebuilt from the achievement identifier -- the same `ACHIEVEMENT_<ID>_NAME` convention
 * `build-lang.py` collected against.
 */
export function achievementTokens(identifier: string): { name: string; description: string } {
  const id = identifier.toUpperCase();
  return { name: `ACHIEVEMENT_${id}_NAME`, description: `ACHIEVEMENT_${id}_DESCRIPTION` };
}

/** `isChinese` gates the few places that need to change layout rather than wording. */
export function isChinese(lang: Lang): boolean {
  return lang === "zh";
}
