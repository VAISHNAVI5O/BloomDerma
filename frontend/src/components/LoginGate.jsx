import { useEffect, useRef, useState } from "react";
import PasswordField from "./PasswordField.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { login, setToken, fetchSpecialities, createDoctorAs, registerPatient } from "../services/apiService.js";

// Login screen — uses BloomDerma's own CSS variables/classes.
// Step 1: choose Doctor Login, Admin / Receptionist Login, or Add New Doctor.
// Step 2: the matching form. "Add New Doctor" asks for ADMIN credentials, so doctors can't register themselves.
const TYPES = {
  DOCTOR: { label: "Doctor Login", idLabel: "Doctor ID", icon: "bi-heart-pulse-fill" },
  STAFF: { label: "Admin / Receptionist Login", idLabel: "Admin / Receptionist ID", icon: "bi-person-badge-fill" },
  PATIENT: { label: "Patient Login", idLabel: "Username", icon: "bi-person-heart" },
};

// ---- input rules ----
const PW_RULES = [
  { label: "At least 8 characters",            ok: (p) => p.length >= 8 },
  { label: "One uppercase letter (A-Z)",       ok: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)",       ok: (p) => /[a-z]/.test(p) },
  { label: "One digit (0-9)",                  ok: (p) => /[0-9]/.test(p) },
  { label: "One special character (! @ # $ …)", ok: (p) => /[^A-Za-z0-9 ]/.test(p) },
];
const passwordValid = (p) => PW_RULES.every((r) => r.ok(p)) && p.length <= 72;
const digitsOnly = (v) => v.replace(/[^0-9]/g, "").slice(0, 10);          // phone: exactly 10 digits

function PasswordRules({ password }) {
  if (!password) return null;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 12, display: "grid", gap: 2 }}>
      {PW_RULES.map((r) => (
        <li key={r.label} style={{ color: r.ok(password) ? "#4f9c82" : "var(--danger)", fontWeight: 600 }}>
          {r.ok(password) ? "✓" : "✗"} {r.label}
        </li>
      ))}
    </ul>
  );
}

const EMPTY_PATIENT = { name: "", age: "", gender: "Female", phone: "", email: "", username: "", password: "", confirmPassword: "" };
const EMPTY_DOCTOR = { name: "", id: "", password: "", specialty: "", phone: "", email: "", confirmPassword: "" };

export default function LoginGate({ onLogin }) {
  const [type, setType] = useState(null);            // null | "DOCTOR" | "STAFF" | "ADD_DOCTOR"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [doctor, setDoctor] = useState(EMPTY_DOCTOR);
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const [specialities, setSpecialities] = useState([]);
  const [error, setError] = useState("");
  const userRef = useRef(null);       // focus goes back here after a wrong ID / password
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (type === "ADD_DOCTOR" && specialities.length === 0)
      fetchSpecialities().then(setSpecialities).catch((err) =>
        setError(err.response
          ? `Could not load the speciality list (server error ${err.response.status}). Check the backend console.`
          : "API unavailable — is the backend running?"));
  }, [type]);

  function choose(t) { setType(t); setUsername(""); setPassword(""); setDoctor(EMPTY_DOCTOR); setPatient(EMPTY_PATIENT); setError(""); }
  const setField = (k) => (e) => setDoctor({ ...doctor, [k]: e.target.value });
  const setPat = (k) => (e) => setPatient({ ...patient, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await login(username.trim(), password, type);
      setToken(res.token);
      onLogin(res.token);
    } catch (err) {
      setError(err.response ? `Invalid ${TYPES[type].idLabel} or password. Please try again.` : "API unavailable — is the backend running?");
      if (err.response) { setUsername(""); setPassword(""); setTimeout(() => userRef.current && userRef.current.focus(), 0); }
    }
  }

  async function submitPatient(e) {
    e.preventDefault();
    setError("");
    if (patient.phone.length !== 10) { setError("Phone number must be exactly 10 digits."); return; }
    if (!passwordValid(patient.password)) { setError("Password does not meet all the requirements."); return; }
    if (patient.password !== patient.confirmPassword) { setError("Passwords do not match."); return; }
    try {
      const { confirmPassword, ...body } = patient;
      await registerPatient({ ...body, name: patient.name.trim(), age: Number(patient.age), username: patient.username.trim() });
    } catch (err) {
      setError(err.response?.data?.message || "API unavailable — is the backend running?");
      return;
    }
    try {
      const res = await login(patient.username.trim(), patient.password, "PATIENT");
      setToken(res.token);
      onLogin(res.token);
    } catch {
      setError("Account created — please log in from Patient Login.");
    }
  }

  async function submitDoctor(e) {
    e.preventDefault();
    setError("");
    if (doctor.phone && doctor.phone.length !== 10) { setError("Phone number must be exactly 10 digits."); return; }
    if (!passwordValid(doctor.password)) { setError("Doctor password does not meet all the requirements."); return; }
    if (doctor.password !== doctor.confirmPassword) { setError("Doctor passwords do not match."); return; }
    let token;
    try {
      const res = await login(username.trim(), password, "STAFF");
      if (res.role !== "ADMIN") { setError("Only an Admin can add a new doctor."); return; }
      token = res.token;                              // used for this one request only, never stored
    } catch (err) {
      setError(err.response ? "Invalid Admin ID or password. Please try again." : "API unavailable — is the backend running?");
      if (err.response) { setUsername(""); setPassword(""); setTimeout(() => userRef.current && userRef.current.focus(), 0); }
      return;
    }
    try {
      const { confirmPassword, ...doctorBody } = doctor;
      await createDoctorAs(token, { ...doctorBody, name: doctor.name.trim(), id: doctor.id.trim() });
      setNotice(`${doctor.name.trim()} was added. They can now log in with Doctor ID "${doctor.id.trim()}".`);
      choose(null);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add the doctor.");
    }
  }

  const card = { background: "var(--card)", padding: 34, borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow)", width: "min(380px, 92vw)", display: "grid", gap: 14 };
  const title = (
    <h2 style={{ fontFamily: "Quicksand", color: "var(--rose-deep)", margin: 0 }}>
      <i className="bi bi-flower2" /> BloomDerma
    </h2>
  );
  const back = (
    <button className="btn btn-outline" type="button" onClick={() => choose(null)}>
      <i className="bi bi-arrow-left" /> Back
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: "24px 0" }}>
      <ThemeToggle floating />
      {!type ? (
        <div style={card}>
          {title}
          <div style={{ fontWeight: 700 }}>How would you like to login?</div>
          {notice && <div style={{ color: "#4f9c82", fontWeight: 700 }}>{notice}</div>}
          <button className="btn btn-rose" type="button" onClick={() => { setNotice(""); choose("DOCTOR"); }}>
            <i className={`bi ${TYPES.DOCTOR.icon}`} /> Doctor Login
          </button>
          <button className="btn btn-outline" type="button" onClick={() => { setNotice(""); choose("STAFF"); }}>
            <i className={`bi ${TYPES.STAFF.icon}`} /> Admin / Receptionist Login
          </button>
          <button className="btn btn-outline" type="button" onClick={() => { setNotice(""); choose("PATIENT"); }}>
            <i className={`bi ${TYPES.PATIENT.icon}`} /> Patient Login
          </button>
          <button className="btn btn-outline" type="button" onClick={() => { setNotice(""); choose("ADD_DOCTOR"); }}>
            <i className="bi bi-person-plus" /> Add New Doctor
          </button>
        </div>
      ) : type === "REGISTER" ? (
        <form onSubmit={submitPatient} style={card} autoComplete="off">
          {title}
          <div style={{ fontWeight: 700 }}>Create patient account</div>
          <small style={{ color: "var(--ink-soft)" }}>Your Patient ID (in the format SK001) is given to you by the clinic when your account is created.</small>
          <input className="form-control" placeholder="Full name" value={patient.name} onChange={setPat("name")} required autoFocus />
          <input className="form-control" type="number" min="0" max="120" placeholder="Age" value={patient.age} onChange={setPat("age")} required />
          <select className="form-control" value={patient.gender} onChange={setPat("gender")}>
            <option>Female</option><option>Male</option><option>Other</option>
          </select>
          <input className="form-control" type="tel" inputMode="numeric" placeholder="Phone (10 digits)" value={patient.phone}
                 onChange={(e) => setPatient({ ...patient, phone: digitsOnly(e.target.value) })}
                 pattern="[0-9]{10}" title="Exactly 10 digits" maxLength={10} required />
          <input className="form-control" type="email" placeholder="Email (optional)" value={patient.email} onChange={setPat("email")} />
          <input className="form-control" placeholder="Choose a username" value={patient.username} onChange={setPat("username")} required />
          <PasswordField placeholder="Password" minLength={8}
                         value={patient.password} onChange={setPat("password")} autoComplete="new-password" />
          <PasswordRules password={patient.password} />
          <PasswordField placeholder="Confirm password" minLength={8}
                         value={patient.confirmPassword} onChange={setPat("confirmPassword")} autoComplete="new-password" />
          {patient.confirmPassword && patient.password !== patient.confirmPassword && (
            <small style={{ color: "var(--danger)", fontWeight: 700 }}>Passwords do not match.</small>
          )}
          {error && <div style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</div>}
          <button className="btn btn-rose" type="submit">Create account</button>
          <button className="btn btn-outline" type="button" onClick={() => choose("PATIENT")}>
            <i className="bi bi-arrow-left" /> Back to login
          </button>
        </form>
      ) : type === "ADD_DOCTOR" ? (
        <form onSubmit={submitDoctor} style={card} autoComplete="off">
          {title}
          <div style={{ fontWeight: 700 }}>Add New Doctor</div>
          <small style={{ color: "var(--ink-soft)" }}>An Admin must authorise this.</small>
          <input className="form-control" placeholder="Admin ID" value={username}
                 onChange={(e) => setUsername(e.target.value)} required autoFocus ref={userRef} />
          <PasswordField placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <hr style={{ border: 0, borderTop: "1px solid var(--line, #eee)", width: "100%" }} />
          <input className="form-control" placeholder="Doctor Name" value={doctor.name} onChange={setField("name")} required />
          <input className="form-control" placeholder="Doctor ID (used to log in)" value={doctor.id} onChange={setField("id")} required />
          <PasswordField placeholder="Doctor password" minLength={8}
                         value={doctor.password} onChange={setField("password")} autoComplete="new-password" />
          <PasswordRules password={doctor.password} />
          <PasswordField placeholder="Confirm doctor password" minLength={8}
                         value={doctor.confirmPassword} onChange={setField("confirmPassword")} autoComplete="new-password" />
          {doctor.confirmPassword && doctor.password !== doctor.confirmPassword && (
            <small style={{ color: "var(--danger)", fontWeight: 700 }}>Passwords do not match.</small>
          )}
          <select className="form-control" value={doctor.specialty} onChange={setField("specialty")} required>
            <option value="">Select speciality</option>
            {specialities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="form-control" type="tel" inputMode="numeric" placeholder="Phone (optional, 10 digits)" value={doctor.phone}
                 onChange={(e) => setDoctor({ ...doctor, phone: digitsOnly(e.target.value) })}
                 pattern="[0-9]{10}" title="Exactly 10 digits" maxLength={10} />
          <input className="form-control" type="email" placeholder="Email (optional)" value={doctor.email} onChange={setField("email")} />
          {error && <div style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</div>}
          <button className="btn btn-rose" type="submit">Add Doctor</button>
          {back}
        </form>
      ) : (
        <form onSubmit={submit} style={card}>
          {title}
          <div style={{ fontWeight: 700 }}>{TYPES[type].label}</div>
          <input className="form-control" placeholder={TYPES[type].idLabel} value={username}
                 onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus ref={userRef} />
          <PasswordField placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <div style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</div>}
          <button className="btn btn-rose" type="submit">Login</button>
          {type === "PATIENT" && (
            <button className="btn btn-outline" type="button" onClick={() => choose("REGISTER")}>
              <i className="bi bi-person-plus" /> New patient? Create an account
            </button>
          )}
          {back}
        </form>
      )}
    </div>
  );
}
