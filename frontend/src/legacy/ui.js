
/* =========================================================
   BLOOMDERMA APPLICATION
========================================================= */


/* =========================================================
   UTILITIES
========================================================= */

function todayStr() {

  const d = new Date();

  return d.toISOString().slice(0,10);

}


function daysAgo(number) {

  const d = new Date();

  d.setDate(d.getDate() - number);

  return d.toISOString().slice(0,10);

}


function prettyDate(date) {

  if (!date) return "—";

  return new Date(date + "T00:00:00")
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

}


function money(value) {

  return "₹" + Number(value || 0)
    .toLocaleString("en-IN");

}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function initials(name) {

  return name
    .replace("Dr. ", "")
    .split(" ")
    .slice(0,2)
    .map(x => x[0])
    .join("")
    .toUpperCase();

}


/* =========================================================
   DOCTOR DATA
========================================================= */

let DOCTORS = [];  // filled from Spring Boot API (see overrides.js)

function currentUser() {
  return window.BloomApi?.getCurrentUser?.() || null;
}

function currentRole() {
  return String(currentUser()?.role || "").toUpperCase();
}

function isDoctorUser() {
  return currentRole() === "DOCTOR";
}

function isReceptionistUser() {
  return currentRole() === "RECEPTIONIST";
}

/* ---- payments: a visit can be Paid, Partial (some amount still due) or Due ---- */
function paidOf(v) {
  const fee = Number(v.fee || 0);
  if (v.paid) return fee;
  return Math.max(0, Math.min(Number(v.amountPaid || 0), fee));
}
function dueOf(v) { return Number(v.fee || 0) - paidOf(v); }
function payBadge(v) {
  const due = dueOf(v);
  if (due <= 0) return `<span class="badge badge-success">Paid</span>`;
  if (paidOf(v) > 0) return `<span class="badge badge-warning">Partial · ${money(due)} due</span>`;
  return `<span class="badge badge-danger">Due</span>`;
}

function isAdminUser() {
  return currentRole() === "ADMIN";
}

/* The logged-in doctor comes from the login token (doctorId claim), never from a selector. */
function currentDoctor() {
  const user = currentUser();
  if (!user || String(user.role || "").toUpperCase() !== "DOCTOR") return null;
  return DOCTORS.find(d => d.id === user.doctorId) || null;
}

/* Doctors: only their own appointments (the API also returns only their own). */
function visibleAppointments() {
  if (isDoctorUser()) {
    const doctor = currentDoctor();
    return doctor ? APPOINTMENTS.filter(a => a.doctorId === doctor.id) : [];
  }
  return APPOINTMENTS;
}

/* Doctors: only their own billed visits (used for revenue). Patient history is separate (PATIENTS). */
let REVIEWS = [];        // public patient reviews (everyone can read them)
let OWN_VISITS = [];     // filled in overrides.js from the doctor's own appointments
let REVENUE = null;      // doctor's own revenue summary from GET /api/revenue
function visibleVisits() {
  if (isDoctorUser()) return OWN_VISITS;
  return allVisits();
}


function findDoctor(id) {

  return DOCTORS.find(d => d.id === id);

}


/* =========================================================
   PATIENT DATA
========================================================= */

let PATIENTS = [];  // filled from Spring Boot API (see overrides.js)


/* =========================================================
   APPOINTMENTS
========================================================= */

/* Video calls can be joined on the day of the consultation, up to 1 hour after the booked time. */
/* Staff (Admin / Receptionist / Doctor) can cancel until the appointment time arrives; after that the button is hidden. */
function cancelOpen(a) {
  const n = new Date();
  const today = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  if (a.date !== today) return a.date > today;
  const m = String(a.time || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return true;
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate(), Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0), Number(m[2]));
  return n < start;
}

function videoJoinOpen(a) {
  const n = new Date();
  const today = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  if (a.date !== today) return false;
  const m = String(a.time || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return true;
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate(), Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0), Number(m[2]));
  return n - start <= 60 * 60000;
}

let APPOINTMENTS = [];  // filled from Spring Boot API (see overrides.js)


/* =========================================================
   FLATTEN VISITS
========================================================= */

function allVisits() {

  const result = [];

  PATIENTS.forEach(patient => {

    patient.visits.forEach(visit => {

      result.push({
        patient,
        ...visit
      });

    });

  });

  return result;

}


function lastVisit(patient) {

  return [...patient.visits]
    .sort((a,b) => b.date.localeCompare(a.date))[0];

}


function patientForId(id) {

  return PATIENTS.find(p => p.id === id);

}


/* =========================================================
   ROUTER
========================================================= */

function currentRoute() {

  return window.location.hash.replace(/^#/, "") || "/";

}


function setNav(route) {

  document.querySelectorAll("[data-route]")
    .forEach(link => {

      link.classList.toggle(
        "current",
        link.dataset.route === route
      );

    });

}


function render() {

  const route = currentRoute();

  const app = document.getElementById("app");

  if (route.startsWith("/patient/")) {

    setNav("/patients");

    const id = route.split("/patient/")[1];

    app.innerHTML = patientDetailView(id);

    return;
  }


  switch(route) {

    case "/appointments":

      setNav("/appointments");

      app.innerHTML = appointmentsView();

      break;


    case "/patients":

      setNav("/patients");

      app.innerHTML = patientsView();

      break;


    case "/doctors":

      setNav("/doctors");

      app.innerHTML = doctorsView();

      break;


    case "/services":

      setNav("/services");

      app.innerHTML = servicesView();

      break;


    case "/revenue":

      setNav("/revenue");

      app.innerHTML = revenueView();

      break;

    case "/reviews":
      setNav("/reviews");
      app.innerHTML = reviewsView();
      break;



    default:

      setNav("/");

      app.innerHTML = dashboardView();

  }

}


window.addEventListener("hashchange", render);


/* =========================================================
   DASHBOARD
========================================================= */

/* =========================================================
   POPULAR SKIN TREATMENTS (dashboard section)
   Ranked by how often each treatment appears in visit history;
   ties fall back to a default popularity order (laser first).
========================================================= */

function popularTreatmentsSection() {

  if (!SERVICES.length) return "";

  const defaultOrder = [
    "Laser Treatment", "Acne Care", "Chemical Peel", "Pigmentation",
    "Microneedling", "Skin Rejuvenation", "Hair & Scalp", "Tattoo Removal"
  ];

  const counts = {};
  visibleVisits().forEach(v => {
    counts[v.treatment] = (counts[v.treatment] || 0) + 1;
  });

  const rank = name => {
    const i = defaultOrder.indexOf(name);
    return i === -1 ? defaultOrder.length : i;
  };

  const top = [...SERVICES]
    .sort((a, b) =>
      (counts[b.name] || 0) - (counts[a.name] || 0) ||
      rank(a.name) - rank(b.name))
    .slice(0, 4);

  return `

    <h2 style="
      font-size:1.05rem;
      margin:0 0 12px;
    ">
      Popular skin treatments
    </h2>

    <div class="service-grid" style="margin-bottom:22px;">

      ${top.map(service => `

        <div class="service-card">

          <div class="service-icon">
            <i class="bi ${service.icon}"></i>
          </div>

          <h3>${service.name}</h3>

          <p>
            ${service.description}
            <br>
            <strong>
              ${counts[service.name] || 0} visits
              ${service.price ? " · " + money(service.price) : ""}
            </strong>
          </p>

          ${isDoctorUser() ? "" : `
          <button
            class="btn btn-outline btn-sm"
            onclick="openAppointmentModal('', '${service.name}')">

            <i class="bi bi-calendar-plus"></i>
            Book

          </button>`}

        </div>

      `).join("")}

    </div>

  `;
}


function dashboardView() {

  const visits = visibleVisits();

  const todayVisits =
    visits.filter(v => v.date === todayStr());

  const todayRevenue =
    todayVisits.reduce(
      (sum,v) => sum + Number(v.fee || 0),
      0
    );

  const confirmed =
    visibleAppointments().filter(
      a => a.date === todayStr() &&
           a.status !== "Cancelled"
    ).length;


  return `

    <div class="hero">

      <div>

        <h1>
          Good day at the clinic
        </h1>

        <p>
          A unified dermatology management dashboard
          for appointments, patients, doctors, services
          and clinic finances.
        </p>

      </div>

      <span class="pill">

        <i class="bi bi-calendar-heart"></i>

        &nbsp;

        ${new Date().toLocaleDateString(
          "en-IN",
          {
            weekday:"long",
            day:"numeric",
            month:"long",
            year:"numeric"
          }
        )}

      </span>

    </div>


    <div class="stat-grid">

      ${statCard(
        "bi-people-fill",
        "#E88AA7",
        "Patients on record",
        PATIENTS.length,
        "Demo patient records"
      )}

      ${statCard(
        "bi-calendar-check-fill",
        "#8768B3",
        "Today's appointments",
        confirmed,
        "Scheduled today"
      )}

      ${statCard(
        "bi-cash-coin",
        "#4F9C82",
        "Today's revenue",
        money(todayRevenue),
        isDoctorUser() ? "Your billed visits" : "Billed from visits"
      )}

      ${statCard(
        "bi-person-badge-fill",
        "#E39A4A",
        "Dermatologists",
        DOCTORS.length,
        "Across specialties"
      )}

    </div>


    <h2 style="
      font-size:1.05rem;
      margin:0 0 12px;
    ">
      Quick access
    </h2>


    <div class="quick-grid">

      ${quickCard(
        "#/appointments",
        "bi-calendar2-check-fill",
        "Appointments",
        "Manage your schedule, statuses and cancellations.",
        "#E88AA7",
        "Open appointments"
      )}

      ${quickCard(
        "#/patients",
        "bi-people-fill",
        "Patients & history",
        "Search patients and open detailed visit histories.",
        "#8768B3",
        "Open patients"
      )}

      ${quickCard(
        "#/doctors",
        "bi-heart-pulse-fill",
        "Doctors",
        "View dermatologist specialties and patient workload.",
        "#4F9C82",
        "View doctors"
      )}

      ${quickCard(
        "#/revenue",
        "bi-graph-up-arrow",
        "Revenue & stats",
        isDoctorUser() ? "Review your billed, collected and pending amounts." : "Review billed, collected and pending amounts.",
        "#E39A4A",
        "View analytics"
      )}

    </div>


    ${popularTreatmentsSection()}


    <div class="panel">

      <div class="panel-head">

        <h2>
          <i class="bi bi-calendar-event"></i>
          Today's appointments
        </h2>

        <a
          class="btn btn-outline btn-sm"
          href="#/appointments">

          View all

        </a>

      </div>

      ${appointmentsTable(true)}

    </div>


    <div class="panel">

      <div class="panel-head">

        <h2>
          <i class="bi bi-activity"></i>
          Clinic activity
        </h2>

      </div>

      <div class="panel-body">

        <div class="revenue-grid">

          <div>

            <strong>
              Today's consultations
            </strong>

            <div style="margin-top:8px">

              <div style="
                display:flex;
                justify-content:space-between;
                font-size:.75rem;
                margin-bottom:5px;
              ">

                <span>Consultations</span>

                <strong>${todayVisits.length}</strong>

              </div>

              <div class="progress">

                <div
                  class="progress-fill"
                  style="
                    width:${Math.min(
                      todayVisits.length * 10,
                      100
                    )}%;
                    background:linear-gradient(
                      90deg,
                      #E88AA7,
                      #C15C7C
                    );
                  ">
                </div>

              </div>

            </div>

          </div>


          <div>

            <strong>
              Appointment capacity
            </strong>

            <div style="margin-top:8px">

              <div style="
                display:flex;
                justify-content:space-between;
                font-size:.75rem;
                margin-bottom:5px;
              ">

                <span>Booked slots</span>

                <strong>
                  ${confirmed} / 24
                </strong>

              </div>

              <div class="progress">

                <div
                  class="progress-fill"
                  style="
                    width:${Math.min(
                      confirmed / 24 * 100,
                      100
                    )}%;
                    background:linear-gradient(
                      90deg,
                      #9FD8C4,
                      #4F9C82
                    );
                  ">
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>

  `;

}


function statCard(icon, color, label, value, note) {

  return `

    <div class="stat-card">

      <div
        class="stat-icon"
        style="background:${color}">

        <i class="bi ${icon}"></i>

      </div>

      <div class="stat-label">
        ${label}
      </div>

      <div class="stat-value">
        ${value}
      </div>

      <div class="stat-note">
        ${note}
      </div>

    </div>

  `;

}


function quickCard(
  href,
  icon,
  title,
  description,
  color,
  action
) {

  return `

    <a
      class="quick-card"
      href="${href}">

      <span
        class="quick-icon"
        style="background:${color}">

        <i class="bi ${icon}"></i>

      </span>

      <h3>
        ${title}
      </h3>

      <p>
        ${description}
      </p>

      <span class="quick-go">
        ${action} →
      </span>

    </a>

  `;

}


/* =========================================================
   APPOINTMENTS
========================================================= */

function appointmentsView() {

  return `

    <div class="hero">

      <div>

        <h1>
          Appointments
        </h1>

        <p>
          Manage today's dermatology schedule,
          patient concerns and appointment status.
        </p>

      </div>

      ${isDoctorUser() ? "" : `
      <button
        class="btn btn-rose"
        onclick="openAppointmentModal()">

        <i class="bi bi-calendar-plus"></i>
        New appointment

      </button>`}

    </div>


    <div class="stat-grid">

      ${appointmentMiniStats()}

    </div>


    <div class="panel">

      <div class="panel-head">

        <h2>
          <i class="bi bi-calendar-week"></i>
          Appointment schedule
        </h2>

        <span class="pill">
          ${prettyDate(todayStr())}
        </span>

      </div>

      ${appointmentsTable(false)}

    </div>

  `;

}


function appointmentMiniStats() {

  const active =
    visibleAppointments().filter(
      a => a.status !== "Cancelled"
    ).length;

  const confirmed =
    visibleAppointments().filter(
      a => a.status === "Confirmed"
    ).length;

  const pending =
    visibleAppointments().filter(
      a => a.status === "Pending"
    ).length;

  const revenue =
    visibleAppointments()
      .filter(a => a.status !== "Cancelled")
      .reduce(
        (sum,a) => sum + Number(a.fee || 0),
        0
      );


  return [

    statCard(
      "bi-calendar-check",
      "#E88AA7",
      "Active appointments",
      active,
      "Today's schedule"
    ),

    statCard(
      "bi-check-circle",
      "#4F9C82",
      "Confirmed",
      confirmed,
      "Ready for visit"
    ),

    statCard(
      "bi-hourglass-split",
      "#E39A4A",
      "Pending",
      pending,
      "Needs attention"
    ),

    statCard(
      "bi-cash-stack",
      "#8768B3",
      "Scheduled value",
      money(revenue),
      "Appointment fees"
    )

  ].join("");

}


function appointmentsTable(dashboardMode) {

  const rows =
    visibleAppointments().filter(
      a => a.status !== "Cancelled"
    );


  if (!rows.length) {

    return `
      <div class="empty">
        No appointments scheduled.
      </div>
    `;

  }


  return `

    <div class="table-wrap">

      <table>

        <thead>

          <tr>

            <th>Patient</th>
            <th>Doctor</th>
            <th>Concern</th>
            <th>Treatment</th>
            <th>Date</th>
            <th>Time</th>
            <th>Fee</th>
            <th>Status</th>
            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          ${rows.map(a => {

            const doctor =
              findDoctor(a.doctorId);

            const statusClass =
              a.status === "Confirmed"
                ? "badge-success"
                : "badge-warning";

            return `

              <tr>

                <td>

                  <strong>
                    ${escapeHTML(a.patient)}
                  </strong>

                  <br>

                  <small style="
                    color:var(--ink-soft);
                  ">
                    ${a.patientId}
                  </small>

                </td>

                <td>
                  ${doctor.name}
                </td>

                <td>
                  <span class="badge badge-issue">
                    ${escapeHTML(a.issue)}
                  </span>
                </td>

                <td>
                  ${escapeHTML(a.treatment)}${a.mode === "VIDEO" ? ' <span class="badge badge-blue">Video</span>' : ""}
                </td>

                <td>
                  ${prettyDate(a.date)}
                </td>

                <td>
                  ${a.time}
                </td>

                <td>
                  ${money(a.fee)}
                <br>
                  ${payBadge(a)}
                </td>

                <td>

                  <span
                    class="badge ${statusClass}">

                    ${a.status}

                  </span>

                </td>

                <td>

                  ${!isDoctorUser() && a.status !== "Cancelled" ? `
                  <button
                    class="btn btn-outline btn-sm"
                    onclick="openPaymentModal('${a.id}')">
                    <i class="bi bi-cash-coin"></i>
                    Payment
                  </button>` : ""}
                  ${isDoctorUser() && a.mode === "VIDEO" && a.status !== "Cancelled" && dueOf(a) <= 0 && videoJoinOpen(a) ? `
                  <button
                    class="btn btn-rose btn-sm"
                    onclick="joinVideoCall(${a.dbId}, '${escapeHTML(a.patient).replace(/'/g, "")}')">
                    <i class="bi bi-camera-video"></i>
                    Join video call
                  </button>` : ""}
                  ${a.status !== "Cancelled" && cancelOpen(a) ? `<button
                    class="btn btn-danger btn-sm"
                    onclick="cancelAppointment('${a.id}')">

                    <i class="bi bi-x-circle"></i>
                    Cancel

                  </button>` : ""}

                </td>

              </tr>

            `;

          }).join("")}

        </tbody>

      </table>

    </div>

  `;

}


/* =========================================================
   PATIENTS
========================================================= */

function patientsView() {

  return `

    <div class="hero">

      <div>

        <h1>
          Patients
        </h1>

        <p>
          Search the patient directory and open
          a patient's complete dermatology visit history.
        </p>

      </div>

      <div class="search-box">

        <i class="bi bi-search"></i>

        <input
          id="patientSearch"
          placeholder="Search patient or ID..."
          oninput="filterPatients(this.value)">

      </div>

    </div>


    <div class="panel">

      <div class="panel-head">

        <h2>
          <i class="bi bi-journal-medical"></i>
          Patient directory
        </h2>

        <span
          style="
            color:var(--ink-soft);
            font-size:.75rem;
          ">

          ${PATIENTS.length} patient records

        </span>

      </div>


      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>Patient</th>
              <th>ID</th>
              <th>Age / Gender</th>
              <th>Latest concern</th>
              <th>Doctor</th>
              <th>Last visit</th>
              ${isDoctorUser() ? "" : "<th>Balance</th>"}
              <th></th>

            </tr>

          </thead>

          <tbody id="patientRows">

            ${patientRows()}

          </tbody>

        </table>

      </div>

    </div>

  `;

}


function patientRows() {

  return PATIENTS.map(patient => {

    const last = lastVisit(patient) || { doctorId: "", issue: "—", date: "" };

    const doctor = findDoctor(last.doctorId) || { name: "—" };

    const due =
      patient.visits.reduce((sum, v) => sum + dueOf(v), 0);


    return `

      <tr data-search="
        ${escapeHTML(patient.name)}
        ${patient.id}
        ${escapeHTML(last.issue)}
        ${escapeHTML(doctor.name)}
      ">

        <td>

          <strong>
            ${escapeHTML(patient.name)}
          </strong>

        </td>

        <td>
          <span class="badge badge-blue">
            ${patient.id}
          </span>
        </td>

        <td>
          ${patient.age} · ${patient.gender}
        </td>

        <td>

          <span class="badge badge-issue">
            ${escapeHTML(last.issue)}
          </span>

        </td>

        <td>
          ${doctor.name}
        </td>

        <td>
          ${prettyDate(last.date)}
        </td>

        ${isDoctorUser() ? "" : `<td>

          ${
            due > 0
            ? `<span class="badge badge-danger">
                 ${money(due)} due
               </span>`
            : `<span class="badge badge-success">
                 Settled
               </span>`
          }

        </td>`}

        <td>

          <a
            href="#/patient/${patient.id}"
            class="btn btn-outline btn-sm">

            <i class="bi bi-clock-history"></i>
            History

          </a>

        </td>

      </tr>

    `;

  }).join("");

}


function filterPatients(query) {

  const search =
    query.toLowerCase().trim();

  document
    .querySelectorAll("#patientRows tr")
    .forEach(row => {

      const content =
        row.dataset.search.toLowerCase();

      row.style.display =
        content.includes(search)
          ? ""
          : "none";

    });

}


/* =========================================================
   PATIENT DETAIL
========================================================= */

function patientDetailView(id) {

  const patient =
    patientForId(id);


  if (!patient) {

    return `

      <div class="empty">

        Patient not found.

        <br><br>

        <a
          href="#/patients"
          class="btn btn-rose">

          Back to patients

        </a>

      </div>

    `;

  }


  const due =
    patient.visits.reduce((sum, v) => sum + dueOf(v), 0);


  const total =
    patient.visits
      .reduce(
        (sum,v) => sum + Number(v.fee || 0),
        0
      );


  return `

    <a
      href="#/patients"
      class="btn btn-outline btn-sm"
      style="margin-bottom:15px">

      <i class="bi bi-arrow-left"></i>
      Back to patients

    </a>


    <div class="patient-header">

      <div style="
        display:flex;
        align-items:center;
        gap:14px;
      ">

        <div class="patient-avatar">

          ${initials(patient.name)}

        </div>

        <div class="patient-info">

          <h1>
            ${escapeHTML(patient.name)}
          </h1>

          <p>
            ${patient.id}
            ·
            ${patient.age} years
            ·
            ${patient.gender}
          </p>

        </div>

      </div>


      ${isDoctorUser() ? "" : `<span class="pill">

        ${
          due > 0
          ? `<i class="bi bi-exclamation-circle"></i>
             &nbsp;${money(due)} due`
          : `<i class="bi bi-check-circle"></i>
             &nbsp;All bills settled`
        }

      </span>`}

    </div>


    <div class="stat-grid">

      ${statCard(
        "bi-calendar2-check",
        "#E88AA7",
        "Total visits",
        patient.visits.length,
        "Recorded consultations"
      )}

      ${isDoctorUser() ? statCard("bi-person-badge", "#8768B3", "Doctors consulted", new Set(patient.visits.map(v => v.doctorId)).size, "Across all visits") : `${statCard(
        "bi-cash-stack",
        "#8768B3",
        "Total billed",
        money(total),
        "Across all visits"
      )}

      ${statCard(
        "bi-wallet2",
        "#4F9C82",
        "Paid",
        money(total - due),
        "Collected"
      )}

      ${statCard(
        "bi-hourglass-split",
        "#E39A4A",
        "Outstanding",
        money(due),
        "Pending balance"
      )}`}

    </div>


    <div class="panel">

      <div class="panel-head">

        <h2>
          <i class="bi bi-clock-history"></i>
          Visit history
        </h2>

      </div>


      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>Date</th>
              <th>Doctor</th>
              <th>Issue</th>
              <th>Treatment</th>
              ${isDoctorUser() ? "" : "<th>Fee</th><th>Status</th>"}

            </tr>

          </thead>

          <tbody>

            ${[...patient.visits]
              .sort(
                (a,b) =>
                  b.date.localeCompare(a.date)
              )
              .map(visit => {

                const doctor =
                  findDoctor(visit.doctorId);

                return `

                  <tr>

                    <td>
                      ${prettyDate(visit.date)}
                    </td>

                    <td>

                      <strong>
                        ${doctor.name}
                      </strong>

                      <br>

                      <small style="
                        color:var(--ink-soft);
                      ">
                        ${doctor.specialty}
                      </small>

                    </td>

                    <td>

                      <span class="badge badge-issue">
                        ${escapeHTML(visit.issue)}
                      </span>

                    </td>

                    <td>
                      ${escapeHTML(visit.treatment)}
                    </td>

                    ${isDoctorUser() ? "" : `<td>
                      ${money(visit.fee)}
                    </td>

                    <td>

                      ${payBadge(visit)}

                    </td>`}

                  </tr>

                `;

              }).join("")}

          </tbody>

        </table>

      </div>

    </div>


    ${isDoctorUser() ? "" : `<div class="panel">

      <div class="panel-head">

        <h2>
          <i class="bi bi-plus-circle"></i>
          Add visit
        </h2>

      </div>


      <div class="panel-body">

        <div class="form-grid">

          <div class="field">

            <label>Doctor</label>

            <select id="newVisitDoctor">

              ${DOCTORS.map(d => `
                <option value="${d.id}">
                  ${d.name}
                </option>
              `).join("")}

            </select>

          </div>


          <div class="field">

            <label>Issue / concern</label>

            <input
              id="newVisitIssue"
              placeholder="e.g. Acne">

          </div>


          <div class="field">

            <label>Treatment / procedure</label>

            <input
              id="newVisitTreatment"
              placeholder="e.g. Follow-up consultation">

          </div>


          <div class="field">

            <label>Fee (₹)</label>

            <input
              id="newVisitFee"
              type="number"
              min="1"
              placeholder="1000">

          </div>

        </div>


        <button
          class="btn btn-rose"
          onclick="addVisit('${patient.id}')">

          <i class="bi bi-plus-circle"></i>
          Add today's visit

        </button>

      </div>

    </div>`}

      <div id="patientExtras" data-patient="${escapeHTML(patient.id)}"></div>

  `;

}


function addVisit(patientId) {

  const patient =
    patientForId(patientId);

  const doctorId =
    document.getElementById(
      "newVisitDoctor"
    ).value;

  const issue =
    document.getElementById(
      "newVisitIssue"
    ).value.trim();

  const treatment =
    document.getElementById(
      "newVisitTreatment"
    ).value.trim();

  const fee =
    Number(
      document.getElementById(
        "newVisitFee"
      ).value
    );


  if (
    !issue ||
    !treatment ||
    !fee ||
    fee <= 0
  ) {

    showToast(
      "Please complete the visit details."
    );

    return;

  }


  patient.visits.push({

    date: todayStr(),

    doctorId,

    issue,

    treatment,

    fee,

    paid: false

  });


  showToast(
    "New visit added to patient history."
  );


  render();

}


/* =========================================================
   DOCTORS
========================================================= */

function doctorsView() {

  return `

    <div class="hero">

      <div>

        <h1>
          Our dermatologists
        </h1>

        <p>
          View each doctor's specialty,
          common concerns and current patient workload.
        </p>

      </div>

      ${isAdminUser() ? `
      <button
        class="btn btn-rose"
        onclick="openDoctorModal()">
        <i class="bi bi-person-plus"></i>
        Add doctor
      </button>` : ""}

    </div>


    <div class="doctor-grid">

      ${DOCTORS.map(doctor => {

        const count =
          PATIENTS.filter(
            patient =>
              patient.visits.some(
                visit =>
                  visit.doctorId === doctor.id
              )
          ).length;


        return `

          <div class="doctor-card">

            <div
              class="doctor-avatar"
              style="
                background:linear-gradient(
                  135deg,
                  ${doctor.color1},
                  ${doctor.color2}
                );
              ">

              ${initials(doctor.name)}

            </div>


            <div style="flex:1">

              <h3>
                ${doctor.name}
              </h3>

              <div class="doctor-specialty">

                <i class="bi bi-stars"></i>

                ${doctor.specialty}

              </div>

              <p class="doctor-bio">
                ${doctor.bio}
              </p>

              ${isAdminUser() ? `
              <p class="doctor-bio" style="font-size:.72rem;">
                <strong>Login ID:</strong> ${escapeHTML(doctor.loginId || doctor.id)}
                · <strong>Video:</strong> ${money(doctor.videoFee)}
                ${doctor.phone ? " · " + escapeHTML(doctor.phone) : ""}
                ${doctor.email ? " · " + escapeHTML(doctor.email) : ""}
              </p>` : ""}


              <div class="tags">

                ${doctor.treats.map(
                  treatment => `
                    <span class="tag">
                      ${treatment}
                    </span>
                  `
                ).join("")}

              </div>


              <div class="doctor-footer">

                <span class="doctor-count">

                  <i class="bi bi-people"></i>

                  ${count}
                  patient(s) under care

                </span>


                ${isDoctorUser() ? "" : `
                <button
                  class="btn btn-rose btn-sm"
                  onclick="
                    openAppointmentModal(
                      '${doctor.id}'
                    )
                  ">

                  Book

                </button>`}

              </div>

            </div>

          </div>

        `;

      }).join("")}

    </div>

  `;

}


/* =========================================================
   SERVICES
========================================================= */

let SERVICES = [];  // filled from Spring Boot API (see overrides.js)


function servicesView() {

  return `

    <div class="hero">

      <div>

        <h1>
          Skin clinic services
        </h1>

        <p>
          Dermatology and aesthetic services available
          for appointment scheduling.
        </p>

      </div>

    </div>


    <div class="service-grid">

      ${SERVICES.map(service => `

        <div class="service-card">

          <div class="service-icon">

            <i class="bi ${service.icon}"></i>

          </div>

          <h3>
            ${service.name}
          </h3>

          <p>
            ${service.description}
          </p>

          ${isDoctorUser() ? "" : `
          <button
            class="btn btn-outline btn-sm"
            onclick="
              openAppointmentModal(
                '',
                '${service.name}'
              )
            ">

            <i class="bi bi-calendar-plus"></i>
            Book

          </button>`}

        </div>

      `).join("")}

    </div>

  `;

}


/* =========================================================
   REVENUE
========================================================= */

function revenueView() {

  const visits = visibleVisits().filter(v => v.date === todayStr());
  const allVisible = visibleVisits().filter(v => v.date && v.date !== "");

  const billed = visits.reduce((sum,v) => sum + Number(v.fee || 0), 0);
  const collected = visits.reduce((sum,v) => sum + paidOf(v), 0);
  const due = billed - collected;
  const average = visits.length ? Math.round(billed / visits.length) : 0;
  const doctor = currentDoctor();

  const monthly = Array.from({length: 12}, (_, i) => {
    const date = new Date();
    date.setMonth(i, 1);
    const year = date.getFullYear();
    return {
      month: date.toLocaleString("en-IN", { month: "short" }),
      amount: allVisible
        .filter(v => {
          const d = new Date(v.date + "T00:00:00");
          return d.getFullYear() === year && d.getMonth() === i;
        })
        .reduce((sum,v) => sum + Number(v.fee || 0), 0)
    };
  });

  const monthlyShown = (isDoctorUser() && REVENUE && Array.isArray(REVENUE.monthly)) ? REVENUE.monthly : monthly;
  const maxMonthly = Math.max(1, ...monthlyShown.map(x => x.amount));

  const doctorRevenue = DOCTORS.map(d => ({
    doctor: d,
    amount: visits.filter(v => v.doctorId === d.id)
      .reduce((sum,v) => sum + Number(v.fee || 0), 0)
  }));

  return `

    <div class="hero">

      <div>

        <h1>
          Revenue & analytics
        </h1>

        <p>
          ${
            isDoctorUser()
              ? `Your individual billing, collections and monthly revenue.`
              : isReceptionistUser()
                ? `Clinic billing, collections and pending balances.`
                : `Review today's billing, collections, pending balances and doctor-level revenue.`
          }
        </p>

      </div>

      <span class="pill">
        <i class="bi bi-calendar-heart"></i>
        &nbsp;
        ${prettyDate(todayStr())}
      </span>

    </div>

    <div class="stat-grid">

      ${statCard("bi-receipt", "#4F9C82", isDoctorUser() ? "Your billed today" : "Total billed today",
        money(billed), visits.length + " visit(s)")}

      ${statCard("bi-check-circle", "#E88AA7", isDoctorUser() ? "Your collected today" : "Collected today",
        money(collected), "Marked as paid")}

      ${statCard("bi-hourglass-split", "#E39A4A", isDoctorUser() ? "Your pending today" : "Pending today",
        money(due), "Still to collect")}

      ${statCard("bi-graph-up-arrow", "#8768B3", "Average bill", money(average), "Per today's visit")}

    </div>

    ${isDoctorUser() ? `

      <div class="panel">
        <div class="panel-head">
          <h2><i class="bi bi-person-badge"></i> ${doctor ? escapeHTML(doctor.name) : "Your"} monthly revenue</h2>
          <span class="pill">Current year</span>
        </div>

        <div style="padding:10px 0 22px">
          <div style="
            display:grid;
            grid-template-columns:repeat(12,minmax(34px,1fr));
            gap:8px;
            align-items:end;
            min-height:220px;
          ">
            ${monthlyShown.map(item => `
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:210px;gap:6px">
                <span style="font-size:.68rem;font-weight:700;color:var(--ink-soft)">${money(item.amount)}</span>
                <div style="
                  width:100%;
                  max-width:42px;
                  height:${Math.max(item.amount ? 12 : 4, item.amount / maxMonthly * 150)}px;
                  border-radius:8px 8px 3px 3px;
                  background:linear-gradient(180deg,var(--rose),var(--rose-deep));
                " title="${item.month}: ${money(item.amount)}"></div>
                <span style="font-size:.7rem;color:var(--ink-soft)">${item.month}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

    ` : ""}

    ${!isDoctorUser() && !isReceptionistUser() ? doctorMonthlyPanel(allVisible) : ""}
    ${!isDoctorUser() && !isReceptionistUser() ? `

      <div class="revenue-grid">

        <div class="panel">
          <div class="panel-head">
            <h2><i class="bi bi-bar-chart"></i> Revenue by doctor</h2>
          </div>

          <div style="padding:8px 0 15px">
            ${doctorRevenue.map(item => `
              <div class="bar-row">
                <span class="bar-label">${escapeHTML(item.doctor.name)}</span>
                <span class="bar-track">
                  <span class="bar-fill" style="
                    width:${item.amount / Math.max(1,...doctorRevenue.map(x => x.amount))*100}%;
                    background:linear-gradient(90deg,${item.doctor.color1},${item.doctor.color2});
                  "></span>
                </span>
                <span class="bar-value">${money(item.amount)}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="revenue-highlight">
          <small><i class="bi bi-wallet2"></i> Today's collection rate</small>
          <div class="revenue-value">${billed ? Math.round(collected / billed * 100) : 0}%</div>
          <p style="margin:8px 0 0;font-size:.78rem;opacity:.85">
            ${money(collected)} collected from ${money(billed)} billed today.
          </p>
          <div style="margin-top:20px">
            <div class="progress" style="background:rgba(255,255,255,.25)">
              <div class="progress-fill" style="width:${billed ? collected / billed * 100 : 0}%;background:white"></div>
            </div>
          </div>
        </div>

      </div>

    ` : `

      <div class="revenue-highlight" style="margin-bottom:22px">
        <small><i class="bi bi-wallet2"></i> Today's collection rate</small>
        <div class="revenue-value">${billed ? Math.round(collected / billed * 100) : 0}%</div>
        <p style="margin:8px 0 0;font-size:.78rem;opacity:.85">
          ${money(collected)} collected from ${money(billed)} billed today.
        </p>
      </div>

    `}

    <div class="panel">

      <div class="panel-head">
        <h2><i class="bi bi-receipt"></i> Today's billed visits</h2>
      </div>

      ${
        visits.length
        ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Issue</th>
                  <th>Treatment</th>
                  <th>Fee</th>
            <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${visits.map(v => {
                  const d = findDoctor(v.doctorId);
                  return `
                    <tr>
                      <td><strong>${escapeHTML(v.patient.name)}</strong></td>
                      <td>${d ? escapeHTML(d.name) : "—"}</td>
                      <td><span class="badge badge-issue">${escapeHTML(v.issue)}</span></td>
                      <td>${escapeHTML(v.treatment)}</td>
                      <td>${money(v.fee)}</td>
                      <td>${payBadge(v)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty">No billed visits today.</div>`
      }

    </div>

  `;

}

/* =========================================================
   APPOINTMENT MODAL
========================================================= */

function openAppointmentModal(
  doctorId = "",
  service = ""
) {
  if (isDoctorUser()) { showToast("Doctors cannot book appointments."); return; }


  populateDoctorSelect();


  const modal =
    document.getElementById(
      "appointmentModal"
    );


  document.getElementById(
    "appointmentDate"
  ).min = todayStr();


  if (doctorId) {

    document.getElementById(
      "appointmentDoctor"
    ).value = doctorId;

    updateDoctorSlots();

  }


  if (service) {

    const treatment =
      document.getElementById(
        "appointmentTreatment"
      );

    const matching =
      [...treatment.options]
        .find(
          option =>
            option.value === service
        );


    if (matching) {

      treatment.value = service;

    } else if (service === "Acne Care") {

      treatment.value =
        "Acne Consultation";

    }

  }


  if (typeof refreshDoctorSuggestions === "function") refreshDoctorSuggestions();

  modal.classList.add("show");

}


function populateDoctorSelect() {

  const select =
    document.getElementById(
      "appointmentDoctor"
    );


  select.innerHTML = `

    <option value="">
      Select doctor
    </option>

    ${DOCTORS.map(
      doctor => `
        <option value="${doctor.id}">
          ${doctor.name}
        </option>
      `
    ).join("")}

  `;

}


document
  .getElementById("appointmentDoctor")
  .addEventListener(
    "change",
    updateDoctorSlots
  );


function updateDoctorSlots() {

  const doctorId =
    document.getElementById(
      "appointmentDoctor"
    ).value;


  const slotSelect =
    document.getElementById(
      "appointmentSlot"
    );


  const info =
    document.getElementById(
      "doctorInfo"
    );


  slotSelect.innerHTML = "";


  if (!doctorId) {

    slotSelect.innerHTML = `
      <option value="">
        Select doctor first
      </option>
    `;

    info.innerHTML =
      "Select a dermatologist to see their specialty and available slots.";

    return;

  }


  const doctor =
    findDoctor(doctorId);


  info.innerHTML = `

    <strong>
      ${doctor.name}
    </strong>

    <br>

    ${doctor.specialty}

    <br>

    <small>
      Available clinic slots are shown below.
    </small>

  `;


  doctor.slots.forEach(slot => {

    const option =
      document.createElement("option");

    option.value = slot;

    option.textContent = slot;

    slotSelect.appendChild(option);

  });

}


/* =========================================================
   APPOINTMENT FORM SUBMISSION
========================================================= */

document
  .getElementById("appointmentForm")
  .addEventListener(
    "submit",
    function(event) {

      event.preventDefault();


      const patientId =
        document.getElementById(
          "appointmentPatientId"
        ).value.trim();


      const patientName =
        document.getElementById(
          "appointmentPatientName"
        ).value.trim();


      const age =
        Number(
          document.getElementById(
            "appointmentAge"
          ).value
        );


      const gender =
        document.getElementById(
          "appointmentGender"
        ).value;


      const issue =
        document.getElementById(
          "appointmentIssue"
        ).value;


      const doctorId =
        document.getElementById(
          "appointmentDoctor"
        ).value;


      const treatment =
        document.getElementById(
          "appointmentTreatment"
        ).value;


      const date =
        document.getElementById(
          "appointmentDate"
        ).value;


      const time =
        document.getElementById(
          "appointmentSlot"
        ).value;


      const fee =
        Number(
          document.getElementById(
            "appointmentFee"
          ).value
        );


      if (
        !patientId ||
        !patientName ||
        !age ||
        !issue ||
        !doctorId ||
        !treatment ||
        !date ||
        !time ||
        fee < 0
      ) {

        showToast(
          "Please complete all required appointment fields."
        );

        return;

      }


      const doctor =
        findDoctor(doctorId);


      /* -------------------------------------------------------
         Add appointment
      ------------------------------------------------------- */

      const appointment = {

        id:
          "APT" +
          String(
            APPOINTMENTS.length + 1
          ).padStart(3,"0"),

        patientId,

        patient: patientName,

        doctorId,

        issue,

        treatment,

        date,

        time,

        fee,

        status: "Confirmed"

      };


      APPOINTMENTS.push(
        appointment
      );


      /* -------------------------------------------------------
         Add patient if new
      ------------------------------------------------------- */

      let patient =
        patientForId(patientId);


      if (!patient) {

        patient = {

          id: patientId,

          name: patientName,

          age,

          gender,

          visits: []

        };

        PATIENTS.push(patient);

      }


      /* -------------------------------------------------------
         Add appointment as visit
      ------------------------------------------------------- */

      patient.visits.push({

        date,

        doctorId,

        issue,

        treatment,

        fee,

        paid: false

      });


      /* -------------------------------------------------------
         Success message
      ------------------------------------------------------- */

      document.getElementById(
        "successMessage"
      ).innerHTML = `

        <strong>
          ${escapeHTML(patientName)}
        </strong>

        <br>

        Patient ID:
        ${escapeHTML(patientId)}

        <br>

        ${doctor.name}

        <br>

        ${escapeHTML(treatment)}

        <br>

        ${prettyDate(date)}
        ·
        ${time}

        <br>

        Consultation fee:
        <strong>${money(fee)}</strong>

      `;


      closeModal(
        "appointmentModal"
      );


      setTimeout(
        () => {

          document
            .getElementById(
              "successModal"
            )
            .classList.add("show");

        },
        180
      );


      this.reset();


      document.getElementById(
        "appointmentSlot"
      ).innerHTML = `
        <option value="">
          Select doctor first
        </option>
      `;


      document.getElementById(
        "doctorInfo"
      ).textContent =
        "Select a dermatologist to see their specialty and available slots.";


      showToast(
        "Appointment added successfully."
      );


      render();

    }
  );


/* =========================================================
   CANCEL APPOINTMENT
========================================================= */

function cancelAppointment(id) {

  const appointment =
    APPOINTMENTS.find(
      a => a.id === id
    );


  if (!appointment) return;


  if (
    !confirm(
      "Cancel this appointment?"
    )
  ) {

    return;

  }


  appointment.status =
    "Cancelled";


  showToast(
    "Appointment cancelled."
  );


  render();

}


/* =========================================================
   HISTORY MODAL
========================================================= */

function openHistory(patientId) {

  const patient =
    patientForId(patientId);


  if (!patient) return;


  const due =
    patient.visits.reduce((sum, v) => sum + dueOf(v), 0);


  document.getElementById(
    "historyContent"
  ).innerHTML = `

    <div style="
      display:flex;
      gap:15px;
      align-items:center;
      margin-bottom:20px;
    ">

      <div class="patient-avatar">
        ${initials(patient.name)}
      </div>

      <div>

        <h3 style="margin:0">
          ${escapeHTML(patient.name)}
        </h3>

        <p style="
          margin:3px 0;
          color:var(--ink-soft);
          font-size:.75rem;
        ">

          ${patient.id}
          ·
          ${patient.age} years
          ·
          ${patient.gender}

        </p>

      </div>

    </div>


    ${
      due > 0
      ? `
        <div class="alert alert-warning"
             style="margin-bottom:15px">

          <i class="bi bi-exclamation-circle"></i>

          Outstanding balance:
          <strong>${money(due)}</strong>

        </div>
      `
      : `
        <div class="alert alert-success"
             style="margin-bottom:15px">

          <i class="bi bi-check-circle"></i>

          All recorded visits are paid.

        </div>
      `
    }


    <div class="table-wrap">

      <table style="min-width:600px">

        <thead>

          <tr>

            <th>Date</th>
            <th>Doctor</th>
            <th>Issue</th>
            <th>Treatment</th>
            ${isDoctorUser() ? "" : "<th>Fee</th><th>Status</th>"}

          </tr>

        </thead>

        <tbody>

          ${patient.visits.map(
            visit => {

              const doctor =
                findDoctor(
                  visit.doctorId
                );

              return `

                <tr>

                  <td>
                    ${prettyDate(
                      visit.date
                    )}
                  </td>

                  <td>
                    ${doctor.name}
                  </td>

                  <td>

                    <span class="badge badge-issue">
                      ${escapeHTML(
                        visit.issue
                      )}
                    </span>

                  </td>

                  <td>
                    ${escapeHTML(
                      visit.treatment
                    )}
                  </td>

                  ${isDoctorUser() ? "" : `<td>
                    ${money(visit.fee)}
                  </td>

                  <td>

                    ${payBadge(visit)}

                  </td>`}

                </tr>

              `;

            }
          ).join("")}

        </tbody>

      </table>

    </div>

  `;


  document
    .getElementById(
      "historyModal"
    )
    .classList.add("show");

}


/* =========================================================
   MODALS
========================================================= */

function closeModal(id) {

  document
    .getElementById(id)
    .classList.remove("show");

}


document
  .querySelectorAll(".modal-backdrop")
  .forEach(backdrop => {

    backdrop.addEventListener(
      "click",
      function(event) {

        if (
          event.target === this
        ) {

          this.classList.remove(
            "show"
          );

        }

      }
    );

  });


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      document
        .querySelectorAll(
          ".modal-backdrop.show"
        )
        .forEach(modal =>
          modal.classList.remove("show")
        );

    }

  }
);


/* =========================================================
   TOAST
========================================================= */

let toastTimer;


function showToast(message) {

  const toast =
    document.getElementById(
      "toast"
    );


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2800
    );

}


/* =========================================================
   DEFAULT DATE
========================================================= */

document.getElementById(
  "appointmentDate"
).value = todayStr();


document.getElementById(
  "appointmentDate"
).min = todayStr();


/* =========================================================
   INITIAL RENDER
========================================================= */

render();


console.log(
  "BloomDerma Clinic Management System loaded."
);



/* Admin revenue dashboard: monthly revenue of EVERY doctor (billed per month, plus collected / due totals). */
function doctorMonthlyPanel(visitList) {
  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(year, i, 1).toLocaleString("en-IN", { month: "short" }));
  const rows = DOCTORS.map(d => {
    const own = visitList.filter(v => v.doctorId === d.id && new Date(v.date + "T00:00:00").getFullYear() === year);
    const perMonth = months.map((_, i) => own
      .filter(v => new Date(v.date + "T00:00:00").getMonth() === i)
      .reduce((sum, v) => sum + Number(v.fee || 0), 0));
    const total = perMonth.reduce((a, b) => a + b, 0);
    const collected = own.reduce((sum, v) => sum + paidOf(v), 0);
    return { doctor: d, perMonth, total, collected, due: total - collected };
  });
  const sum = f => rows.reduce((a, r) => a + f(r), 0);
  return `
    <div class="panel" style="margin-bottom:22px">
      <div class="panel-head">
        <h2><i class="bi bi-calendar3"></i> Monthly revenue by doctor</h2>
        <span class="pill">${year}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Doctor</th>
              ${months.map(m => `<th>${m}</th>`).join("")}
              <th>Total</th><th>Collected</th><th>Due</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${escapeHTML(r.doctor.name)}</strong></td>
                ${r.perMonth.map(a => `<td>${a ? money(a) : "—"}</td>`).join("")}
                <td><strong>${money(r.total)}</strong></td>
                <td>${money(r.collected)}</td>
                <td>${r.due > 0 ? `<span class="badge badge-danger">${money(r.due)}</span>` : "—"}</td>
              </tr>`).join("")}
            <tr>
              <td><strong>All doctors</strong></td>
              ${months.map((_, i) => `<td><strong>${money(sum(r => r.perMonth[i]))}</strong></td>`).join("")}
              <td><strong>${money(sum(r => r.total))}</strong></td>
              <td><strong>${money(sum(r => r.collected))}</strong></td>
              <td><strong>${money(sum(r => r.due))}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}


/* ---- Public reviews written by patients (read by doctors and staff; Admin can remove inappropriate ones) ---- */
function starsHtml(n) {
  return `<span class="stars">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;
}

function reviewsView() {
  const avg = list => list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1) : "—";
  const me = isDoctorUser() ? currentDoctor() : null;
  const mine = me ? REVIEWS.filter(r => r.doctorId === me.id) : [];
  const perDoctor = DOCTORS.map(d => ({ d, list: REVIEWS.filter(r => r.doctorId === d.id) })).filter(x => x.list.length);

  return `
    <div class="hero">
      <div>
        <h1>Patient reviews</h1>
        <p>Public feedback written by patients. Everyone on the portal can read it.</p>
      </div>
    </div>

    <div class="stat-grid" style="margin-bottom:22px">
      ${statCard("bi-star-fill", "#E39A4A", "Average rating", avg(REVIEWS), "All reviews")}
      ${statCard("bi-chat-heart", "#E88AA7", "Total reviews", REVIEWS.length, "Written by patients")}
      ${me ? statCard("bi-person-heart", "#8768B3", "About me", avg(mine), mine.length + " review(s)") : ""}
    </div>

    ${!me && perDoctor.length ? `
    <div class="panel" style="margin-bottom:22px">
      <div class="panel-head"><h2><i class="bi bi-person-heart"></i> Rating by doctor</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Doctor</th><th>Average</th><th>Reviews</th></tr></thead>
        <tbody>${perDoctor.map(x => `<tr><td><strong>${escapeHTML(x.d.name)}</strong></td><td>${starsHtml(Math.round(avg(x.list)))} ${avg(x.list)}</td><td>${x.list.length}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>` : ""}

    <div class="panel">
      <div class="panel-head"><h2><i class="bi bi-chat-heart"></i> What patients say</h2></div>
      ${REVIEWS.length ? `<div class="review-list">${REVIEWS.map(r => `
        <div class="review-card">
          <div class="review-head">
            ${starsHtml(r.rating)}
            <strong>${escapeHTML(r.author)}</strong>
            ${r.doctorName ? `<span class="badge badge-doctor">${escapeHTML(r.doctorName)}</span>` : `<span class="badge badge-blue">Clinic</span>`}
            <span class="review-meta">${prettyDate((r.createdAt || "").slice(0, 10))}</span>
            ${isAdminUser() ? `<button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="deleteReviewAdmin(${r.id})">Remove</button>` : ""}
          </div>
          <p translate="no">${escapeHTML(r.text)}</p>
        </div>`).join("")}</div>` : `<div class="empty">No reviews have been written yet.</div>`}
    </div>`;
}
