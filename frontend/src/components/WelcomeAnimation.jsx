import { useEffect, useState } from "react";

// Shown for a few seconds right after anyone signs in. A cute little face gets its "skin glow" moment:
// water drops fall, sparkles pop, cheeks blush and a petal-flower blooms. Colours come from CSS and follow
// light / dark mode (<html data-theme>), so it is a sunny pastel morning by day and a starry, moonlit spa at night.
const SHOW_MS = 3600;

export default function WelcomeAnimation({ name, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setLeaving(true), reduce ? 1400 : SHOW_MS);
    const t2 = setTimeout(onDone, (reduce ? 1400 : SHOW_MS) + 500);
    const key = (e) => { if (e.key === "Escape" || e.key === "Enter") skip(); };
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { setLeaving(true); setTimeout(onDone, 350); };

  const stars = [[8, 14, 0], [22, 8, .6], [78, 12, .3], [90, 26, .9], [14, 40, 1.2], [86, 48, .2], [30, 22, 1.5], [68, 6, .8]];
  const sparkles = [[22, 30, 1.1], [78, 28, 1.4], [16, 58, 1.7], [84, 62, 1.25], [50, 10, 1.55], [34, 78, 1.9], [68, 80, 1.8]];

  return (
    <div className={"welcome" + (leaving ? " welcome-out" : "")} role="status" aria-live="polite" onClick={skip}>
      <div className="welcome-sky" aria-hidden="true">
        {stars.map(([x, y, d], i) => <i key={"s" + i} className="w-star" style={{ left: x + "%", top: y + "%", animationDelay: d + "s" }} />)}
        <div className="w-sun" /><div className="w-moon" />
      </div>

      <div className="welcome-card">
        <div className="face-wrap">
          {sparkles.map(([x, y, d], i) => (
            <svg key={i} className="w-sparkle" viewBox="0 0 24 24" style={{ left: x + "%", top: y + "%", animationDelay: d + "s" }} aria-hidden="true">
              <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" />
            </svg>
          ))}

          <svg className="face" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <radialGradient id="wSkin" cx="50%" cy="40%" r="65%">
                <stop offset="0%" className="skin-a" /><stop offset="100%" className="skin-b" />
              </radialGradient>
            </defs>
            {/* flower on the head: BloomDerma's bloom */}
            <g className="w-flower" transform="translate(142 34)">
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} className="petal" cx="0" cy="-11" rx="6.5" ry="10" transform={`rotate(${r})`} />)}
              <circle className="flower-eye" r="5.5" />
            </g>
            <circle className="face-glow" cx="100" cy="108" r="86" />
            <circle className="face-skin" cx="100" cy="108" r="74" fill="url(#wSkin)" />
            {/* shine */}
            <path className="face-shine" d="M54 84 Q62 62 86 56" fill="none" strokeWidth="7" strokeLinecap="round" />
            {/* blush */}
            <ellipse className="blush" cx="64" cy="124" rx="13" ry="8" />
            <ellipse className="blush" cx="136" cy="124" rx="13" ry="8" />
            {/* happy closed eyes (blink) */}
            <g className="eyes">
              <path className="eye" d="M70 106 Q80 94 90 106" fill="none" strokeWidth="5" strokeLinecap="round" />
              <path className="eye" d="M110 106 Q120 94 130 106" fill="none" strokeWidth="5" strokeLinecap="round" />
            </g>
            {/* smile */}
            <path className="mouth" d="M86 132 Q100 148 114 132" fill="none" strokeWidth="5" strokeLinecap="round" />
          </svg>

          {/* water / serum drops falling onto the cheeks */}
          <i className="w-drop d1" /><i className="w-drop d2" /><i className="w-drop d3" />
        </div>

        <h2 className="welcome-title">Welcome, <span translate="no">{name}</span></h2>
        <p className="welcome-sub">Getting your glow ready…</p>
        <div className="welcome-bar"><span /></div>
        <small className="welcome-skip">Tap to skip</small>
      </div>
    </div>
  );
}
