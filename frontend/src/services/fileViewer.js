// In-page viewer for protected files (PDF / images). Used by the patient portal and the clinic screens.
import { fetchBlob } from "./apiService.js";

export async function openFileViewer(url, title = "File") {
  if (document.getElementById("bloomFileViewer")) return;
  const overlay = document.createElement("div");
  overlay.id = "bloomFileViewer";
  overlay.style.cssText = "position:fixed;inset:0;z-index:250;background:rgba(20,10,35,.92);display:flex;flex-direction:column;color:#fff;font-family:inherit";
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px">
      <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</strong>
      <span style="display:flex;gap:10px;flex:none">
        <a id="bfvDownload" class="btn btn-outline" style="display:none;text-decoration:none">Download</a>
        <a id="bfvNewTab" class="btn btn-outline" target="_blank" rel="noopener" style="display:none;text-decoration:none">Open in new tab</a>
        <button id="bfvClose" class="btn btn-rose" type="button">Close</button>
      </span>
    </div>
    <div id="bfvBody" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 18px 18px">Loading…</div>`;
  document.body.appendChild(overlay);

  let objectUrl = null;
  const close = () => { document.removeEventListener("keydown", onKey); if (objectUrl) URL.revokeObjectURL(objectUrl); overlay.remove(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  overlay.querySelector("#bfvClose").onclick = close;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const body = overlay.querySelector("#bfvBody");
  try {
    const blob = await fetchBlob(url);
    objectUrl = URL.createObjectURL(blob);
    const dl = overlay.querySelector("#bfvDownload");
    dl.href = objectUrl; dl.download = String(title).replace(/[^\w.\- ]+/g, "_") + (blob.type === "application/pdf" ? ".pdf" : "");
    dl.style.display = "";
    const tab = overlay.querySelector("#bfvNewTab");
    tab.href = objectUrl; tab.style.display = "";
    if (blob.type.startsWith("image/")) {
      body.innerHTML = `<img src="${objectUrl}" alt="" style="max-width:100%;max-height:100%;border-radius:10px;background:#fff">`;
    } else if (blob.type === "application/pdf") {
      body.innerHTML = `<iframe src="${objectUrl}" title="${esc(title)}" style="width:100%;height:100%;border:0;border-radius:10px;background:#fff"></iframe>`;
    } else {
      body.textContent = "This file type cannot be previewed - use Download.";
    }
  } catch (e) {
    // with responseType "blob" the server's JSON error arrives as a Blob - read its message so the real reason is shown
    let msg = "The file could not be loaded.";
    try {
      const blob = e.response && e.response.data;
      if (blob && typeof blob.text === "function") msg = JSON.parse(await blob.text()).message || msg;
      else if (e.response && e.response.status === 404) msg = "The file could not be found on the server.";
      else if (!e.response) msg = "Could not reach the server - is the backend running?";
    } catch { /* keep the generic message */ }
    body.textContent = msg + (e.response ? "  (error " + e.response.status + ")" : "");
  }
}
