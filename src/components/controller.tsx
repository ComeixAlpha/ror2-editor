import React, { useCallback, useState } from "react";
import Editor from "./editor";
import LangSwitch from "./lang-switch";
import SaveExport from "./save-export";
import SaveImport from "./save-import";
import { useI18n } from "../i18n";

export default function Controller(): React.JSX.Element {
  const { t } = useI18n();
  const [filename, setFilename] = useState<string>("");
  const [save, setSave] =
    useState<ReturnType<typeof import("../lib/save").loadSave>>();
  // The save document is mutated in place, so React needs an explicit signal to re-render.
  const [revision, setRevision] = useState(0);

  const onChanged = useCallback(() => setRevision((r) => r + 1), []);

  return (
    <div className="container">
      {save ? (
        // The title, the import/export controls and the intro text all belong to the left
        // column, so they are handed to the editor as a header rather than wrapping the layout.
        <Editor
          save={save}
          revision={revision}
          onChanged={onChanged}
          header={({ blockedBy, onBlockedClick }) => (
            <>
              <h1>{t("title")}</h1>
              <p className="intro">
                {t("importBlurb")}
                <br />
                {t("importBackup")} {t("importPathLead")}{" "}
                <span className="path">
                  C:\Program
                  Files(x86)\Steam\userdata\[Number]\632360\remote\UserProfiles
                </span>
                <br />
                {/* The fork relationship, stated right beside the work-in-progress notice, so
                    anyone running this build knows what they have and where it came from. */}
                {t("forkNote")}{" "}
                <a
                  className="link"
                  href="https://github.com/tjosepo/ror2-editor"
                  target="_blank"
                  rel="noreferrer"
                >
                  tjosepo/ror2-editor
                </a>
                <br />
                {t("forkAdds")}
              </p>
              <div className="actions">
                <SaveExport
                  filename={filename}
                  savedata={save}
                  blockedBy={blockedBy}
                  onBlockedClick={onBlockedClick}
                />
                <button
                  className="link"
                  onClick={() => {
                    // Dropping back to the import screen lets the user open a different profile
                    // without reloading the page.
                    setSave(undefined);
                    setFilename("");
                  }}
                >
                  {t("openDifferent")}
                </button>
              </div>
              {/* Under the file actions: they are what a visitor reaches for first, and the
                  language belongs beside them rather than on the title row. */}
              <LangSwitch />
            </>
          )}
        />
      ) : (
        <div className="import-screen">
          <h1>{t("importTitle")}</h1>
          <p>
            {t("importBlurb")}
            <br />
            {t("importBackup")}
          </p>
          {/* Same note as the editor header: stated next to the work-in-progress warning. */}
          <p>
            {t("forkNote")}{" "}
            <a
              className="link"
              href="https://github.com/tjosepo/ror2-editor"
              target="_blank"
              rel="noreferrer"
            >
              tjosepo/ror2-editor
            </a>
            <br />
            {t("forkAdds")}
          </p>
          <p>
            {t("importPathLead")}{" "}
            <span className="path">
              C:\Program
              Files(x86)\Steam\userdata\[Number]\632360\remote\UserProfiles
            </span>
          </p>
          <SaveImport
            style={{ width: "100%", marginBottom: "1rem" }}
            onFilenameChange={setFilename}
            onSavedataChange={setSave}
          >
            {/* Handed in rather than placed after `<SaveImport>`, so it lands between the import
                button and the sample-save line instead of below both. */}
            <LangSwitch />
          </SaveImport>
        </div>
      )}
    </div>
  );
}
