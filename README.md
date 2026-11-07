# BloomDerma — Dermatology & Trichology Clinic Management System
Full Stack Java mini-project: **React + Axios → Spring Boot REST → JPA/Hibernate → MySQL**, secured with **JWT**, packaged with **Docker Compose**.

The UI is your original `myskin.html` design (CSS, markup, views and data unchanged). The demo arrays are now loaded from MySQL through the API.

## Architecture
```
Browser → React (Vite) → Axios (apiService.js) → REST/JSON → Spring Boot
        → Controller → Service → Repository → JPA/Hibernate → MySQL (derma_clinic_db)
Login → POST /api/auth/login → Spring Security → JWT → "Authorization: Bearer <token>" → protected APIs
Docker Compose: React(Nginx) container → Spring Boot container → MySQL container
```

## Run (development)
1. **MySQL 8** running locally (root / root), or edit `backend/src/main/resources/application.properties`.
2. **Backend** (Java 17, Maven): `cd backend && mvn spring-boot:run` → http://localhost:8080  
   First start creates the tables and seeds your doctors, patients, services and appointments.
3. **Frontend** (Node 18+): `cd frontend && npm install && npm run dev` → http://localhost:5173
4. Log in. The first screen asks **Doctor Login** or **Admin / Receptionist Login**. Seeded accounts:

| Login type | ID | Password |
|---|---|---|
| Admin / Receptionist | `admin` | `admin123` |
| Admin / Receptionist | `receptionist` | `reception123` |
| Admin / Receptionist | `staff` | `staff123` |
| Doctor (Dr. Ananya Sharma) | `ananya` | `doctor123` |
| Doctor (Dr. Riya Mehta) | `riya` | `doctor123` |
| Doctor (Dr. Arjun Kapoor) | `arjun` | `doctor123` |
| Doctor (Dr. Neha Patel) | `neha` | `doctor123` |
| Doctor (Dr. Kavya Iyer) | `kavya` | `doctor123` |
| Doctor (Dr. Rahul Shah) | `rahul` | `doctor123` |

   A doctor's login ID (first name for the demo doctors, or the Doctor ID the Admin chose) is linked to their doctor record (`users.doctor_id`). An Admin adds doctors under **Doctors → Add doctor** (unique Doctor ID, BCrypt password, speciality); the new doctor can log in immediately. Change the default passwords before real use.

   **Patient portal:** Patient Login → Home, Book Appointment, Video Consult (charges shown; in-browser WebRTC call), My Reports (upload), My Bills (Paid/Partial/Due), My Recovery (check-ins + progress). Demo patient: `patient1` / `patient123`. Patients can only reach `/api/portal/**`, `/api/video/**` and read-only doctor/service lookups.
   **Doctor reports:** a doctor types keywords + prescription → AI (or a built-in template when no `ANTHROPIC_API_KEY` is set) drafts the report → the doctor edits/approves → a PDF is saved to the patient's account (`POST /api/patients/{id}/reports/draft` and `/generated`, DOCTOR only). **Patient IDs:** assigned by the system in the format `SK###` (SK001, SK002 …); patients never choose their own. **Dark mode:** toggle in the top bar.
   **Sign-in first:** the login lives in the browser tab only; opening the site always shows sign-in. **Files:** uploaded reports and photos are stored in the database (`stored_files`), not in a folder.
   **Payments:** Admin/Receptionist record *Paid in full*, *Part paid* (amount received; remainder stays due) or *Not paid* — `PATCH /api/appointments/{id}/payment?paid=true|false` or `?amount=N`.

   **Roles:** ADMIN (manage doctors, book, all revenue) · RECEPTIONIST (book, patients/history, clinic revenue without per-doctor figures) · DOCTOR (all patient history, own appointments, own revenue + monthly graph; cannot book — `POST/PUT /api/appointments` returns 403).
   **Doctor suggestions:** `backend/src/main/resources/speciality-mapping.json` maps concerns/treatments to specialities; `GET /api/doctors/suggestions?concern=&treatment=` returns doctors whose stored speciality matches.

The dashboard also shows a **Popular skin treatments** section (laser, acne care, etc.), ranked from real visit data.

## Run (Docker)
`docker compose up --build` → open http://localhost:3000 (API on :8080, MySQL volume `mysql_data`).

## API (all except login need the JWT)
| Method | URL | Notes |
|---|---|---|
| POST | /api/auth/login | `{"username","password","loginType":"DOCTOR"\|"STAFF"}` → `{token,username,role[,doctorId]}` |
| GET | /api/dashboard/stats | 200 |
| GET/POST | /api/patients | POST → 201; GET supports `?search=` |
| GET/PUT/DELETE | /api/patients/{id} | DELETE = ADMIN only, 204 |
| GET/POST | /api/appointments | GET: doctors get only their own; POST: ADMIN/RECEPTIONIST only (403 for doctors); 409 if slot booked |
| GET | /api/patients/history | all patients + all visits (doctors: without fees) |
| GET/POST | /api/doctors | POST = ADMIN only (creates doctor + login) |
| GET | /api/doctors/suggestions?concern=&treatment= | speciality-matched doctors |
| GET/PUT/DELETE | /api/appointments/{id} | |
| PATCH | /api/appointments/{id}/status?value=Cancelled | Pending/Confirmed/Completed/Cancelled |
| GET/POST | /api/doctors, PUT/DELETE /api/doctors/{id} | writes = ADMIN |
| GET/POST | /api/services | POST = ADMIN |
| GET | /api/revenue | total, collected, pending, today, month, by doctor/treatment |

## Postman
1. `POST http://localhost:8080/api/auth/login`, header `Content-Type: application/json`, body `{"username":"admin","password":"admin123"}` → 200 with `token`.
2. Add header `Authorization: Bearer <token>` to every other request.
3. `POST /api/appointments` body:
```json
{"patientId":"SK010","patientName":"Test Patient","age":30,"gender":"Female","issue":"Acne",
 "doctorId":"doc1","treatment":"Skin Consultation","date":"2026-10-05","time":"09:00 AM","fee":1000}
```
→ **201**. Send it again → **409**. Missing `issue` → **400**. No token → **401**. `DELETE` as `staff` → **403**.

## Modules and switches
`application.properties` → `bloomderma.modules.{appointments,doctors,services,revenue}=true|false`.
Disabled modules are not loaded by Spring; the dashboard reports "unavailable" and the frontend shows a toast instead of crashing.
See `MODULE_DELETION_GUIDE.md`.

## Future scope
Prescriptions, medical records, payments table, CSV/PDF export, charts, reminders, audit log.


## Role-specific dashboard update

The interface/layout is unchanged. The latest update adds these role rules:

- **Receptionist:** can open Revenue & analytics, but the **Revenue by doctor** section is not shown and doctor-level revenue is not returned by the revenue API.
- **Doctor:** the booking buttons / New appointment action are hidden, and the Revenue page shows **only that doctor's revenue** with an individual **12-month revenue graph**.
- **Admin/Staff:** existing dashboard and doctor-level revenue behavior remains unchanged.

### VS Code / PowerShell commands

Open the extracted `bloomderma` folder in VS Code.

**Terminal 1 — backend**
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

If the project does not contain `mvnw.cmd`, use the Maven installation:
```powershell
cd backend
mvn spring-boot:run
```

**Terminal 2 — frontend**
```powershell
cd frontend
npm install
npm run dev
```

Then open the Vite URL shown in the terminal (normally `http://localhost:5173`).

### Test logins

- Receptionist: `receptionist` / `reception123`
- Doctor: `ananya` / `doctor123`
- Doctor: `riya` / `doctor123`
- Doctor: `arjun` / `doctor123`
- Admin: `admin` / `admin123`

If you already have the backend running, restart it after replacing the project so the updated Java revenue rules are loaded.
