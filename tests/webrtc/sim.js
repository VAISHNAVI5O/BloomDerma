const { JSDOM } = require("jsdom");
const FakeTimers = require("@sinonjs/fake-timers");
const fs = require("fs");
const BUNDLE = fs.readFileSync(process.env.BUNDLE || "bundle.js", "utf8");

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

let DISC = 5000;
async function trial(scenario, seed, latRange) {
  const rand = rng(seed);
  const clock = FakeTimers.install({ now: 1e6, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  const lat = () => latRange[0] + rand() * (latRange[1] - latRange[0]);
  // ---- relay: same semantics as VideoService (global seq, per-room list, own signals filtered, join cursor = current seq) ----
  const rooms = new Map(); let seq = 0;
  const hop = (f) => new Promise((res) => setTimeout(() => { const v = f(); setTimeout(() => res(v), lat()); }, lat()));
  const relay = {
    join: (id, who) => hop(() => ({ role: who, cursor: seq })),
    signal: (id, who, type, payload) => hop(() => { if (!rooms.has(id)) rooms.set(id, []); rooms.get(id).push({ id: ++seq, from: who, type, payload }); }),
    poll: (id, since, who) => hop(() => { const room = rooms.get(id) || []; let cursor = since; const out = []; for (const s of room) { cursor = Math.max(cursor, s.id); if (s.id > since && s.from !== who) out.push(s); } return { cursor, signals: out }; }),
  };
  const current = {}; const stats = { addedTo: { doctor: 0, patient: 0 }, remoteSet: { doctor: false, patient: false }, hostEmitted: { doctor: 0, patient: 0 }, hostDelivered: { doctor: 0, patient: 0 }, connectedAt: { doctor: null, patient: null }, offers: 0, pcs: [] };
  const t0 = Date.now();

  function makeWindow(who) {
    const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", pretendToBeVisual: false });
    const w = dom.window;
    for (const k of ["setTimeout", "clearTimeout", "setInterval", "clearInterval"]) w[k] = globalThis[k];
    w.Date = Date;
    w.__who = who; w.__relay = relay;
    const stream = { getTracks: () => [{ stop() {} }], getAudioTracks: () => [{ enabled: true }], getVideoTracks: () => [{ enabled: true }] };
    Object.defineProperty(w.navigator, "mediaDevices", { value: { getUserMedia: async () => stream } });
    w.RTCPeerConnection = class {
      constructor() { this.connectionState = "new"; this.local = null; this.remote = null; this.added = 0; this.closed = false; stats.pcs.push(who); current[who] = this; }
      addTrack() {}
      async createOffer() { return { type: "offer", sdp: "o" }; }
      async createAnswer() { return { type: "answer", sdp: "a" }; }
      async setLocalDescription(d) {
        this.local = d; this.localDescription = d;
        const emit = (kind) => setTimeout(() => { if (kind === "host") stats.hostEmitted[who]++; if (!this.closed && this.onicecandidate) this.onicecandidate({ candidate: { kind, from: who } }); }, kind === "host" ? 2 : 40 + rand() * 80);
        emit("host"); emit("host"); emit("srflx");
        this.maybe();
      }
      async setRemoteDescription(d) { stats.remoteSet[who] = true; this.remote = d; this.remoteDescription = d; this.maybe(); }
      async addIceCandidate(c) { if (!this.remote) throw new Error("InvalidStateError"); this.added++; stats.addedTo[who]++; if (c.kind === "host") stats.hostDelivered[who]++; this.maybe(); }
      maybe() { if (this.connectionState !== "connected" && this.local && this.remote && this.added > 0) { this.connectionState = "connected"; if (stats.connectedAt[who] === null) stats.connectedAt[who] = Date.now() - t0; this.ontrack && this.ontrack({ streams: [{}] }); this.onconnectionstatechange && this.onconnectionstatechange(); } }
      close() { this.closed = true; this.connectionState = "closed"; const other = current[who === 'doctor' ? 'patient' : 'doctor']; if (other && DISC !== null) setTimeout(() => { if (!other.closed && other.connectionState === 'connected') { other.connectionState = 'disconnected'; other.onconnectionstatechange && other.onconnectionstatechange(); } }, DISC); }
    };
    w.eval(BUNDLE);
    return w;
  }
  const P = makeWindow("patient"), D = makeWindow("doctor");
  const openP = () => P.VC.openVideoCall(1, "t"), openD = () => D.VC.openVideoCall(1, "t");
  const run = async (ms) => { await clock.tickAsync(ms); };

  if (scenario === "patient-first-doctor+5s") { openP(); await run(5000); openD(); }
  else if (scenario === "doctor-first-patient+5s") { openD(); await run(5000); openP(); }
  else if (scenario === "both-at-once") { openP(); openD(); }
  else if (scenario === "doctor-joins-40s-late") { openP(); await run(40000); openD(); }
  else if (scenario === "rejoin-after-leave") {
    openP(); await run(1000); openD(); await run(20000);
    const firstOK = stats.connectedAt.patient !== null && stats.connectedAt.doctor !== null;
    stats.connectedAt = { doctor: null, patient: null }; stats.offers = 0;
    P.document.querySelector("#bvEnd").click(); await run(3000);     // patient leaves, comes back 3 s later
    stats.hostEmitted = { doctor: 0, patient: 0 }; stats.hostDelivered = { doctor: 0, patient: 0 };
    openP(); await run(30000);
    const ok = stats.connectedAt.patient !== null && stats.connectedAt.doctor !== null;
    const res = { ok: firstOK && ok, t: stats.connectedAt.patient, hostLostAtPatient: stats.hostEmitted.doctor - stats.hostDelivered.patient };
    clock.uninstall(); return res;
  }
  // measure
  const t1 = Date.now();
  await run(30000);
  const both = stats.connectedAt.patient !== null && stats.connectedAt.doctor !== null;
  const negotiated = stats.remoteSet.patient && stats.remoteSet.doctor;
  const cls = !negotiated ? "no-offer-answer" : (stats.addedTo.patient > 0 && stats.addedTo.doctor > 0) ? "A-both-got-candidates" : (stats.addedTo.patient > 0 || stats.addedTo.doctor > 0) ? "B-one-side-got-none" : "C-neither-got-any";
  const res = { cls, ok: both, t: both ? Math.max(stats.connectedAt.patient, stats.connectedAt.doctor) - (scenario.includes("5s") ? 5000 : scenario.includes("40s") ? 40000 : 0) : null,
    hostLostAtPatient: stats.hostEmitted.doctor - stats.hostDelivered.patient, hostLostAtDoctor: stats.hostEmitted.patient - stats.hostDelivered.doctor,
    allDoctorHostLost: stats.hostEmitted.doctor > 0 && stats.hostDelivered.patient === 0 };
  clock.uninstall();
  return res;
}

(async () => {
  const N = +process.argv[2] || 40;
  const nets = { "fast LAN-like (5-30 ms per hop)": [5, 30], "typical (20-120 ms)": [20, 120], "slow mobile (80-400 ms)": [80, 400] };
  const scenarios = ["patient-first-doctor+5s", "doctor-first-patient+5s", "both-at-once", "doctor-joins-40s-late"];
  for (const [nname, range] of Object.entries(nets)) {
    const agg = { "A-both-got-candidates": 0, "B-one-side-got-none": 0, "C-neither-got-any": 0, "no-offer-answer": 0 }; let total = 0, tsAll = [], lost = 0;
    for (const sc of scenarios) for (let i = 0; i < N; i++) {
      const r = await trial(sc, 1000 + i * 7919, range); agg[r.cls]++; total++; if (r.ok) tsAll.push(r.t); if (r.hostLostAtPatient > 0) lost++;
    }
    tsAll.sort((a, b) => a - b);
    console.log("\n== " + nname + " : " + total + " simulated calls (4 join orders x " + N + ") ==");
    console.log("  offer/answer exchanged in " + (total - agg["no-offer-answer"]) + "/" + total + " calls   (median " + (tsAll.length ? (tsAll[tsAll.length >> 1] / 1000).toFixed(1) : "-") + " s to first media in the clean cases)");
    console.log("  doctor's ICE candidates lost at the patient (arrived before the offer): " + lost + "/" + total + " calls");
    console.log("  candidate exchange: both sides got candidates " + agg["A-both-got-candidates"] + " | one side got none " + agg["B-one-side-got-none"] + " | neither side got any " + agg["C-neither-got-any"]);
  }
  for (const [label, d] of [["browser flips to 'disconnected' ~5 s after the other side leaves", 5000], ["browser keeps reporting 'connected' (worst case)", null]]) {
    DISC = d; let ok = 0, ts = [];
    for (let i = 0; i < N; i++) { const r = await trial("rejoin-after-leave", 5000 + i * 104729, [20, 120]); if (r.ok) { ok++; } }
    console.log("\n== patient leaves and rejoins 3 s later; " + label + " ==\n  call re-established within 30 s in " + ok + "/" + N + " runs");
  }
})();
