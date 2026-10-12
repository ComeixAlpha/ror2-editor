import React from "react";

import "./info.css";
import { useI18n } from "../i18n";

export default function Info(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <div className="info">
      {/* This fork, not upstream: the editor is a modified build, so the code here is what matches
          the behaviour on screen. */}
      <a href="https://github.com/ComeixAlpha/ror2-editor">{t("viewCode")}</a>
    </div>
  );
}
