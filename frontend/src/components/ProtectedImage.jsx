import { useEffect, useState } from "react";
import { fetchBlob } from "../services/apiService.js";
import { openProtectedFile } from "../services/apiService.js";

// <img> for a protected URL: downloads it with the login token, then shows it. Click = full-size viewer.
export default function ProtectedImage({ url, alt = "", title = "Photo" }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true, objectUrl = null;
    setSrc(null); setFailed(false);
    fetchBlob(url).then((b) => { if (live) { objectUrl = URL.createObjectURL(b); setSrc(objectUrl); } }).catch(() => live && setFailed(true));
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (failed) return <div className="photo-missing">Photo unavailable</div>;
  if (!src) return <div className="photo-missing">Loading…</div>;
  return <img src={src} alt={alt} className="photo-img" onClick={() => openProtectedFile(url, title)} />;
}
