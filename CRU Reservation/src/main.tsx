// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { attachAuthLogger, attachStorageFetchLogger, logSession } from "./lib/supaDebug";

if (import.meta.env.DEV) {
  attachAuthLogger();
  attachStorageFetchLogger();
  logSession("boot");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
