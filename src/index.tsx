import React from "react";

import { createRoot } from "react-dom/client";
import Controller from "./components/controller";
import Info from "./components/info";
import { LangProvider } from "./i18n";

import "./styles.css";

function App(): React.JSX.Element {
  return (
    <React.StrictMode>
      <LangProvider>
        <div
          style={{
            height: "100%",
            display: "grid",
            gridTemplateRows: "1fr min-content",
          }}
        >
          <Controller />
          <Info />
        </div>
      </LangProvider>
    </React.StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
