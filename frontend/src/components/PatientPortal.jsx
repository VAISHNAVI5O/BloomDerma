import { useCallback, useEffect, useState } from "react";
import * as api from "../services/apiService.js";
import { openVideoCall } from "../services/videoCall.js";
import ThemeToggle from "./ThemeToggle.jsx";
import ProtectedImage from "./ProtectedImage.jsx";

// Patient dashboard. Same top bar, panels, tables and badges as the clinic screens (bloomderma.css).
const CONCERNS = ["Acne", "Acne Scars", "Eczema", "Pigmentation", "Melasma", "Dry Skin", "Hair Fall",
  "Dandruff", "Scalp Problem", "Fine Lines", "Other Skin Concern"];
const TABS = [
  ["home", "Home"], ["book", "Book"], ["video", "Video Consult"], ["reports", "My Reports"],
  ["photos", "Before & After"], ["bills", "My Bills"], ["recovery", "My Recovery"], ["reviews", "Reviews"],
];
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const todayStr = () => new Date().toLocaleDateString("en-CA");           // YYYY-MM-DD in local time
const errText = (e) => e.response?.data?.message || "Something went wrong — is the backend running?";
const prettyDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function PayBadge({ state }) {
  const cls = state === "Paid" ? "badge-success" : state === "Partial" ? "badge-warning" : "badge-danger";
  return <span className={`badge ${cls}`}>{state}</span>;
}
function Stat({ icon, color, label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color }}><i className={`bi ${icon}`} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}
function Panel({ icon, title, right, children }) {
  return (
    <div className="panel" style={{ marginBottom: 22 }}>
      <div className="panel-head"><h2><i className={`bi ${icon}`} /> {title}</h2>{right}</div>
      {children}
    </div>
  );
}

/* ---------- online payment (video consultation) ---------- */
const BANKS = ["SBI", "HDFC", "ICICI", "Axis", "Kotak", "Bank of Baroda", "PNB", "Other"];
function PaymentModal({ appt, onClose, onPaid, toast }) {
  const [method, setMethod] = useState("UPI");
  const [f, setF] = useState({ upiId: "", cardNumber: "", cardName: "", expiry: "", cvv: "", bank: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cardFmt = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const expFmt = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; };

  async function pay(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.portalPay(appt.id, { method, ...f });
      setDone(r);
      await onPaid();
    } catch (err) { toast(errText(err)); }
    setBusy(false);
  }

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2><i className="bi bi-credit-card" /> {done ? "Payment successful" : "Pay for video consultation"}</h2>
          <button className="modal-close" type="button" onClick={onClose} disabled={busy}><i className="bi bi-x-lg" /></button>
        </div>
        {done ? (
          <div className="modal-body" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", color: "#2e9e6b" }}><i className="bi bi-check-circle-fill" /></div>
            <h3 style={{ margin: "6px 0" }}>{money(done.amountPaid)} paid</h3>
            <p style={{ margin: "4px 0" }}>Your video consultation with <strong>{appt.doctorName}</strong> on {prettyDate(done.date)} at {done.time} is confirmed.</p>
            <p style={{ margin: "4px 0", fontSize: ".85rem" }}>Transaction ID: <strong>{done.paymentRef}</strong><br />Paid via {done.paymentMethod}</p>
            <p style={{ fontSize: ".85rem" }}>You can join the call from the “Video Consult” tab on the day of the consultation.</p>
            <button className="btn btn-rose" type="button" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={pay}>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                {appt.code} · Video consultation with <strong>{appt.doctorName}</strong><br />
                {prettyDate(appt.date)} at {appt.time} · Amount to pay: <strong>{money(appt.due)}</strong>
              </div>
              <div className="field"><label>Payment method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="UPI">UPI</option><option value="CARD">Debit / Credit card</option><option value="NETBANKING">Net banking</option>
                </select></div>
              {method === "UPI" && (
                <div className="field"><label>UPI ID</label>
                  <input value={f.upiId} onChange={set("upiId")} placeholder="name@okbank" required autoComplete="off" /></div>
              )}
              {method === "CARD" && (
                <div className="form-grid">
                  <div className="field full"><label>Card number</label>
                    <input value={f.cardNumber} onChange={(e) => setF({ ...f, cardNumber: cardFmt(e.target.value) })}
                           inputMode="numeric" placeholder="1234 5678 9012 3456" required autoComplete="off" /></div>
                  <div className="field full"><label>Name on card</label>
                    <input value={f.cardName} onChange={set("cardName")} required autoComplete="off" /></div>
                  <div className="field"><label>Expiry (MM/YY)</label>
                    <input value={f.expiry} onChange={(e) => setF({ ...f, expiry: expFmt(e.target.value) })} placeholder="MM/YY" required autoComplete="off" /></div>
                  <div className="field"><label>CVV</label>
                    <input type="password" value={f.cvv} onChange={(e) => setF({ ...f, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                           inputMode="numeric" placeholder="•••" required autoComplete="off" /></div>
                </div>
              )}
              {method === "NETBANKING" && (
                <div className="field"><label>Select bank</label>
                  <select value={f.bank} onChange={set("bank")} required>
                    <option value="">Choose your bank</option>{BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select></div>
              )}
              <small style={{ display: "block", marginTop: 10 }}><i className="bi bi-shield-lock" /> Card details are checked and never stored. The amount is fixed by the clinic.</small>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={onClose} disabled={busy}>Pay later</button>
              <button className="btn btn-rose" type="submit" disabled={busy}><i className="bi bi-lock" /> {busy ? "Processing…" : `Pay ${money(appt.due)}`}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- appointment list (clinic + video) ---------- */
function AppointmentList({ items, onCancel, onChanged, onPay, filterVideo }) {
  const rows = items.filter((a) => (filterVideo === undefined ? true : (a.mode === "VIDEO") === filterVideo));
  if (!rows.length) return <div className="empty">Nothing booked yet.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Date</th><th>Time</th><th>Doctor</th><th>Type</th><th>Fee</th><th>Payment</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((a) => {
            const isToday = a.date === todayStr();
            const joinable = canJoinVideo(a);
            const open = a.status !== "Cancelled" && a.status !== "Completed";
            return (
              <tr key={a.id}>
                <td>{a.code}</td><td>{prettyDate(a.date)}</td><td>{a.time || "—"}</td>
                <td>{a.doctorName}</td>
                <td>{a.mode === "VIDEO" ? <span className="badge badge-blue">Video</span> : a.treatment}</td>
                <td>{money(a.fee)}</td>
                <td><PayBadge state={a.due === 0 ? "Paid" : a.amountPaid > 0 ? "Partial" : "Due"} />
                  {a.due > 0 && a.amountPaid > 0 && <div style={{ fontSize: ".7rem" }}>{money(a.due)} due</div>}</td>
                <td>{a.status}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {a.mode === "VIDEO" && open && a.due > 0 && onPay && (
                    <button className="btn btn-rose btn-sm" onClick={() => onPay(a)}>
                      <i className="bi bi-credit-card" /> Pay {money(a.due)}
                    </button>
                  )}{" "}
                  {a.mode === "VIDEO" && open && a.due === 0 && !joinExpired(a) && (
                    <button className="btn btn-rose btn-sm" disabled={!joinable}
                            title={joinable ? "Join the video call" : isToday ? "Joining closed 1 hour after the consultation time" : "Opens on the day of the consultation"}
                            onClick={() => openVideoCall(a.id, "Video consultation with " + a.doctorName)}>
                      <i className="bi bi-camera-video" /> Join call
                    </button>
                  )}{" "}
                  {open && a.amountPaid === 0 && canPatientCancel(a) && (
                    <button className="btn btn-danger btn-sm" onClick={() => onCancel(a.id)}>Cancel</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* A time slot of today that has already passed cannot be booked (the server enforces this too). */
function slotPassed(date, slot, now = new Date()) {
  const start = startOf({ date, time: slot });
  return !!start && start <= now;
}

/* ---------- revisit notices: the doctor suggests a follow-up, the patient decides ---------- */
function RevisitNotices({ items, onBook, onDismiss }) {
  const [perm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  useEffect(() => {                                     // one desktop notification per suggestion (only while the portal is open)
    if (perm !== "granted") return;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("bd-revisit-notified") || "{}"); } catch { /* ignore */ }
    items.forEach((r) => {
      if (seen[r.id]) return;
      seen[r.id] = 1;
      new Notification("Revisit suggested", { body: `${r.doctorName} suggests a follow-up visit around ${prettyDate(r.date)}. Booking is up to you.` });
    });
    try { localStorage.setItem("bd-revisit-notified", JSON.stringify(seen)); } catch { /* ignore */ }
  }, [items, perm]);

  if (!items.length) return null;
  const today = new Date(todayStr() + "T00:00:00");
  return (
    <div className="reminders">
      {items.map((r) => {
        const days = Math.round((new Date(r.date + "T00:00:00") - today) / 86400000);
        const when = days > 1 ? `in about ${days} days` : days === 1 ? "tomorrow" : days === 0 ? "today" : "whenever you are ready";
        return (
          <div key={r.id} className="reminder">
            <div className="reminder-icon"><i className="bi bi-arrow-repeat" /></div>
            <div className="reminder-text">
              <strong>{`${r.doctorName} suggests a follow-up visit around ${prettyDate(r.date)} (${when})`}</strong>
              <span>{r.note ? `“${r.note}” · ` : ""}This is only a suggestion - you can book a visit now, later, or not at all.</span>
            </div>
            <button className="btn btn-rose btn-sm" onClick={() => onBook(r)}><i className="bi bi-calendar-plus" /> Book a visit</button>
            <button className="btn btn-outline btn-sm" onClick={() => onDismiss(r.id)} title="I do not want to book this now">Not now</button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- booking form (clinic visit or video consultation) ---------- */
function BookingForm({ video, doctors, services, fees, onBooked, toast, prefill }) {
  const [concern, setConcern] = useState("");
  const [treatment, setTreatment] = useState("");
  const [doctorId, setDoctorId] = useState(prefill?.doctorId || "");          // set when booking from a revisit notice
  const [date, setDate] = useState(prefill?.date && prefill.date > todayStr() ? prefill.date : todayStr());
  const [time, setTime] = useState("");
  const [suggest, setSuggest] = useState(null);
  const [booked, setBooked] = useState([]);
  const [busy, setBusy] = useState(false);

  // doctors suggested from the stored speciality (done by the backend)
  useEffect(() => {
    if (!concern && !(treatment && !video)) { setSuggest(null); return; }
    let live = true;
    api.fetchDoctorSuggestions(concern, video ? "" : treatment)
      .then((r) => { if (live) { setSuggest(r); if (!r.doctors.some((d) => d.id === doctorId)) { setDoctorId(""); setTime(""); } } })
      .catch(() => {});
    return () => { live = false; };
  }, [concern, treatment, video]);

  useEffect(() => {
    if (!doctorId || !date) { setBooked([]); return; }
    api.portalAvailability(doctorId, date).then(setBooked).catch(() => setBooked([]));
  }, [doctorId, date]);

  const list = suggest ? suggest.doctors.map((s) => doctors.find((d) => d.id === s.id)).filter(Boolean) : doctors;
  const doctor = doctors.find((d) => d.id === doctorId);
  const svc = services.find((x) => x.name === treatment);
  const fee = doctor ? (video ? doctor.videoFee : (svc && svc.price) || fees.inClinic) : null;

  async function submit(e) {
    e.preventDefault();
    if (!doctor || !time) { toast("Please choose a doctor and a time slot."); return; }
    setBusy(true);
    try {
      const created = await api.portalBook({ doctorId, concern, treatment: video ? "" : treatment, date, time, video });
      const needsPay = video && created.due > 0;               // a Rs.0 video fee is confirmed straight away
      toast(needsPay ? "Video consultation booked — please complete the payment." : video ? "Video consultation booked and confirmed." : "Appointment booked.");
      setConcern(""); setTreatment(""); setDoctorId(""); setTime(""); setSuggest(null);
      await onBooked(needsPay ? { ...created, doctorName: doctor.name } : null);
    } catch (err) { toast(errText(err)); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="panel-body" style={{ padding: 18 }}>
      <div className="form-grid">
        <div className="field"><label>Your skin / hair concern</label>
          <select value={concern} onChange={(e) => setConcern(e.target.value)} required>
            <option value="">Select concern</option>{CONCERNS.map((c) => <option key={c}>{c}</option>)}
          </select></div>
        {!video && (
          <div className="field"><label>Treatment</label>
            <select value={treatment} onChange={(e) => setTreatment(e.target.value)}>
              <option value="">Skin Consultation</option>
              {services.map((s) => <option key={s.name}>{s.name}</option>)}
            </select></div>
        )}
        <div className="field full"><label>Doctor {suggest && <small>— {suggest.message}</small>}</label>
          <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setTime(""); }} required>
            <option value="">{suggest && !list.length ? "No matching doctor available" : "Select doctor"}</option>
            {list.map((d) => (
              <option key={d.id} value={d.id}>{d.name} — {d.specialty}{video ? ` (${money(d.videoFee)})` : ""}</option>
            ))}
          </select></div>
        <div className="field"><label>Date</label>
          <input type="date" min={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} required /></div>
        <div className="field"><label>Time slot</label>
          <select value={time} onChange={(e) => setTime(e.target.value)} required disabled={!doctor}>
            <option value="">{doctor ? "Select time" : "Choose a doctor first"}</option>
            {(doctor?.slots || []).filter((s) => !booked.includes(s) && !slotPassed(date, s)).map((s) => <option key={s}>{s}</option>)}
          </select></div>
      </div>
      {doctor && (
        <div className="alert alert-info" style={{ margin: "14px 0" }}>
          {video
            ? <>Video consultation charge: <strong>{money(fee)}</strong>. Pay online right after booking (UPI, card or net banking). Your slot is confirmed once the payment is done, and you can join the call from this page on the day of the consultation.</>
            : <>{treatment || "Consultation"} fee: <strong>{money(fee)}</strong>, payable at the clinic.</>}
        </div>
      )}
      <button className="btn btn-rose" type="submit" disabled={busy}>
        <i className={`bi ${video ? "bi-camera-video" : "bi-calendar-plus"}`} />{" "}
        {video ? (fee === 0 ? "Book video consultation" : "Book & pay for video consultation") : "Book appointment"}{fee != null ? ` — ${money(fee)}` : ""}
      </button>
    </form>
  );
}

/* ---------- reports ---------- */
function Reports({ reports, reload, toast }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      await api.portalUploadReport(file, title);
      toast("Report uploaded."); setFile(null); setTitle(""); e.target.reset(); await reload();
    } catch (err) { toast(errText(err)); }
    setBusy(false);
  }
  async function remove(id) {
    if (!window.confirm("Delete this report?")) return;
    try { await api.portalDeleteReport(id); toast("Report deleted."); await reload(); } catch (err) { toast(errText(err)); }
  }
  return (
    <>
      <Panel icon="bi-cloud-arrow-up" title="Upload a report">
        <form onSubmit={upload} style={{ padding: 18 }}>
          <div className="form-grid">
            <div className="field"><label>Title (optional)</label>
              <input value={title} maxLength={100} placeholder="e.g. Blood test – March" onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label>File (PDF, PNG, JPG or WEBP · max 10 MB)</label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files[0] || null)} required /></div>
          </div>
          <button className="btn btn-rose" type="submit" disabled={busy || !file} style={{ marginTop: 14 }}>
            <i className="bi bi-upload" /> Upload
          </button>
          <p style={{ fontSize: ".75rem", marginTop: 10 }}>Your doctors and the clinic staff can see the reports you upload here.</p>
        </form>
      </Panel>
      <Panel icon="bi-file-earmark-medical" title="My reports (including reports prepared by your doctors)">
        {!reports.length ? <div className="empty">No reports uploaded yet.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Title</th><th>Source</th><th>Uploaded</th><th>Size</th><th /></tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.title}</strong><div style={{ fontSize: ".7rem" }}>{r.fileName}</div></td>
                <td>{r.createdBy ? <span className="badge badge-doctor">Prepared by {r.createdBy}</span> : <span className="badge badge-blue">My upload</span>}</td>
                <td>{prettyDate((r.uploadedAt || "").slice(0, 10))}</td><td>{Math.max(1, Math.round(r.size / 1024))} KB</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => api.openProtectedFile(`/portal/reports/${r.id}/file`).catch((e) => toast(errText(e)))}>
                    <i className="bi bi-eye" /> View</button>{" "}
                  {!r.createdBy && <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>Delete</button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}

/* ---------- bills ---------- */
function Bills({ bills }) {
  if (!bills) return <div className="empty">Loading…</div>;
  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 22 }}>
        <Stat icon="bi-receipt" color="#8768B3" label="Total billed" value={money(bills.totalBilled)} note="All your visits" />
        <Stat icon="bi-check-circle" color="#4F9C82" label="Paid" value={money(bills.totalPaid)} note="Received by the clinic" />
        <Stat icon="bi-hourglass-split" color="#E39A4A" label="Due" value={money(bills.totalDue)} note={bills.totalDue > 0 ? "Please pay at the clinic" : "Nothing pending"} />
      </div>
      <Panel icon="bi-receipt" title="My bills">
        {!bills.bills.length ? <div className="empty">No bills yet.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Bill</th><th>Date</th><th>Doctor</th><th>Service</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{bills.bills.map((b) => (
              <tr key={b.id}>
                <td>{b.code}</td><td>{prettyDate(b.date)}</td><td>{b.doctorName}</td>
                <td>{b.mode === "VIDEO" ? "Video consultation" : b.treatment}</td>
                <td>{money(b.fee)}</td><td>{money(b.paid)}</td><td>{b.due > 0 ? money(b.due) : "—"}</td>
                <td><PayBadge state={b.paymentState} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}

/* ---------- recovery tracker ---------- */
function Recovery({ logs, reload, toast }) {
  const [form, setForm] = useState({ date: todayStr(), score: 5, symptoms: "", notes: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function add(e) {
    e.preventDefault();
    try {
      await api.portalAddRecovery({ date: form.date, score: Number(form.score), symptoms: form.symptoms, notes: form.notes });
      toast("Check-in saved."); setForm({ date: todayStr(), score: 5, symptoms: "", notes: "" }); await reload();
    } catch (err) { toast(errText(err)); }
  }
  async function remove(id) {
    try { await api.portalDeleteRecovery(id); await reload(); } catch (err) { toast(errText(err)); }
  }
  const recent = logs.slice(-14);
  const first = logs[0], last = logs[logs.length - 1];
  const delta = logs.length > 1 ? last.score - first.score : 0;
  return (
    <>
      <Panel icon="bi-journal-plus" title="How is your skin / hair today?">
        <form onSubmit={add} style={{ padding: 18 }}>
          <div className="form-grid">
            <div className="field"><label>Date</label>
              <input type="date" max={todayStr()} value={form.date} onChange={set("date")} required /></div>
            <div className="field"><label>Condition today: <strong>{form.score}/10</strong> (1 = very bad, 10 = great)</label>
              <input type="range" min="1" max="10" value={form.score} onChange={set("score")} /></div>
            <div className="field"><label>Symptoms (itching, redness, hair fall…)</label>
              <input maxLength={500} value={form.symptoms} onChange={set("symptoms")} /></div>
            <div className="field"><label>Notes (medicine taken, side effects…)</label>
              <input maxLength={500} value={form.notes} onChange={set("notes")} /></div>
          </div>
          <button className="btn btn-rose" type="submit" style={{ marginTop: 14 }}><i className="bi bi-check-circle" /> Save check-in</button>
        </form>
      </Panel>
      <Panel icon="bi-graph-up-arrow" title="My recovery progress"
             right={logs.length > 1 && (
               <span className="pill">{delta > 0 ? `Improved by ${delta} point${delta > 1 ? "s" : ""}` : delta < 0 ? `Down ${-delta} point${delta < -1 ? "s" : ""}` : "No change yet"}</span>)}>
        {!logs.length ? <div className="empty">No check-ins yet — add your first one above.</div> : (
          <div style={{ padding: "8px 18px 15px" }}>
            {recent.map((l) => (
              <div className="bar-row" key={l.id}>
                <span className="bar-label">{prettyDate(l.logDate)}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${l.score * 10}%`, background: "linear-gradient(90deg,#9FD8C4,#4F9C82)" }} /></span>
                <span className="bar-value">{l.score}/10</span>
              </div>))}
          </div>
        )}
      </Panel>
      {!!logs.length && (
        <Panel icon="bi-list-ul" title="My check-ins">
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Score</th><th>Symptoms</th><th>Notes</th><th /></tr></thead>
            <tbody>{[...logs].reverse().map((l) => (
              <tr key={l.id}><td>{prettyDate(l.logDate)}</td><td>{l.score}/10</td><td translate="no">{l.symptoms || "—"}</td><td translate="no">{l.notes || "—"}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => remove(l.id)}>Delete</button></td></tr>))}</tbody>
          </table></div>
        </Panel>
      )}
    </>
  );
}


/* ---------- reminders for upcoming appointments ---------- */
// "10:30 AM" + "2026-10-11"  ->  Date (local time); null when the visit has no time
function startOf(a) {
  if (!a.date || !a.time) return null;
  const m = a.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  const [y, mo, d] = a.date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, Number(m[2]));
}

// A video call can be joined on the day of the consultation and stops being joinable 1 hour after its scheduled time.
const JOIN_WINDOW_MIN = 60;
function canJoinVideo(a, now = new Date()) {
  if (a.date !== todayStr()) return false;
  const start = startOf(a);
  return !start || now - start <= JOIN_WINDOW_MIN * 60000;
}

// A patient can cancel only until 1 hour before the booked time (the clinic's Admin can cancel until the time arrives).
function canPatientCancel(a, now = new Date()) {
  const start = startOf(a);
  return start ? start - now > 60 * 60000 : a.date >= todayStr();
}
// the Join button disappears completely once the 1-hour window after the booked time is over (or the day has passed)
function joinExpired(a, now = new Date()) {
  if (a.date < todayStr()) return true;
  const start = startOf(a);
  return a.date === todayStr() && !!start && now - start > JOIN_WINDOW_MIN * 60000;
}

function whenText(start, now) {
  const mins = Math.round((start - now) / 60000);
  if (mins <= 0) return "is happening now";
  if (mins < 60) return `starts in ${mins} minute${mins === 1 ? "" : "s"}`;
  const time = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toUpperCase();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (sameDay(start, now)) return `is today at ${time}`;
  if (sameDay(start, tomorrow)) return `is tomorrow at ${time}`;
  return `is on ${start.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} at ${time}`;
}

function Reminders({ appts, now }) {
  const [hidden, setHidden] = useState([]);
  const [perm, setPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  const list = appts
    .filter((a) => a.status !== "Cancelled" && a.status !== "Completed")
    .map((a) => ({ a, start: startOf(a) }))
    .filter((x) => x.start && x.start - now > -30 * 60000 && x.start - now < 72 * 3600000)
    .sort((x, y) => x.start - y.start);

  // desktop notification 60 and 15 minutes before (only while this page is open)
  useEffect(() => {
    if (perm !== "granted") return;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("bd-notified") || "{}"); } catch { /* ignore */ }
    list.forEach(({ a, start }) => {
      const mins = (start - now) / 60000;
      [60, 15].forEach((limit) => {
        const key = `${a.id}:${limit}`;
        if (mins > 0 && mins <= limit && !seen[key]) {
          seen[key] = 1;
          const soon = limit === 60 ? "in about an hour" : "in 15 minutes";
          new Notification(a.mode === "VIDEO" ? "Video consultation reminder" : "Appointment reminder",
            { body: `${a.mode === "VIDEO" ? "Video call" : "Visit"} with ${a.doctorName} ${soon} (${a.time}).` });
        }
      });
    });
    try { localStorage.setItem("bd-notified", JSON.stringify(seen)); } catch { /* ignore */ }
  }, [now, perm, appts]);

  const shown = list.filter(({ a }) => !hidden.includes(a.id));
  if (!shown.length && perm !== "default") return null;

  return (
    <div className="reminders">
      {shown.map(({ a, start }) => {
        const mins = (start - now) / 60000;
        const isToday = a.date === todayStr();
        const video = a.mode === "VIDEO";
        return (
          <div key={a.id} className={`reminder ${mins <= 60 ? "soon" : isToday ? "today" : ""}`}>
            <div className="reminder-icon"><i className={`bi ${video ? "bi-camera-video" : "bi-bell"}`} /></div>
            <div className="reminder-text">
              <strong>{`${video ? "Video consultation" : a.treatment || "Appointment"} with ${a.doctorName} ${whenText(start, now)}`}</strong>
              <span>
                {a.time}
                {video ? " · Join the call from here when it is time" : " · Please arrive 10 minutes early"}
                {a.due > 0 ? ` · ${money(a.due)} to pay` : ""}
              </span>
            </div>
            {video && isToday && canJoinVideo(a, now) && (
              <button className="btn btn-rose btn-sm" onClick={() => openVideoCall(a.id, "Video consultation with " + a.doctorName)}>
                <i className="bi bi-camera-video" /> Join call
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => setHidden([...hidden, a.id])} title="Hide this reminder" aria-label="Hide this reminder"><i className="bi bi-x-lg" /></button>
          </div>
        );
      })}
      {perm === "default" && (
        <div className="reminder">
          <div className="reminder-icon"><i className="bi bi-bell" /></div>
          <div className="reminder-text">
            <strong>Get notified before your appointments</strong>
            <span>We can show a notification 1 hour and 15 minutes before each visit or video call (while this page is open).</span>
          </div>
          <button className="btn btn-rose btn-sm" onClick={() => Notification.requestPermission().then(setPerm)}>Turn on</button>
        </div>
      )}
    </div>
  );
}

/* ---------- before / after photos ---------- */
function Photos({ sets, reload, toast }) {
  const [caption, setCaption] = useState("");
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [busy, setBusy] = useState(false);

  async function upload(e) {
    e.preventDefault();
    if (!before) { toast("Please choose the BEFORE photo."); return; }
    setBusy(true);
    try {
      await api.portalAddPhotos(caption, before, after);
      toast("Photos saved."); setCaption(""); setBefore(null); setAfter(null); e.target.reset(); await reload();
    } catch (err) { toast(errText(err)); }
    setBusy(false);
  }
  async function addAfter(id, file) {
    if (!file) return;
    try { await api.portalAddAfterPhoto(id, file); toast("After photo added."); await reload(); } catch (err) { toast(errText(err)); }
  }
  async function remove(id) {
    if (!window.confirm("Delete these photos?")) return;
    try { await api.portalDeletePhotos(id); await reload(); } catch (err) { toast(errText(err)); }
  }

  return (
    <>
      <Panel icon="bi-images" title="Add before & after photos">
        <form onSubmit={upload} style={{ padding: 18 }}>
          <div className="form-grid">
            <div className="field full"><label>What are these photos of?</label>
              <input value={caption} maxLength={100} placeholder="e.g. Acne treatment on cheeks" onChange={(e) => setCaption(e.target.value)} required /></div>
            <div className="field"><label>Before photo (PNG, JPG or WEBP)</label>
              <input type="file" accept=".png,.jpg,.jpeg,.webp,image/*" onChange={(e) => setBefore(e.target.files[0] || null)} required /></div>
            <div className="field"><label>After photo (you can add it later)</label>
              <input type="file" accept=".png,.jpg,.jpeg,.webp,image/*" onChange={(e) => setAfter(e.target.files[0] || null)} /></div>
          </div>
          <button className="btn btn-rose" type="submit" disabled={busy} style={{ marginTop: 14 }}><i className="bi bi-upload" /> Save photos</button>
          <p style={{ fontSize: ".75rem", marginTop: 10 }}>Only you, your doctors and the clinic staff can see these photos. They are never shown on the public review page.</p>
        </form>
      </Panel>
      <Panel icon="bi-images" title="My before & after photos">
        {!sets.length ? <div className="empty">No photos yet.</div> : (
          <div className="photo-grid">
            {sets.map((p) => (
              <div className="photo-card" key={p.id}>
                <div className="photo-card-head">
                  <span translate="no">{p.caption}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Delete</button>
                </div>
                <div className="photo-pair">
                  <div className="photo-cell"><small>Before · {prettyDate(p.beforeOn)}</small>
                    <ProtectedImage url={`/portal/photos/${p.id}/before`} alt="Before" title={`${p.caption} - before`} /></div>
                  <div className="photo-cell"><small>After{p.hasAfter ? ` · ${prettyDate(p.afterOn)}` : ""}</small>
                    {p.hasAfter
                      ? <ProtectedImage url={`/portal/photos/${p.id}/after`} alt="After" title={`${p.caption} - after`} />
                      : <label className="photo-missing" style={{ cursor: "pointer", flexDirection: "column", gap: 6 }}>
                          <span>+ Add after photo</span>
                          <input type="file" accept=".png,.jpg,.jpeg,.webp,image/*" style={{ display: "none" }}
                                 onChange={(e) => addAfter(p.id, e.target.files[0])} />
                        </label>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

/* ---------- public reviews ---------- */
function Stars({ n }) {
  return <span className="stars" aria-label={`${n} out of 5`}>{"★".repeat(n)}<span className="off">{"★".repeat(5 - n)}</span></span>;
}

function Reviews({ reviews, doctors, reload, toast }) {
  const [rating, setRating] = useState(0);
  const [doctorId, setDoctorId] = useState("");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!rating) { toast("Please choose a star rating."); return; }
    setBusy(true);
    try {
      await api.portalAddReview({ rating, text, doctorId, anonymous });
      toast("Thank you! Your review is now public."); setRating(0); setText(""); setDoctorId(""); setAnonymous(false); await reload();
    } catch (err) { toast(errText(err)); }
    setBusy(false);
  }
  async function remove(id) {
    if (!window.confirm("Delete your review?")) return;
    try { await api.portalDeleteReview(id); await reload(); } catch (err) { toast(errText(err)); }
  }

  const avg = (list) => (list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1) : "—");
  const shown = reviews.filter((r) => !filter || r.doctorId === filter);
  const reviewed = doctors.filter((d) => reviews.some((r) => r.doctorId === d.id));

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 22 }}>
        <Stat icon="bi-star-fill" color="#E39A4A" label="Average rating" value={avg(reviews)} note="Across all reviews" />
        <Stat icon="bi-chat-heart" color="#E88AA7" label="Reviews" value={reviews.length} note="Written by patients" />
        {reviewed.slice(0, 2).map((d) => (
          <Stat key={d.id} icon="bi-person-heart" color="#8768B3" label={d.name} value={avg(reviews.filter((r) => r.doctorId === d.id))}
                note={`${reviews.filter((r) => r.doctorId === d.id).length} review(s)`} />
        ))}
      </div>

      <Panel icon="bi-pencil-square" title="Write a public review">
        <form onSubmit={submit} style={{ padding: 18 }}>
          <div className="alert alert-info" style={{ marginBottom: 14 }}>
            Reviews are <strong>public</strong>: every patient and doctor can read them. Please do not include phone numbers or medical details you want to keep private.
          </div>
          <div className="field"><label>Your rating</label>
            <div className="star-picker">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} className={n <= rating ? "on" : ""} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>★</button>
              ))}
            </div></div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field full"><label>Who is this review about? (optional)</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">The clinic in general</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
              </select></div>
            <div className="field full"><label>Your experience</label>
              <textarea rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} required
                        placeholder="How was your visit, treatment or video consultation?" /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Post anonymously (hide my name)
          </label>
          <button className="btn btn-rose" type="submit" disabled={busy}><i className="bi bi-send" /> Publish review</button>
        </form>
      </Panel>

      <Panel icon="bi-chat-heart" title="What patients say"
             right={<select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "auto" }}>
               <option value="">All reviews</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}>
        {!shown.length ? <div className="empty">No reviews yet — be the first to share your experience.</div> : (
          <div className="review-list">
            {shown.map((r) => (
              <div className="review-card" key={r.id}>
                <div className="review-head">
                  <Stars n={r.rating} />
                  <strong>{r.author}</strong>
                  {r.doctorName ? <span className="badge badge-doctor">{r.doctorName}</span> : <span className="badge badge-blue">Clinic</span>}
                  <span className="review-meta">{prettyDate((r.createdAt || "").slice(0, 10))}</span>
                  {r.mine && <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto" }} onClick={() => remove(r.id)}>Delete</button>}
                </div>
                <p translate="no">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

/* ---------- the portal ---------- */
export default function PatientPortal() {
  const [tab, setTab] = useState("home");
  const [me, setMe] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [fees, setFees] = useState({ inClinic: 0 });
  const [appts, setAppts] = useState([]);
  const [bills, setBills] = useState(null);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [toastText, setToastText] = useState("");
  const [payFor, setPayFor] = useState(null);      // appointment currently being paid online
  const [revisits, setRevisits] = useState([]);    // open revisit suggestions from doctors (optional to act on)
  const [prefill, setPrefill] = useState(null);    // doctor + date carried from a revisit notice into the booking form

  const toast = useCallback((t) => { setToastText(t); setTimeout(() => setToastText(""), 3500); }, []);
  const load = useCallback(async () => {
    const [m, d, s, f, a, b, r, l, ph, rv, rr] = await Promise.allSettled([
      api.portalMe(), api.fetchDoctors(), api.fetchServices(), api.portalFees(), api.portalAppointments(),
      api.portalBills(), api.portalReports(), api.portalRecovery(), api.portalPhotos(), api.fetchReviews(), api.portalRevisits()]);
    const v = (x, fallback) => (x.status === "fulfilled" ? x.value : fallback);
    setMe(v(m, null)); setDoctors(v(d, [])); setServices(v(s, [])); setFees(v(f, { inClinic: 0 }));
    setAppts(v(a, [])); setBills(v(b, null)); setReports(v(r, [])); setLogs(v(l, [])); setPhotos(v(ph, [])); setReviews(v(rv, [])); setRevisits(v(rr, []));
    if ([m, d, a].every((x) => x.status === "rejected")) toast("Could not reach the server — is the backend running?");
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);   // keeps reminders current

  // doctor names for the appointment list
  const doctorName = (id) => doctors.find((d) => d.id === id)?.name || id;
  const apptRows = appts.map((a) => ({ ...a, doctorName: doctorName(a.doctorId) }));

  async function cancel(id) {
    if (!window.confirm("Cancel this appointment?")) return;
    try { await api.portalCancel(id); toast("Appointment cancelled."); await load(); } catch (e) { toast(errText(e)); }
  }

  async function dismissRevisit(id) {
    try { await api.portalDismissRevisit(id); await load(); } catch (e) { toast(errText(e)); }
  }
  function bookFromRevisit(r) {                       // optional: opens the booking form with the doctor and date filled in
    setPrefill({ doctorId: r.doctorId, date: r.date, key: r.id + ":" + Date.now() });
    setTab("book");
  }

  const upcoming = apptRows.filter((a) => a.date >= todayStr() && a.status !== "Cancelled" && a.status !== "Completed")
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const lastLog = logs[logs.length - 1];

  return (
    <>
      <nav className="topnav">
        <a href="#" className="brand" onClick={(e) => { e.preventDefault(); setTab("home"); }}>
          <span className="brand-petal"><i className="bi bi-flower2" /></span>
          <span><span className="brand-word">BloomDerma</span><span className="brand-sub">Patient portal</span></span>
        </a>
        <div className="nav-links">
          {TABS.map(([key, label]) => (
            <a key={key} href="#" className={tab === key ? "current" : ""} onClick={(e) => { e.preventDefault(); setTab(key); }}>{label}</a>
          ))}
          <ThemeToggle />
          <button className="btn btn-outline nav-action" onClick={api.logout}><i className="bi bi-box-arrow-right" /> Sign out</button>
        </div>
      </nav>

      <main className="page">
        <RevisitNotices items={revisits} onBook={bookFromRevisit} onDismiss={dismissRevisit} />
        <Reminders appts={apptRows} now={now} />
        {tab === "home" && (
          <>
            <div className="hero"><div>
              <h1>Welcome{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
              <p>Book visits, join video consultations, share your reports, check your bills and track your recovery — all in one place.{me && <> Your patient ID is <strong>{me.id}</strong>.</>}</p>
            </div></div>
            <div className="stat-grid" style={{ marginBottom: 22 }}>
              <Stat icon="bi-calendar-check" color="#E88AA7" label="Upcoming" value={upcoming.length} note="Appointments & video calls" />
              <Stat icon="bi-hourglass-split" color="#E39A4A" label="Amount due" value={money(bills?.totalDue)} note="See My Bills" />
              <Stat icon="bi-file-earmark-medical" color="#8768B3" label="Reports" value={reports.length} note="On your account" />
              <Stat icon="bi-graph-up-arrow" color="#4F9C82" label="Latest recovery" value={lastLog ? `${lastLog.score}/10` : "—"} note={lastLog ? prettyDate(lastLog.logDate) : "No check-ins yet"} />
            </div>
            <Panel icon="bi-calendar-event" title="Upcoming appointments"
                   right={<button className="btn btn-rose btn-sm" onClick={() => setTab("book")}><i className="bi bi-calendar-plus" /> Book</button>}>
              <AppointmentList items={upcoming} onCancel={cancel} />
            </Panel>
          </>
        )}

        {tab === "book" && (
          <>
            <div className="hero"><div><h1>Book an appointment</h1>
              <p>Choose your concern and we will suggest the doctors who specialise in it.</p></div></div>
            <Panel icon="bi-calendar-plus" title="New appointment">
              <BookingForm key={prefill?.key || "plain"} prefill={prefill} video={false} doctors={doctors} services={services} fees={fees} onBooked={load} toast={toast} />
            </Panel>
            <Panel icon="bi-calendar-event" title="My appointments">
              <AppointmentList items={apptRows} filterVideo={false} onCancel={cancel} />
            </Panel>
          </>
        )}

        {tab === "video" && (
          <>
            <div className="hero"><div><h1>Video consultation</h1>
              <p>Talk to a doctor from home. Each doctor's charge is shown below; the call opens on the day of your consultation.</p></div></div>
            <Panel icon="bi-cash-coin" title="Doctors & video charges">
              <div className="table-wrap"><table>
                <thead><tr><th>Doctor</th><th>Speciality</th><th>Video charge</th></tr></thead>
                <tbody>{doctors.map((d) => (<tr key={d.id}><td><strong>{d.name}</strong></td><td>{d.specialty}</td><td>{money(d.videoFee)}</td></tr>))}</tbody>
              </table></div>
            </Panel>
            <Panel icon="bi-camera-video" title="Book a video consultation">
              <BookingForm video doctors={doctors} services={services} fees={fees} toast={toast}
                onBooked={async (created) => { await load(); if (created) setPayFor(created); }} />
            </Panel>
            <Panel icon="bi-calendar-event" title="My video consultations">
              <AppointmentList items={apptRows} filterVideo onCancel={cancel} onPay={setPayFor} />
            </Panel>
          </>
        )}

        {tab === "reports" && (<><div className="hero"><div><h1>My reports</h1><p>Upload lab reports or photos for your doctor. Reports your doctor prepares for you appear here too, as PDFs you can open and keep.</p></div></div>
          <Reports reports={reports} reload={load} toast={toast} /></>)}
        {tab === "photos" && (<><div className="hero"><div><h1>Before &amp; after</h1><p>Keep a visual record of your progress. Your doctors can see these photos too.</p></div></div>
          <Photos sets={photos} reload={load} toast={toast} /></>)}
        {tab === "reviews" && (<><div className="hero"><div><h1>Reviews</h1><p>Read what other patients say about the clinic and doctors — and share your own experience.</p></div></div>
          <Reviews reviews={reviews} doctors={doctors} reload={load} toast={toast} /></>)}
        {tab === "bills" && (<><div className="hero"><div><h1>My bills</h1><p>Every bill from your visits, with what you have paid and what is still due.</p></div></div>
          <Bills bills={bills} /></>)}
        {tab === "recovery" && (<><div className="hero"><div><h1>My recovery</h1><p>Check in regularly and watch your progress over time. Your doctor can see these entries.</p></div></div>
          <Recovery logs={logs} reload={load} toast={toast} /></>)}
      </main>
      {payFor && <PaymentModal appt={payFor} toast={toast} onClose={() => setPayFor(null)} onPaid={load} />}
      {toastText && <div className="toast show" style={{ opacity: 1 }}>{toastText}</div>}
    </>
  );
}
