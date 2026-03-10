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

import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" reverseOrder={false} />
  </React.StrictMode>
);
