// MODULE V — Axios service layer. Every HTTP call to Spring Boot lives here.
import axios from "axios";

const TOKEN_KEY = "bloomderma_token";

// The sign-in page is ALWAYS the first page. A login only lives in this browser tab (sessionStorage):
//  - opening the site (typing the address / clicking a link / new tab) -> sign-in page
//  - pressing F5 (reload) inside the app -> you stay signed in
// A token left behind by older versions in localStorage is removed.
try {
  localStorage.removeItem(TOKEN_KEY);
  const nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  if (nav && nav.type === "navigate") sessionStorage.removeItem(TOKEN_KEY);
} catch { /* storage not available */ }

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t);
export const logout = () => { sessionStorage.removeItem(TOKEN_KEY); window.location.hash = ""; window.location.reload(); };

export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { username: payload.sub || "", role: payload.role || "", doctorId: payload.doctorId || null, patientId: payload.patientId || null };
  } catch {
    return null;
  }
}

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

// JWT: attach "Authorization: Bearer <token>" to every request
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// 401 = token missing/expired -> back to login
http.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && getToken()) logout();
  return Promise.reject(err);
});

const data = (p) => p.then((r) => r.data);

export const login = (username, password, loginType) => data(http.post("/auth/login", { username, password, loginType }));

export const fetchDashboardStats = () => data(http.get("/dashboard/stats"));

export const fetchPatients = () => data(http.get("/patients"));
export const fetchPatientHistory = () => data(http.get("/patients/history"));
export const fetchPatientById = (id) => data(http.get(`/patients/${id}`));
export const createPatient = (body) => data(http.post("/patients", body));
export const updatePatient = (id, body) => data(http.put(`/patients/${id}`, body));
export const deletePatient = (id) => http.delete(`/patients/${id}`);

export const fetchAppointments = () => data(http.get("/appointments"));
export const createAppointment = (body) => data(http.post("/appointments", body));
export const updateAppointment = (id, body) => data(http.put(`/appointments/${id}`, body));
export const updateAppointmentStatus = (id, value) =>
  data(http.patch(`/appointments/${id}/status`, null, { params: { value } }));
// Payment: paid=true (all paid) | paid=false (all due) | amount=N (part payment, the rest stays due)
export const updateAppointmentPayment = (id, paid) =>
  data(http.patch(`/appointments/${id}/payment`, null, { params: { paid } }));
export const updateAppointmentAmountPaid = (id, amount) =>
  data(http.patch(`/appointments/${id}/payment`, null, { params: { amount } }));
export const deleteAppointment = (id) => http.delete(`/appointments/${id}`);

export const fetchDoctors = () => data(http.get("/doctors"));
export const fetchSpecialities = () => data(http.get("/doctors/specialities"));
export const fetchDoctorSuggestions = (concern, treatment) =>
  data(http.get("/doctors/suggestions", { params: { concern: concern || "", treatment: treatment || "" } }));
export const createDoctor = (body) => data(http.post("/doctors", body));
// Used by the login page: the Admin's token is passed explicitly and is never stored.
export const createDoctorAs = (token, body) =>
  data(http.post("/doctors", body, { headers: { Authorization: `Bearer ${token}` } }));
export const updateDoctor = (id, body) => data(http.put(`/doctors/${id}`, body));
export const deleteDoctor = (id) => http.delete(`/doctors/${id}`);

export const fetchServices = () => data(http.get("/services"));
export const createService = (body) => data(http.post("/services", body));

export const fetchRevenue = () => data(http.get("/revenue"));

// ---------- Patient portal (role PATIENT) ----------
export const registerPatient = (body) => data(http.post("/auth/register", body));
export const portalMe = () => data(http.get("/portal/me"));
export const portalFees = () => data(http.get("/portal/fees"));
export const portalAppointments = () => data(http.get("/portal/appointments"));
export const portalAvailability = (doctorId, date) => data(http.get("/portal/availability", { params: { doctorId, date } }));
export const portalBook = (body) => data(http.post("/portal/appointments", body));
export const portalPay = (id, body) => data(http.post(`/portal/appointments/${id}/pay`, body));
export const portalCancel = (id) => data(http.patch(`/portal/appointments/${id}/cancel`));
// Revisit notices: the doctor suggests, the patient decides (book or dismiss)
export const portalRevisits = () => data(http.get("/portal/revisits"));
export const portalDismissRevisit = (id) => http.post(`/portal/revisits/${id}/dismiss`);
export const portalBills = () => data(http.get("/portal/bills"));
export const portalReports = () => data(http.get("/portal/reports"));
export const portalUploadReport = (file, title) => {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  return data(http.post("/portal/reports", form));
};
export const portalDeleteReport = (id) => http.delete(`/portal/reports/${id}`);
export const portalPhotos = () => data(http.get("/portal/photos"));
export const portalAddPhotos = (caption, before, after) => {
  const form = new FormData();
  form.append("caption", caption); form.append("before", before);
  if (after) form.append("after", after);
  return data(http.post("/portal/photos", form));
};
export const portalAddAfterPhoto = (id, after) => {
  const form = new FormData(); form.append("after", after);
  return data(http.post(`/portal/photos/${id}/after`, form));
};
export const portalDeletePhotos = (id) => http.delete(`/portal/photos/${id}`);
export const fetchReviews = () => data(http.get("/reviews"));
export const portalAddReview = (body) => data(http.post("/portal/reviews", body));
export const portalDeleteReview = (id) => http.delete(`/portal/reviews/${id}`);
export const deleteReview = (id) => http.delete(`/reviews/${id}`);          // Admin moderation
export const patientPhotos = (id) => data(http.get(`/patients/${id}/photos`));
export const portalRecovery = () => data(http.get("/portal/recovery"));
export const portalAddRecovery = (body) => data(http.post("/portal/recovery", body));
export const portalDeleteRecovery = (id) => http.delete(`/portal/recovery/${id}`);

// Protected files need the Authorization header, so they cannot be plain links / <img src>.
export const fetchBlob = (url) => http.get(url, { responseType: "blob" }).then((r) => r.data);

// Show a protected file in an in-page viewer (a popup window would be blocked by the browser after an async download)
export async function openProtectedFile(url, title) {
  const { openFileViewer } = await import("./fileViewer.js");
  return openFileViewer(url, title);
}

// ---------- Staff / doctor view of a patient's portal data ----------
export const patientReports = (id) => data(http.get(`/patients/${id}/reports`));
// Doctor: AI-written report (draft first, then save as a PDF on the patient's account)
export const reportDraft = (patientId, body) => data(http.post(`/patients/${patientId}/reports/draft`, body));
export const reportSaveGenerated = (patientId, text) => data(http.post(`/patients/${patientId}/reports/generated`, { text }));
export const patientRevisits = (id) => data(http.get(`/patients/${id}/revisits`));
export const suggestRevisit = (id, body) => data(http.post(`/patients/${id}/revisits`, body));
export const patientRecovery = (id) => data(http.get(`/patients/${id}/recovery`));
export const patientAccount = (id) => data(http.get(`/patients/${id}/account`));
export const createPatientAccount = (id, body) => data(http.post(`/patients/${id}/account`, body));

// ---------- Video call signalling ----------
export const videoJoin = (id) => data(http.post(`/video/${id}/join`));
export const videoSignal = (id, type, payload) => data(http.post(`/video/${id}/signal`, { type, payload }));
export const videoPoll = (id, since) => data(http.get(`/video/${id}/signal`, { params: { since } }));
