import React from "react";
import { createRoot } from "react-dom/client";
import { ConnectedApp as App } from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.DEV && new URLSearchParams(location.search).get('__rea_layout') === '1') {
  import('./rea-layout-diagnostics.mjs').then(({startLayoutDiagnostics}) => {
    const stop = startLayoutDiagnostics();
    if (import.meta.hot) import.meta.hot.dispose(stop);
  });
}
