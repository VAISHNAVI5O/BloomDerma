import { useState } from "react";
import * as api from "./services/apiService.js";
import LoginGate from "./components/LoginGate.jsx";
import LegacyShell from "./components/LegacyShell.jsx";
import PatientPortal from "./components/PatientPortal.jsx";
import { openVideoCall } from "./services/videoCall.js";
import { toggleTheme } from "./services/theme.js";
import WelcomeAnimation from "./components/WelcomeAnimation.jsx";

// FIX: these globals are used by legacy/overrides.js, which LegacyShell runs inside ITS OWN effect. React runs child
// effects BEFORE parent effects, so setting them in an App useEffect left window.BloomApi undefined after a page
// refresh (F5 with a saved login) -> every API call threw -> "Doctors could not be loaded". Set them at module load.
window.BloomApi = api;
window.BloomVideo = openVideoCall;
window.toggleTheme = toggleTheme;

// Simple auth state: no token -> sign-in page (always the first page); token -> the app for that role.
export default function App() {
  const [token, setTokenState] = useState(api.getToken());
  const [welcome, setWelcome] = useState(false);       // skin-glow animation right after signing in
  if (!token) return <LoginGate onLogin={(t) => { window.location.hash = ""; setTokenState(t); setWelcome(true); }} />;
  // Patients get their own portal; staff and doctors get the clinic shell.
  return (
    <>
      {api.getCurrentUser()?.role === "PATIENT" ? <PatientPortal /> : <LegacyShell />}
      {welcome && <WelcomeAnimation name={api.getCurrentUser()?.username || ""} onDone={() => setWelcome(false)} />}
    </>
  );
}
