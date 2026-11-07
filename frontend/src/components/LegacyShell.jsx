import { useEffect } from "react";
import shellHtml from "../legacy/shell.html?raw";      // your original nav, page container, modals
import uiScript from "../legacy/ui.js?raw";            // your original views (data arrays now empty)
import overrides from "../legacy/overrides.js?raw";    // API-backed loading + actions
import * as api from "../services/apiService.js";
import { logout } from "../services/apiService.js";

// PHASE 2 BRIDGE: mounts the original BloomDerma markup unchanged, then runs the
// original view code against data loaded from Spring Boot. Pages are converted
// to JSX one at a time in later steps; the look never changes.
function runScript(source) {
  const el = document.createElement("script");
  el.textContent = source;
  document.body.appendChild(el);
}

export default function LegacyShell() {
  useEffect(() => {
    window.BloomApi = window.BloomApi || api;   // the legacy scripts read this global on start
    runScript(uiScript); runScript(overrides);
  }, []);
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: shellHtml }} />
      <button className="btn" onClick={logout}
        style={{ position: "fixed", left: 12, bottom: 12, fontSize: 12, opacity: .7, zIndex: 5 }}>
        Sign out
      </button>
    </>
  );
}
