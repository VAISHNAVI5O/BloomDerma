// In-browser video call (WebRTC). The two browsers talk to each other directly;
// the Spring Boot backend only relays the small set-up messages (see VideoService).
// Used by the patient portal ("Join call") and by doctors (Appointments > "Join video call").
import * as api from "./apiService.js";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };   // public STUN: helps across different networks

export async function openVideoCall(appointmentId, title = "Video consultation") {
  if (document.getElementById("bloomVideoOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "bloomVideoOverlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:200;background:rgba(40,20,30,.94);display:flex;flex-direction:column;color:#fff;font-family:inherit";
  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px">
      <strong><i class="bi bi-camera-video"></i> ${title.replace(/</g, "&lt;")}</strong>
      <span id="bvStatus" style="opacity:.85">Starting…</span>
    </div>
    <div style="flex:1;position:relative;min-height:0">
      <video id="bvRemote" autoplay playsinline style="width:100%;height:100%;object-fit:contain;background:#1b1015"></video>
      <video id="bvLocal" autoplay muted playsinline style="position:absolute;right:16px;bottom:16px;width:180px;border-radius:12px;background:#000;border:2px solid #fff"></video>
    </div>
    <div style="display:flex;gap:12px;justify-content:center;padding:16px">
      <button class="btn btn-outline" id="bvMic" type="button"><i class="bi bi-mic"></i> Mute</button>
      <button class="btn btn-outline" id="bvCam" type="button"><i class="bi bi-camera-video"></i> Camera off</button>
      <button class="btn btn-danger" id="bvEnd" type="button"><i class="bi bi-telephone-x"></i> Leave call</button>
    </div>`;
  document.body.appendChild(overlay);
  const $ = (id) => overlay.querySelector("#" + id);
  const statusEl = $("bvStatus");
  const status = (t) => { statusEl.textContent = t; };

  let pc = null, localStream = null, cursor = 0, role = "", stopped = false, polling = false;
  let early = [];                                              // ICE candidates that arrived before the offer/answer (kept, not dropped)
  let remoteSet = false, pendingIce = [], readyTimer = null, pollTimer = null, lastOffer = 0;

  const send = (type, payload) => api.videoSignal(appointmentId, type, payload || "").catch(() => {});
  function cleanup() {
    stopped = true;
    clearInterval(readyTimer); clearInterval(pollTimer);
    if (pc) pc.close();
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }
  async function leave() { await send("bye"); cleanup(); }
  $("bvEnd").onclick = leave;
  $("bvMic").onclick = () => {
    const tracks = localStream ? localStream.getAudioTracks() : [];
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    $("bvMic").innerHTML = tracks[0] && !tracks[0].enabled ? '<i class="bi bi-mic-mute"></i> Unmute' : '<i class="bi bi-mic"></i> Mute';
  };
  $("bvCam").onclick = () => {
    const tracks = localStream ? localStream.getVideoTracks() : [];
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    $("bvCam").innerHTML = tracks[0] && !tracks[0].enabled ? '<i class="bi bi-camera-video-off"></i> Camera on' : '<i class="bi bi-camera-video"></i> Camera off';
  };
  const fail = (msg) => { status(msg); $("bvEnd").innerHTML = "Close"; $("bvEnd").onclick = cleanup; };

  // 1. camera + microphone (browsers only allow this on https:// or http://localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return fail("Video calls need https:// or http://localhost in the browser address.");
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e) {
    try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e2) { return fail("Camera / microphone is blocked or not available. Allow access and try again."); }
  }
  $("bvLocal").srcObject = localStream;

  // 2. join the consultation room
  try {
    const joined = await api.videoJoin(appointmentId);
    role = joined.role; cursor = joined.cursor;
  } catch (e) {
    localStream.getTracks().forEach((t) => t.stop());
    return fail(e.response?.data?.message || "Could not open the call.");
  }

  function newPeer() {
    if (pc) pc.close();
    pc = new RTCPeerConnection(ICE);
    remoteSet = false; pendingIce = [];
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.ontrack = (e) => { $("bvRemote").srcObject = e.streams[0]; status("Connected"); };
    pc.onicecandidate = (e) => { if (e.candidate) send("ice", JSON.stringify(e.candidate)); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") status("Connection failed — check the network and rejoin.");
      if (pc.connectionState === "disconnected") status("Connection lost…");
    };
  }
  async function flushIce() {
    remoteSet = true;
    const all = early.concat(pendingIce); early = []; pendingIce = [];
    for (const c of all) { try { await pc.addIceCandidate(c); } catch { /* ignore */ } }
  }
  function startReadyPing() {
    clearInterval(readyTimer);
    send("ready");
    readyTimer = setInterval(() => send("ready"), 2500);          // the patient keeps announcing until the doctor calls
  }

  async function handle(sig) {
    try {
      if (sig.type === "ready" && role === "doctor") {            // doctor = caller
        if (pc && (pc.connectionState === "connected" || Date.now() - lastOffer < 8000)) return;   // already calling / in call
        lastOffer = Date.now();
        newPeer();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send("offer", JSON.stringify(pc.localDescription));
        status("Calling…");
      } else if (sig.type === "ready" && role === "patient") {    // doctor (re)joined: announce again
        if (!pc || pc.connectionState !== "connected") startReadyPing();
      } else if (sig.type === "offer" && role === "patient") {
        clearInterval(readyTimer);
        newPeer();
        await pc.setRemoteDescription(JSON.parse(sig.payload));
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await send("answer", JSON.stringify(pc.localDescription));
      } else if (sig.type === "answer" && role === "doctor" && pc) {
        await pc.setRemoteDescription(JSON.parse(sig.payload));
        await flushIce();
      } else if (sig.type === "ice") {
        const cand = JSON.parse(sig.payload);
        if (pc && remoteSet) await pc.addIceCandidate(cand); else early.push(cand);
      } else if (sig.type === "bye") {
        status("The other person left the call.");
        $("bvRemote").srcObject = null;
        if (pc) { pc.close(); pc = null; }                       // do not wait for the browser to notice: the next 'ready' starts a fresh call
        remoteSet = false; pendingIce = []; early = []; lastOffer = 0;
        if (role === "patient") startReadyPing();
      }
    } catch (e) { /* a stale or duplicate message - ignore */ }
  }

  // 3. poll for the other person's set-up messages
  pollTimer = setInterval(async () => {
    if (polling || stopped) return;
    polling = true;
    try {
      const res = await api.videoPoll(appointmentId, cursor);
      cursor = res.cursor;
      for (const s of res.signals) await handle(s);
    } catch (e) {
      if (e.response?.status === 400 || e.response?.status === 403) fail(e.response?.data?.message || "Call closed.");
    } finally { polling = false; }
  }, 1000);

  status(role === "doctor" ? "Waiting for the patient to join…" : "Waiting for the doctor…");
  if (role === "patient") startReadyPing(); else send("ready");
}
