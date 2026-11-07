import { createRoot } from "react-dom/client";
import "./styles/bloomderma.css";   // your original CSS, unchanged
import App from "./App.jsx";
import { initTheme } from "./services/theme.js";

initTheme();   // restore light/dark choice before the first paint

createRoot(document.getElementById("root")).render(<App />);
