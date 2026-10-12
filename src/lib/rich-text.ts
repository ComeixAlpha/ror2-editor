/**
 * Parser for the game's inline text markup.
 *
 * Deliberately free of imports: the colour table lives in generated JSON, and Node's ESM loader
 * refuses to import JSON from a `.ts` module, which would make this untestable. The caller injects
 * the lookup instead.
 *
 * The markup is TextMeshPro's: `<style=name>` ... `</style>` and `<color=...>` ... `</color>`, plus
 * tags the game uses for spacing and emphasis. Only colouring carries meaning in a description --
 * which numbers are damage, which are per-stack bonuses -- so that is what is kept.
 *
 * Styles nest, and the game's own files do nest them
 * (`<style=cIsDamage>15%<style=cStack>(+15% per stack)</style></style>`), so this keeps a stack
 * rather than assuming well-formed input.
 */

export interface TextRun {
  text: string;
  /** Undefined when the run is unstyled, so it inherits the surrounding colour. */
  color?: string;
}

/** The colour a named style resolves to, or undefined when the sheet does not define it. */
export type StyleLookup = (name: string) => string | undefined;

/** `<style=name>`, `</style>`, `<color=#rrggbb>`, `<color="orange">`, `<i>`, ... */
const TAG = /<(\/?)([a-zA-Z]+)(?:=([^>]*))?\/?>/g;

/** `#rrggbb`, `#rrggbbaa` or a plain CSS colour name, with any quotes stripped. */
function normaliseColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().replace(/^["']|["']$/g, "");
  if (!value) return undefined;
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^[a-z]+$/i.test(value) ? value : undefined;
}

export function parseRichText(input: string, lookup: StyleLookup): TextRun[] {
  const runs: TextRun[] = [];
  const stack: Array<string | undefined> = [];
  let buffer = "";
  let cursor = 0;

  const flush = (): void => {
    if (!buffer) return;
    runs.push({
      text: buffer,
      color: stack.length > 0 ? stack[stack.length - 1] : undefined,
    });
    buffer = "";
  };

  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(input)) !== null) {
    buffer += input.slice(cursor, match.index);
    cursor = match.index + match[0].length;

    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const value = match[3];

    if (name === "style" || name === "color") {
      // Close the run first, so text before the tag keeps the colour it had.
      flush();
      if (closing) {
        stack.pop();
      } else {
        stack.push(name === "style" ? lookup(value ?? "") : normaliseColor(value));
      }
      continue;
    }
    // Anything else -- `<i>`, `<b>`, `<mspace=1em>`, `<nobr>`, `<size=80%>` -- is dropped.
  }

  buffer += input.slice(cursor);
  flush();
  return runs;
}

/** True when any run resolved to a colour, i.e. the markup was more than decoration. */
export function hasStyledRuns(runs: TextRun[]): boolean {
  return runs.some((run) => run.color !== undefined);
}
