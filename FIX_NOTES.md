# Update notes — BloomDerma

## What was checked
- Checked all JavaScript (`.js`) files with Node's syntax checker; no syntax errors were found.
- Preserved the existing application structure and dependencies.

## Important run prerequisites
This project requires Java 17+, Maven, Node.js 18+, and MySQL 8 (unless you use Docker Compose). The frontend alone will not make the full application work if the backend/database are unavailable.

### Recommended: Docker
From this folder, run:
    docker compose up --build

Then open http://localhost:3000.

### Local development
1. Start MySQL 8 and ensure the `derma_clinic_db` database can be created. Defaults in `backend/src/main/resources/application.properties` expect user `root` and password `root`; override with `DB_URL`, `DB_USER`, and `DB_PASSWORD` if needed.
2. In one terminal:
       cd backend
       mvn spring-boot:run
3. In another terminal:
       cd frontend
       npm install
       npm run dev
4. Open http://localhost:5173.

## Verification limitation
A full frontend build and Spring Boot launch were not completed in this environment because dependency installation/build tooling and a live MySQL service were not available. If the app still fails to start, the backend console's first exception and the browser console error will identify the remaining environment-specific issue.


FIX: "API unavailable - is the backend running?" on Add New Doctor
===============================================================
Cause: backend/src/main/resources/application.properties had been overwritten with the contents of a JavaScript file
(an old copy of the i18n code), so Spring Boot had no datasource / JWT / CORS settings and the backend could not start.
The Add New Doctor page loads its speciality list from the backend, so it showed this error immediately.
Fix: application.properties restored (MySQL root/root on localhost:3306, database derma_clinic_db is auto-created,
JWT secret + expiry, CORS, fees, 10 MB uploads, module switches). All values can be overridden with the environment
variables DB_URL, DB_USER, DB_PASSWORD, CORS_ORIGINS, JWT_SECRET, ANTHROPIC_API_KEY, UPLOAD_DIR.
Also: the login page now tells "backend not reachable" apart from "backend answered with an error (HTTP status)".


FIX: "Doctors could not be loaded - check the backend" in New Skin Appointment (dashboard numbers also blank)
===========================================================================================================
Cause: window.BloomApi (the API client used by the legacy scripts) was assigned inside a useEffect of <App>. React runs
CHILD effects before PARENT effects, so after a page refresh (F5 while signed in) LegacyShell started the legacy scripts
first, `const api = window.BloomApi` was undefined and every API call threw - even though the backend was running.
Fix: frontend/src/App.jsx now assigns window.BloomApi / BloomVideo / toggleTheme at module load, and LegacyShell.jsx
also guarantees window.BloomApi before running the scripts. overrides.js additionally falls back to the already loaded
doctor list if the suggestion and doctor requests both fail.
Rebuild after unzipping:  docker compose up --build   (or npm run dev in frontend/), then hard-refresh (Ctrl+Shift+R).
If the error still shows, open http://localhost:8080/api/doctors in the browser: "401/403" means the backend is up;
a connection error means the backend container is not running (docker compose logs backend).


FEATURE: Online payment for video consultations
===============================================
Before: booking a video consultation had no payment step (the clinic recorded payment manually).
Now:
- Patient portal > Video Consult > "Book & pay for video consultation". After booking, a payment dialog opens
  (UPI / debit-credit card / net banking). The booking is created as "Pending" and becomes "Confirmed" once paid.
- If the patient closes the dialog ("Pay later"), the consultation shows a "Pay Rs.X" button in "My video consultations".
- The video call can be joined (by patient AND doctor) only after the fee is fully paid - enforced in VideoService.
- The amount is always the server-side fee; the browser cannot change it. Card number/CVV are validated
  (Luhn, expiry, CVV) and NEVER stored - only method, last 4 digits / UPI id / bank, a transaction id and the time.
- Backend: POST /api/portal/appointments/{id}/pay  (PaymentService, PaymentRequest). New columns on `appointments`:
  payment_method, payment_ref, paid_at (added automatically: spring.jpa.hibernate.ddl-auto=update).
- Front desk can still record cash/part payments as before.
- The built-in gateway is a demo that approves valid details. To use a real gateway (Razorpay/Stripe),
  replace PaymentService.charge(...).
- Old unpaid video appointments must now be paid (online or by the front desk) before the call can be joined.


FIXES after testing the video-consultation flow (see tests/)
============================================================
1. videoCall.js - ICE candidates that reached the patient BEFORE the doctor's offer were silently thrown away (the page had
   no connection object yet). They are now kept and applied once the offer/answer is set. (Simulated loss: ~60% of calls -> 0%.)
2. Dockerfile / docker-compose.yml - the backend container ran in UTC, so the server's "today" and the 1-hour join window were
   5.5 hours off India time (e.g. a paid 2:30 AM consultation was rejected at 2:00 AM IST). The container now runs in
   Asia/Kolkata (ENV TZ + -Duser.timezone + serverTimezone in the JDBC URL).
3. videoCall.js - when the other person leaves ("bye"), the connection is now reset immediately. Before, rejoining relied on
   the browser noticing the dead connection; if it did not, the call never restarted.
4. PortalService / PatientPortal.jsx - a video consultation with a Rs.0 fee (doctor.videoFee = 0) stayed "Pending" forever
   because there was nothing to pay. It is now confirmed immediately and no payment dialog opens.
Known limits (not changed): STUN only, no TURN server (strict NAT / some mobile networks may not connect); unpaid "Pending"
video bookings hold the doctor's slot until cancelled; a paid consultation has no refund/cancel flow for the patient.


UPDATE: patient IDs in SK### format, no bookings in the past, optional revisit notices
======================================================================================
1. Patient IDs are always SK + 3 digits (SK001 ... SK999) and are always assigned by the system.
   - Patient sign-up no longer has a "Patient ID" box (LoginGate.jsx, RegisterRequest.java); the ID is created on the server
     (PatientIdGenerator: one more than the highest SK### in use). A patientId sent by a client is ignored.
   - A new patient booked by reception (blank Patient ID) and POST /api/patients also get the next SK### number.
   - After SK999 the system refuses to create more patients (clear error) instead of inventing an ID in another format.
   - PatientIdCleanup runs on every start: patients whose ID is not SK### (e.g. BD-7K4M9Q or a self-chosen ID) are DELETED with all their data
     (appointments, portal login, reports + files, before/after photos, recovery check-ins, reviews, revisit notices). This is permanent -
     take a database backup first if you may need those records. Once only SK### patients remain, it does nothing.
2. Appointments cannot be booked in the past.
   - AppointmentService.requireNotInPast: a past date is rejected, and on today's date a time that has already passed is rejected
     (reception booking, patient-portal booking, and moving an existing booking to another day/time). Editing notes/status of an old
     appointment, and the "Add today's visit" history entry (no time slot, Completed) are not affected.
   - The booking forms no longer offer slots that are over (reception form: overrides.js; patient portal: PatientPortal.jsx).
3. Revisit suggestions (a notice, never an obligation).
   - A doctor opens a patient's page > "Suggest a revisit": 1 week / 2 weeks / 1 month / 2 months / 3 months / 6 months or any later date, plus an optional note.
   - The patient sees a notice at the top of every portal page (and a desktop notification if they allowed notifications) with two buttons:
     "Book a visit" (opens the booking form with the doctor and date filled in) and "Not now" (dismisses it). Nothing is booked automatically.
   - The notice closes by itself when the patient books with that doctor. A newer suggestion from the same doctor replaces the older one.
   - Backend: RevisitSuggestion / RevisitService; POST+GET /api/patients/{id}/revisits (POST = doctors only), GET /api/portal/revisits,
     POST /api/portal/revisits/{id}/dismiss. New table `revisit_suggestions` is created automatically (ddl-auto=update).
   - There is no email/SMS sender in this project, so the notice reaches the patient in the portal only.
