import React, { useRef, useState } from "react";
import Button from "./button";
import sample from "../sample-save";
import { loadSave, SaveData } from "../lib/save";
import { useI18n } from "../i18n";

interface Props {
  onFilenameChange: React.Dispatch<string>;
  onSavedataChange: React.Dispatch<SaveData>;
  style?: React.CSSProperties;
  /**
   * Rendered between the import button and the sample-save line.
   *
   * The language switch goes here so it lands directly under the button, with the sample link
   * below it, without this component needing to know what it is.
   */
  children?: React.ReactNode;
}

export default function SaveImport({
  onFilenameChange,
  onSavedataChange,
  style,
  children,
}: Props): React.JSX.Element {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  const load = (xml: string, filename: string): void => {
    try {
      const save = loadSave(xml);
      setError(undefined);
      onFilenameChange(filename);
      onSavedataChange(save);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleInputFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const files = event.target.files;
    if (files === null || files.length === 0) return;
    const savefile = files[0];

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      load(reader.result as string, savefile.name);
    });
    reader.addEventListener("error", () => setError(t("readFailed")));
    reader.readAsText(savefile);
  };

  const handleClick = (): void => {
    (inputRef.current as HTMLInputElement).click();
  };

  return (
    <>
      <input
        hidden
        aria-hidden
        type="file"
        accept="text/xml,.xml"
        onChange={handleInputFileChange}
        ref={inputRef}
      />
      <Button style={style} onClick={handleClick}>
        {t("importAction")}
      </Button>
      {children}
      <div className="sample-row">
        <button className="link" onClick={() => load(sample, "sample.xml")}>
          {t("importSample")}
        </button>
      </div>
      {error ? (
        <p className="import-error">
          {t("notAProfile")} {error}
        </p>
      ) : null}
    </>
  );
}
