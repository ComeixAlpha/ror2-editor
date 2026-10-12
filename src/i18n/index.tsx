/**
 * Language state for the editor.
 *
 * The choice persists in `localStorage`, and on a first visit it follows the browser: a Chinese
 * browser should not have to find the switch before the editor is readable.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Lang } from "./lang";
import { localized } from "./lang";
import {
  DLC_LABELS_EN,
  DLC_LABELS_ZH,
  FIELD_GROUPS_ZH,
  FIELD_LABELS_ZH,
  UI,
  type UiKey,
} from "./ui";

const STORAGE_KEY = "ror2-editor.lang";

/** Reading storage can throw (private mode, blocked cookies), so it is never assumed to work. */
function readStored(): Lang | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "en" || raw === "zh" ? raw : undefined;
  } catch {
    return undefined;
  }
}

function detect(): Lang {
  const stored = readStored();
  if (stored) return stored;
  const nav = typeof navigator === "undefined" ? "" : navigator.language ?? "";
  return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /**
   * The editor's own wording.
   *
   * `params` fills `{name}` placeholders, so a sentence with a count in it stays one string in the
   * dictionary -- word order differs between languages and gluing fragments together in the
   * component would only work for English.
   */
  t: (key: UiKey, params?: Record<string, string | number>) => string;
  /** A game-provided string; `english` is the catalogue's baked value and the fallback. */
  g: (token: string | undefined, english: string) => string;
  /** A plain-settings field label, falling back to the English the specs carry. */
  fieldLabel: (english: string) => string;
  /** A plain-settings group name. */
  fieldGroup: (english: string) => string;
  /** One of the five release groups. */
  dlcLabel: (dlc: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Lang>(detect);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the session still switches.
    }
  }, []);

  // `lang` on the root drives font selection in CSS and screen-reader pronunciation.
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const table = UI[lang];
    return {
      lang,
      setLang,
      t: (key, params) => {
        const raw: string = table[key];
        if (!params) return raw;
        // An unmatched placeholder is left as-is rather than blanked, so a typo shows up instead of
        // silently dropping the value.
        return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
          name in params ? String(params[name]) : whole,
        );
      },
      g: (token, english) => localized(token, english, lang),
      fieldLabel: (english) =>
        lang === "zh" ? FIELD_LABELS_ZH[english] ?? english : english,
      fieldGroup: (english) =>
        lang === "zh" ? FIELD_GROUPS_ZH[english] ?? english : english,
      dlcLabel: (dlc) => (lang === "zh" ? DLC_LABELS_ZH[dlc] : DLC_LABELS_EN[dlc]) ?? dlc,
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside <LangProvider>");
  return ctx;
}
