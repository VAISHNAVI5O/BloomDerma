/* =========================================================
   BRIDGE: replaces the hard-coded demo arrays and in-memory
   actions of the original page with Spring Boot API calls.
   Classic script: shares globals (DOCTORS, PATIENTS, render...) with ui.js.
   Each module fails independently -> graceful "unavailable" state.
========================================================= */
const api = window.BloomApi;


function applyRoleUi() {
  const role = String(window.BloomApi?.getCurrentUser?.()?.role || "").toUpperCase();
  const doctor = role === "DOCTOR";
  const newAppointment = document.getElementById("navNewAppointment");
  if (newAppointment) newAppointment.style.display = doctor ? "none" : "";

  // Receptionists can use clinic revenue, but never see doctor-by-doctor revenue.
  // Doctors keep the revenue page for their own individual figures.
  const nav = document.getElementById("revenueNavLink");
  if (nav) nav.style.display = "";
}

function mapAppointment(a) {
  return { dbId: a.id, id: a.code, patientId: a.patientId, patient: a.patient, doctorId: a.doctorId,
           issue: a.issue, treatment: a.treatment, date: a.date, time: a.time, fee: a.fee,
           status: a.status, paid: a.paid, amountPaid: a.amountPaid, due: a.due, mode: a.mode };
}

async function loadAll() {
  const doctorUser = isDoctorUser();
  const [d, h, a, s, r, rv] = await Promise.allSettled([
    api.fetchDoctors(), api.fetchPatientHistory(), api.fetchAppointments(), api.fetchServices(),
    doctorUser ? api.fetchRevenue() : Promise.resolve(null), api.fetchReviews()]);
  if ([d, h, a, s].every(x => x.status === "rejected")) {
    showToast("API unavailable — check that the Spring Boot backend is running.");
  }
  const warn = (x, name) => x.status === "rejected" && showToast(name + " module unavailable.");
  warn(d, "Doctors"); warn(a, "Appointments"); warn(s, "Services"); warn(h, "Patients");

  DOCTORS = d.status === "fulfilled" ? d.value : [];
  SERVICES = s.status === "fulfilled" ? s.value : [];
  REVIEWS = rv.status === "fulfilled" ? rv.value : [];
  const appts = a.status === "fulfilled" ? a.value.map(mapAppointment) : [];   // doctors: own appointments only
  APPOINTMENTS = appts.filter(x => x.time);

  // Patient history = ALL patients and ALL visits (every role). Doctors receive it without fee/paid.
  PATIENTS = (h.status === "fulfilled" ? h.value : []).map(pt => ({
    ...pt,
    visits: (pt.visits || []).filter(v => v.status !== "Cancelled").map(v => ({
      date: v.date, doctorId: v.doctorId, issue: v.issue, treatment: v.treatment, fee: v.fee, paid: v.paid, amountPaid: v.amountPaid }))
  }));

  // Doctor revenue: built only from the doctor's OWN appointments (server-filtered by the login).
  REVENUE = r.status === "fulfilled" ? r.value : null;
  OWN_VISITS = doctorUser ? appts.filter(x => x.status !== "Cancelled").map(x => ({
    patient: patientForId(x.patientId) || { id: x.patientId, name: x.patient },
    date: x.date, doctorId: x.doctorId, issue: x.issue, treatment: x.treatment, fee: x.fee, paid: x.paid, amountPaid: x.amountPaid })) : [];

  fillPatientList();
  applyRoleUi();
  render();
}

function apiError(err) {
  return err.response?.data?.message || "Something went wrong. Please try again.";
}

/* ---- Cancel appointment ---- */
function cancelAppointment(id) {
  const appt = APPOINTMENTS.find(a => a.id === id);
  if (!appt) return;
  if (!cancelOpen(appt)) { showToast("The appointment time has arrived, so it can no longer be cancelled."); render(); return; }
  if (!confirm("Cancel this appointment?")) return;
  api.updateAppointmentStatus(appt.dbId, "Cancelled")
    .then(() => { showToast("Appointment cancelled."); return loadAll(); })
    .catch(e => showToast(apiError(e)));
}

/* ---- Add a visit from the patient page ---- */
function addVisit(patientId) {
  const patient = patientForId(patientId);
  const val = id => document.getElementById(id).value;
  const issue = val("newVisitIssue").trim(), treatment = val("newVisitTreatment").trim();
  const fee = Number(val("newVisitFee"));
  if (!issue || !treatment || !fee || fee <= 0) { showToast("Please complete the visit details."); return; }
  api.createAppointment({ patientId, patientName: patient.name, age: patient.age, gender: patient.gender,
      issue, treatment, doctorId: val("newVisitDoctor"), date: todayStr(), time: null, fee, status: "Completed" })
    .then(() => { showToast("New visit added to patient history."); return loadAll(); })
    .catch(e => showToast(apiError(e)));
}

/* ---- Past dates / times cannot be booked ----
   Local (clinic) date and time are used. The server rejects past bookings too; this keeps the form from offering them. */
function localToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function slotStart(date, slot) {                 // "2026-10-29" + "10:30 AM" -> Date (null when the slot text is not a time)
  const m = String(slot || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m || !date) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, Number(m[2]));
}
function slotPassed(date, slot) { const s = slotStart(date, slot); return !!s && s <= new Date(); }

/* replaces the original slot builder of ui.js: same list, minus the slots of today that are already over */
function updateDoctorSlots() {
  const doctorId = document.getElementById("appointmentDoctor").value;
  const slotSelect = document.getElementById("appointmentSlot");
  const info = document.getElementById("doctorInfo");
  const dateInput = document.getElementById("appointmentDate");
  dateInput.min = localToday();
  const previous = slotSelect.value;
  slotSelect.innerHTML = "";
  if (!doctorId) {
    slotSelect.innerHTML = `<option value="">Select doctor first</option>`;
    info.innerHTML = "Select a dermatologist to see their specialty and available slots.";
    return;
  }
  const doctor = findDoctor(doctorId);
  info.innerHTML = `<strong>${escapeHTML(doctor.name)}</strong><br>${escapeHTML(doctor.specialty)}<br><small>Available clinic slots are shown below.</small>`;
  const date = dateInput.value;
  const open = (doctor.slots || []).filter(s => !slotPassed(date, s));
  if (!open.length) {
    slotSelect.innerHTML = `<option value="">${date && date < localToday() ? "That date has already passed" : "No time slots left on this date"}</option>`;
    return;
  }
  open.forEach(slot => {
    const option = document.createElement("option");
    option.value = slot; option.textContent = slot;
    slotSelect.appendChild(option);
  });
  if (open.includes(previous)) slotSelect.value = previous;
}
document.getElementById("appointmentDate").addEventListener("change", updateDoctorSlots);   // re-check the slots when the day changes
/* when the form opens: earliest date = today (clinic's local date) and never pre-filled with a day that has passed */
const openAppointmentModalOriginal = openAppointmentModal;
openAppointmentModal = function () {
  openAppointmentModalOriginal.apply(this, arguments);
  const dateInput = document.getElementById("appointmentDate");
  dateInput.min = localToday();
  if (!dateInput.value || dateInput.value < dateInput.min) dateInput.value = dateInput.min;
  updateDoctorSlots();
};
document.getElementById("appointmentDoctor").addEventListener("change", updateDoctorSlots);

/* ---- New appointment form (capture phase: runs before the original handler) ---- */
document.addEventListener("submit", function (e) {
  if (e.target.id !== "appointmentForm") return;
  e.preventDefault(); e.stopImmediatePropagation();
  const val = id => document.getElementById(id).value.trim();
  const body = { patientId: val("appointmentPatientId"), patientName: val("appointmentPatientName"),
    age: Number(val("appointmentAge")), gender: val("appointmentGender"), issue: val("appointmentIssue"),
    doctorId: val("appointmentDoctor"), treatment: val("appointmentTreatment"),
    date: val("appointmentDate"), time: val("appointmentSlot"), fee: Number(val("appointmentFee")),
    status: "Confirmed" };
  if (!body.patientName || !body.age || !body.issue || !body.doctorId ||
      !body.treatment || !body.date || !body.time || body.fee < 0) {
    showToast("Please complete all required appointment fields."); return;
  }
  if (body.date < localToday()) { showToast("That date has already passed. Please choose today or a future date."); return; }
  if (slotPassed(body.date, body.time)) { showToast("That time has already passed. Please choose a later time slot."); return; }
  const form = e.target;
  api.createAppointment(body).then(created => {
    const doctor = findDoctor(body.doctorId);
    document.getElementById("successMessage").innerHTML = `
      <strong>${escapeHTML(body.patientName)}</strong><br>
      Patient ID: <strong>${escapeHTML(created.patientId || body.patientId)}</strong><br>
      ${doctor ? doctor.name : ""}<br>
      ${escapeHTML(body.treatment)}<br>
      ${prettyDate(body.date)} · ${body.time}<br>
      Consultation fee: <strong>${money(body.fee)}</strong>`;
    setupPaymentBox(created);
    closeModal("appointmentModal");
    setTimeout(() => document.getElementById("successModal").classList.add("show"), 180);
    form.reset();
    populateDoctorSelect();
    document.getElementById("appointmentSlot").innerHTML = `<option value="">Select doctor first</option>`;
    document.getElementById("doctorInfo").textContent =
      "Select a dermatologist to see their specialty and available slots.";
    document.getElementById("appointmentDate").value = localToday();
    showToast("Appointment added successfully.");
    return loadAll();
  }).catch(err => showToast(apiError(err)));
}, true);

/* Patient ID box: suggest existing patients and fill their details; blank = brand-new patient (ID generated by the server) */
function fillPatientList() {
  const list = document.getElementById("patientIdList");
  if (list) list.innerHTML = PATIENTS.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join("");
}
document.getElementById("appointmentPatientId").addEventListener("change", function () {
  const p = PATIENTS.find(x => x.id.toLowerCase() === this.value.trim().toLowerCase());
  if (!p) return;
  this.value = p.id;
  document.getElementById("appointmentPatientName").value = p.name || "";
  document.getElementById("appointmentAge").value = p.age || "";
  if (p.gender) document.getElementById("appointmentGender").value = p.gender;
});

/* After a confirmed booking the front desk chooses: paid in full / part paid (some due) / keep as due. */
function setupPaymentBox(created) {
  const box = document.getElementById("paymentBox");
  const result = document.getElementById("paymentResult");
  const btns = ["payPaidBtn", "payPartBtn", "payDueBtn"].map(id => document.getElementById(id));
  box.style.display = "";
  result.innerHTML = '<span style="color:var(--danger)">Status: Due (' + money(created.fee) + ')</span>';
  btns.forEach(b => { b.disabled = false; });
  btns[0].onclick = () => api.updateAppointmentPayment(created.id, true).then(() => {
    result.innerHTML = '<span style="color:#4f9c82">Paid in full</span>';
    return loadAll();
  }).catch(e => showToast(apiError(e)));
  btns[1].onclick = () => {
    closeModal("successModal");
    openPaymentModal({ dbId: created.id, id: created.code, patient: created.patient, fee: created.fee, amountPaid: 0 });
  };
  btns[2].onclick = () => api.updateAppointmentPayment(created.id, false).then(() => {
    result.innerHTML = '<span style="color:var(--danger)">Status: Due (' + money(created.fee) + ')</span>';
    return loadAll();
  }).catch(e => showToast(apiError(e)));
}

/* ---- Payment modal: paid in full / part paid (rest stays due) / not paid ---- */
function openPaymentModal(arg) {
  if (isDoctorUser()) { showToast("Only Admin or Receptionist can record payments."); return; }
  const a = typeof arg === "string" ? APPOINTMENTS.find(x => x.id === arg) : arg;
  if (!a) return;
  const modal = document.getElementById("paymentModal");
  modal.dataset.dbId = a.dbId; modal.dataset.fee = Number(a.fee || 0);
  const paid = paidOf(a);
  document.getElementById("payWho").textContent = a.patient || "";
  document.getElementById("payRef").textContent = (a.id || "") + (paid > 0 ? " · received so far " + money(paid) : "");
  document.getElementById("payFee").textContent = money(a.fee);
  const mode = dueOf(a) <= 0 ? "full" : paid > 0 ? "part" : "none";
  document.querySelectorAll('input[name="payMode"]').forEach(r => { r.checked = r.value === mode; });
  document.getElementById("payAmount").value = paid > 0 && dueOf(a) > 0 ? paid : "";
  paymentModeChanged();
  modal.classList.add("show");
}

function paymentModeChanged() {
  const modal = document.getElementById("paymentModal");
  const fee = Number(modal.dataset.fee || 0);
  const checked = document.querySelector('input[name="payMode"]:checked');
  const mode = checked ? checked.value : "";
  document.getElementById("payPartField").style.display = mode === "part" ? "" : "none";
  const text = document.getElementById("payDueText");
  if (mode === "full") text.textContent = money(0);
  else if (mode === "none") text.textContent = money(fee);
  else if (mode === "part") {
    const amt = Number(document.getElementById("payAmount").value || 0);
    text.textContent = amt > 0 && amt <= fee ? money(fee - amt) : "Enter 1 – " + fee;
  } else text.textContent = "—";
}

function savePayment() {
  const modal = document.getElementById("paymentModal");
  const dbId = modal.dataset.dbId, fee = Number(modal.dataset.fee || 0);
  const checked = document.querySelector('input[name="payMode"]:checked');
  if (!checked) { showToast("Choose how much the patient has paid."); return; }
  let call;
  if (checked.value === "full") call = api.updateAppointmentPayment(dbId, true);
  else if (checked.value === "none") call = api.updateAppointmentPayment(dbId, false);
  else {
    const amt = Number(document.getElementById("payAmount").value || 0);
    if (!(amt > 0) || amt > fee) { showToast("Enter an amount between 1 and " + fee + "."); return; }
    call = api.updateAppointmentAmountPaid(dbId, amt);
  }
  call.then(() => { closeModal("paymentModal"); showToast("Payment saved."); return loadAll(); })
      .catch(e => showToast(apiError(e)));
}

/* ---- Doctor: join the video call of a consultation (patient/doctor video lives in services/videoCall.js) ---- */
function joinVideoCall(dbId, patientName) {
  const appt = APPOINTMENTS.find(x => x.dbId === dbId);
  if (appt && !videoJoinOpen(appt)) { showToast("This video call can no longer be joined (closed 1 hour after the consultation time)."); render(); return; }
  if (window.BloomVideo) window.BloomVideo(dbId, "Video consultation with " + patientName);
}

/* ---- Reports, recovery and portal login of a patient (shown on the patient page for staff + doctors) ---- */
async function hydratePatientExtras() {
  const box = document.getElementById("patientExtras");
  if (!box || box.dataset.loaded) return;
  box.dataset.loaded = "1";
  const id = box.dataset.patient;
  const [rep, rec, acc, pho, rvs] = await Promise.allSettled([
    api.patientReports(id), api.patientRecovery(id), isDoctorUser() ? Promise.resolve(null) : api.patientAccount(id), api.patientPhotos(id),
    api.patientRevisits(id)]);
  const revisitList = rvs.status === "fulfilled" ? rvs.value : [];
  const photoSets = pho.status === "fulfilled" ? pho.value : [];
  const reports = rep.status === "fulfilled" ? rep.value : [];
  const logs = rec.status === "fulfilled" ? rec.value : [];
  const panel = (icon, title, body) =>
    '<div class="panel" style="margin-bottom:22px"><div class="panel-head"><h2><i class="bi ' + icon + '"></i> ' + title + '</h2></div>' + body + '</div>';

  let html = "";
  if (isDoctorUser()) {
    const pid = escapeHTML(id);
    html += panel("bi-stars", "Create report for this patient",
      '<div class="report-form">' +
        '<div class="field"><label>Keywords (symptoms, findings, diagnosis)</label>' +
          '<textarea id="rptKeywords" maxlength="1500" placeholder="e.g. acne on cheeks, oily skin, post-acne marks, itching at night"></textarea></div>' +
        '<div class="field"><label>Prescription (one medicine per line)</label>' +
          '<textarea id="rptPrescription" maxlength="3000" placeholder="Tab. Doxycycline 100 mg - 1 tablet twice daily after food for 14 days&#10;Adapalene 0.1% gel - apply a pea-sized amount at night"></textarea></div>' +
        '<div class="report-actions"><button class="btn btn-rose" id="rptGenerate" type="button" onclick="generateReportDraft(\'' + pid + '\')">' +
          '<i class="bi bi-stars"></i> Generate report</button>' +
          '<small style="color:var(--ink-soft)">You can review and edit the report before it is saved to the patient\'s account.</small></div>' +
        '<div id="rptDraftBox" style="display:none;gap:12px;">' +
          '<div class="alert alert-info" id="rptNote"></div>' +
          '<div class="field"><label>Report text (editable)</label><textarea id="rptText" class="report-draft" maxlength="12000"></textarea></div>' +
          '<div class="report-actions"><button class="btn btn-rose" id="rptSave" type="button" onclick="saveGeneratedReport(\'' + pid + '\')">' +
            '<i class="bi bi-file-earmark-pdf"></i> Save as PDF to patient\'s account</button>' +
            '<button class="btn btn-outline" type="button" onclick="generateReportDraft(\'' + pid + '\')">Regenerate</button></div>' +
        '</div>' +
      '</div>');
  }

  html += revisitPanel(id, revisitList, panel);

  html += panel("bi-file-earmark-medical", "Reports on the patient's account", reports.length
    ? '<div class="table-wrap"><table><thead><tr><th>Title</th><th>Source</th><th>Uploaded</th><th></th></tr></thead><tbody>' +
      reports.map(r => '<tr><td><strong>' + escapeHTML(r.title) + '</strong><br><small>' + escapeHTML(r.fileName) + '</small></td><td>' +
        (r.createdBy ? '<span class="badge badge-doctor">Prepared by ' + escapeHTML(r.createdBy) + '</span>' : '<span class="badge badge-blue">Patient upload</span>') +
        '</td><td>' + prettyDate((r.uploadedAt || "").slice(0, 10)) + '</td><td><button class="btn btn-outline btn-sm" onclick="viewPatientReport(\'' +
        escapeHTML(id) + '\',' + r.id + ')"><i class="bi bi-eye"></i> View</button></td></tr>').join("") + '</tbody></table></div>'
    : '<div class="empty">No reports on this patient\'s account yet.</div>');

  html += panel("bi-images", "Before &amp; after photos", photoSets.length
    ? '<div class="photo-grid">' + photoSets.map(p => {
        const cell = (side, label, on) => '<div class="photo-cell"><small>' + label + (on ? ' · ' + prettyDate(on) : '') + '</small>' +
          '<img class="photo-img" alt="' + label + '" data-src="/patients/' + escapeHTML(id) + '/photos/' + p.id + '/' + side +
          '" data-title="' + escapeHTML(p.caption) + ' - ' + label.toLowerCase() + '" onclick="viewProtected(this)"></div>';
        return '<div class="photo-card"><div class="photo-card-head"><span translate="no">' + escapeHTML(p.caption) + '</span></div><div class="photo-pair">' +
          cell("before", "Before", p.beforeOn) +
          (p.hasAfter ? cell("after", "After", p.afterOn) : '<div class="photo-cell"><small>After</small><div class="photo-missing">Not added yet</div></div>') +
          '</div></div>';
      }).join("") + '</div>'
    : '<div class="empty">The patient has not added any before / after photos.</div>');

  html += panel("bi-graph-up-arrow", "Recovery check-ins", logs.length
    ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Score</th><th>Symptoms</th><th>Notes</th></tr></thead><tbody>' +
      [...logs].reverse().map(l => '<tr><td>' + prettyDate(l.logDate) + '</td><td>' + l.score + '/10</td><td translate="no">' +
        escapeHTML(l.symptoms || "—") + '</td><td translate="no">' + escapeHTML(l.notes || "—") + '</td></tr>').join("") + '</tbody></table></div>'
    : '<div class="empty">No recovery check-ins yet.</div>');

  if (!isDoctorUser() && acc.status === "fulfilled" && acc.value) {
    html += panel("bi-person-lock", "Patient portal login", acc.value.exists
      ? '<div style="padding:16px 18px">This patient can log in with username <strong>' + escapeHTML(acc.value.username) + '</strong>.</div>'
      : '<form style="padding:16px 18px" onsubmit="return createPortalLogin(event, \'' + escapeHTML(id) + '\')">' +
        '<div class="form-grid"><div class="field"><label>Username</label><input id="portalUser" minlength="3" maxlength="30" required></div>' +
        '<div class="field"><label>Password (min. 8, Aa 1 @)</label><div class="pw-wrap"><input id="portalPass" type="password" minlength="8" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9 ]).{8,72}" title="At least 8 characters with an uppercase letter, a lowercase letter, a digit and a special character" required autocomplete="new-password"><button type="button" class="pw-toggle" onclick="togglePw(\'portalPass\')" title="Show / hide password" aria-label="Show or hide password"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div></div>' +
        '<button class="btn btn-rose" type="submit" style="margin-top:12px"><i class="bi bi-person-plus"></i> Create portal login</button></form>');
  }
  box.innerHTML = html;
  loadProtectedImages(box);
}

/* ---- Revisit suggestion: the doctor suggests a follow-up; the patient is notified but chooses whether to book ---- */
const REVISIT_STATUS = { ACTIVE: "Sent - waiting for the patient", BOOKED: "Patient booked a visit",
  DISMISSED: "Patient chose not to book now", REPLACED: "Replaced by a newer suggestion" };

function revisitPanel(id, list, panel) {
  const history = list.length
    ? '<div class="table-wrap"><table><thead><tr><th>Suggested</th><th>Around</th><th>Doctor</th><th>Note</th><th>Status</th></tr></thead><tbody>' +
      list.map(r => '<tr><td>' + prettyDate((r.createdAt || "").slice(0, 10)) + '</td><td>' + prettyDate(r.date) + '</td><td>' + escapeHTML(r.doctorName || "") +
        '</td><td translate="no">' + escapeHTML(r.note || "—") + '</td><td>' + escapeHTML(REVISIT_STATUS[r.status] || r.status) + '</td></tr>').join("") +
      '</tbody></table></div>'
    : '<div class="empty">No revisit has been suggested to this patient yet.</div>';
  if (!isDoctorUser()) return panel("bi-arrow-repeat", "Revisit suggestions", history);
  const form =
    '<div class="report-form">' +
      '<div class="form-grid">' +
        '<div class="field"><label>Come back after</label><select id="revisitPreset" onchange="revisitPresetChanged()">' +
          '<option value="7">1 week</option><option value="14">2 weeks</option><option value="30" selected>1 month</option>' +
          '<option value="60">2 months</option><option value="90">3 months</option><option value="180">6 months</option>' +
          '<option value="">Choose a date…</option></select></div>' +
        '<div class="field"><label>Around this date</label><input type="date" id="revisitDate" min="' + revisitDateAfter(1) + '" value="' + revisitDateAfter(30) + '"></div>' +
        '<div class="field full"><label>Note for the patient (optional)</label><input id="revisitNote" maxlength="300" placeholder="e.g. Review of the acne treatment"></div>' +
      '</div>' +
      '<div class="report-actions"><button class="btn btn-rose" type="button" onclick="submitRevisit(\'' + escapeHTML(id) + '\')"><i class="bi bi-bell"></i> Notify patient</button>' +
        '<small style="color:var(--ink-soft)">The patient sees a notice in the portal and decides whether to book - nothing is booked automatically.</small></div>' +
    '</div>';
  return panel("bi-arrow-repeat", "Suggest a revisit", form + history);
}

function revisitDateAfter(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function revisitPresetChanged() {
  const days = document.getElementById("revisitPreset").value;
  if (days) document.getElementById("revisitDate").value = revisitDateAfter(Number(days));
}
function submitRevisit(patientId) {
  const date = document.getElementById("revisitDate").value;
  if (!date || date < revisitDateAfter(1)) { showToast("Choose a revisit date after today."); return; }
  api.suggestRevisit(patientId, { date, note: document.getElementById("revisitNote").value.trim() })
    .then(() => { showToast("The patient has been notified. They can choose whether to book."); document.getElementById("patientExtras").dataset.loaded = ""; return hydratePatientExtras(); })
    .catch(e => showToast(apiError(e)));
}

/* ---- Doctor: keywords + prescription -> editable report -> PDF on the patient's account ---- */
function generateReportDraft(patientId) {
  const keywords = document.getElementById("rptKeywords").value.trim();
  const prescription = document.getElementById("rptPrescription").value.trim();
  if (!keywords || !prescription) { showToast("Please enter the keywords and the prescription."); return; }
  const btn = document.getElementById("rptGenerate");
  btn.disabled = true; btn.innerHTML = "Generating…";
  api.reportDraft(patientId, { keywords, prescription }).then(res => {
    document.getElementById("rptText").value = res.text;
    const note = document.getElementById("rptNote");
    note.className = "alert " + (res.aiUsed ? "alert-success" : "alert-warning");
    note.textContent = res.note || "";
    document.getElementById("rptDraftBox").style.display = "grid";
  }).catch(e => showToast(apiError(e)))
    .finally(() => { btn.disabled = false; btn.innerHTML = '<i class="bi bi-stars"></i> Generate report'; });
}

function saveGeneratedReport(patientId) {
  const text = document.getElementById("rptText").value.trim();
  if (!text) { showToast("The report is empty."); return; }
  const btn = document.getElementById("rptSave");
  btn.disabled = true;
  api.reportSaveGenerated(patientId, text).then(() => {
    showToast("Report saved to the patient's account as a PDF.");
    const box = document.getElementById("patientExtras");
    box.dataset.loaded = "";
    return hydratePatientExtras();
  }).catch(e => { btn.disabled = false; showToast(apiError(e)); });
}

/* <img data-src="/api-path"> cannot send the login token, so the picture is downloaded with it and then shown */
function loadProtectedImages(root) {
  root.querySelectorAll("img[data-src]").forEach(img => {
    api.fetchBlob(img.dataset.src)
      .then(b => { img.src = URL.createObjectURL(b); })
      .catch(() => { const d = document.createElement("div"); d.className = "photo-missing"; d.textContent = "Photo unavailable"; img.replaceWith(d); });
  });
}
function viewProtected(img) { api.openProtectedFile(img.dataset.src, img.dataset.title); }

/* show / hide a password box */
function togglePw(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

/* Admin: remove an inappropriate public review */
function deleteReviewAdmin(id) {
  if (!confirm("Remove this review for everyone?")) return;
  api.deleteReview(id).then(() => { showToast("Review removed."); return loadAll(); }).catch(e => showToast(apiError(e)));
}

function viewPatientReport(patientId, reportId) {
  api.openProtectedFile("/patients/" + patientId + "/reports/" + reportId + "/file").catch(e => showToast(apiError(e)));
}

function createPortalLogin(event, patientId) {
  event.preventDefault();
  api.createPatientAccount(patientId, {
    username: document.getElementById("portalUser").value.trim(),
    password: document.getElementById("portalPass").value
  }).then(() => { showToast("Portal login created."); document.getElementById("patientExtras").dataset.loaded = ""; return hydratePatientExtras(); })
    .catch(e => showToast(apiError(e)));
  return false;
}

// the page content is re-rendered on every navigation: load the extras whenever the placeholder appears
if (typeof MutationObserver !== "undefined") {
  new MutationObserver(() => hydratePatientExtras()).observe(document.getElementById("app"), { childList: true, subtree: false });
}

/* ---- Automatic doctor suggestion (speciality matching, done by the backend) ---- */
let suggestSeq = 0;
async function refreshDoctorSuggestions() {
  const select = document.getElementById("appointmentDoctor");
  const info = document.getElementById("doctorInfo");
  const concern = document.getElementById("appointmentIssue").value;
  const treatment = document.getElementById("appointmentTreatment").value;
  const previous = select.value;
  if (!concern && !treatment) { populateDoctorSelect(); select.value = previous; updateDoctorSlots(); return; }

  const seq = ++suggestSeq;
  let res;
  let usedFallback = false;
  try {
    res = await api.fetchDoctorSuggestions(concern, treatment);
  } catch (suggestionError) {
    // The suggestion endpoint may fail on an older database or while the
    // speciality mapping is being upgraded. Keep booking usable by loading
    // the full doctor list instead of leaving the select empty.
    try {
      const allDoctors = await api.fetchDoctors();
      res = {
        doctors: allDoctors || [],
        mapped: false,
        message: "Showing all available doctors because specialty suggestions could not be loaded."
      };
      usedFallback = true;
    } catch (doctorError) {
      if (seq !== suggestSeq) return;
      if (Array.isArray(DOCTORS) && DOCTORS.length) {       // last resort: doctors already loaded when the page started
        res = { doctors: DOCTORS, mapped: false, message: "Showing all available doctors." };
        usedFallback = true;
      } else {
      select.innerHTML = `<option value="">Doctors could not be loaded — check the backend</option>`;
      info.textContent = "Could not load doctors. Please check that the backend and database are running, then reopen this form.";
      showToast(apiError(doctorError));
      return;
      }
    }
  }
  if (seq !== suggestSeq) return;                       // a newer selection superseded this answer

  const doctors = res.doctors || [];
  const options = doctors.length
    ? `<option value="">Select doctor</option>` + doctors.map(x =>
        `<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)} — ${escapeHTML(x.specialty)}</option>`).join("")
    : `<option value="">No matching doctor available</option>`;
  select.innerHTML = options;
  if (doctors.some(x => x.id === previous)) select.value = previous;
  updateDoctorSlots();                                  // resets the slot list for the (possibly cleared) doctor

  if (!select.value) {
    info.innerHTML = `<strong>${escapeHTML(res.message || "")}</strong>` +
      (doctors.length ? `<br><small>${doctors.length} doctor(s) available — please select one.</small>` : "");
  }
  if (usedFallback) {
    // A fallback is not a booking failure: doctors are still selectable.
    console.warn("BloomDerma: specialty suggestions unavailable; showing all doctors.");
  }
}

["appointmentIssue", "appointmentTreatment"].forEach(id =>
  document.getElementById(id).addEventListener("change", refreshDoctorSuggestions));

/* ---- Add Doctor (Admin only; backend creates the doctor AND the login) ---- */
async function openDoctorModal() {
  if (!isAdminUser()) { showToast("Only an Admin can add doctors."); return; }
  const select = document.getElementById("doctorSpeciality");
  try {
    const names = await api.fetchSpecialities();
    select.innerHTML = `<option value="">Select speciality</option>` +
      names.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join("");
  } catch (e) { showToast(apiError(e)); return; }
  document.getElementById("doctorModal").classList.add("show");
}

document.addEventListener("submit", function (e) {
  if (e.target.id !== "doctorForm") return;
  e.preventDefault();
  const val = id => document.getElementById(id).value.trim();
  const body = { name: val("doctorName"), id: val("doctorLoginId"), password: document.getElementById("doctorPassword").value,
    specialty: val("doctorSpeciality"), phone: val("doctorPhone"), email: val("doctorEmail"),
    videoFee: val("doctorVideoFee") === "" ? null : Number(val("doctorVideoFee")) };
  if (!body.name || !body.id || !body.password || !body.specialty) { showToast("Please complete all required doctor fields."); return; }
  const form = e.target;
  api.createDoctor(body).then(() => {
    closeModal("doctorModal");
    form.reset();
    showToast("Doctor " + body.name + " added. They can log in with Doctor ID " + body.id + ".");
    return loadAll();
  }).catch(err => showToast(apiError(err)));
});

loadAll();
