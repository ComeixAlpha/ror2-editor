import React from "react";
import { saveAs } from "file-saver";
import Button from "./button";
import { SaveData } from "../lib/save";
import { useI18n } from "../i18n";

interface Props {
  filename: string;
  savedata: SaveData;
  style?: React.CSSProperties;
  /** Why exporting is blocked, or undefined when it is allowed. */
  blockedBy?: string;
  /** Called when the user clicks while blocked, so the reasons can be revealed. */
  onBlockedClick?: () => void;
}

export default function SaveExport({
  filename,
  savedata,
  style,
  blockedBy,
  onBlockedClick,
}: Props): React.JSX.Element {
  const { t } = useI18n();

  const handleExport = (): void => {
    if (blockedBy) {
      onBlockedClick?.();
      return;
    }
    // Only the lists the editor manages are rewritten; everything else in the profile is
    // re-emitted exactly as it was read.
    const xml = savedata.toXml();
    const savefile = new Blob([xml], { type: "text/xml;charset=utf-8" });
    saveAs(savefile, filename || "UserProfile.xml");
  };

  return (
    <Button
      style={style}
      onClick={handleExport}
      title={
        blockedBy
          ? `${t("exportBlockedTitle")} ${blockedBy}`
          : t("exportReadyTitle")
      }
    >
      {blockedBy ? t("exportBlocked") : t("exportSave")}
    </Button>
  );
}
