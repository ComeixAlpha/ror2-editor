/**
 * Renders the game's inline text markup as React.
 *
 * The parsing lives in `lib/rich-text.ts` so it can be unit-tested; this is the thin React layer
 * that supplies the game's colour table and turns the runs into spans.
 */
import React, { useMemo } from "react";
import { parseRichText } from "../lib/rich-text";
import { styleColor } from "../data/text-styles";

export default function RichText({ text }: { text: string }): React.JSX.Element {
  const runs = useMemo(() => parseRichText(text, styleColor), [text]);
  return (
    <>
      {runs.map((run, i) =>
        run.color ? (
          <span key={i} style={{ color: run.color }}>
            {run.text}
          </span>
        ) : (
          <React.Fragment key={i}>{run.text}</React.Fragment>
        ),
      )}
    </>
  );
}
