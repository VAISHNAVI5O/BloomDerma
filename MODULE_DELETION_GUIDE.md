# Module Deletion / Disable Guide
| Module | Backend | Table | Frontend behaviour when disabled |
|---|---|---|---|
| Appointments | `bloomderma.modules.appointments=false` (removes controller + service) | appointments | Toast "Appointments module unavailable"; Patients/Doctors/Services still load. Dashboard says "No appointment module available". |
| Revenue | `bloomderma.modules.revenue=false` | none (computed) | `/api/revenue` returns 404; dashboard stat = "Revenue data unavailable"; rest works. |
| Doctors | `bloomderma.modules.doctors=false` | doctors | Toast; app still starts. **Note:** appointments reference doctors, so booking needs it. |
| Services | `bloomderma.modules.services=false` | services | Services page empty; nothing else depends on it. |

**Core, cannot be removed independently:** Spring Boot, MySQL, React shell, Patients (appointments have a foreign key to patients), Authentication.

**Demo steps:** stop backend → edit the property → restart → reload the browser. To demo "frontend without backend": stop the backend and reload — a toast says the API is unavailable.

**Known limitation:** the page views are still the original HTML views, so a disabled module's *page and nav link stay visible but empty*. Removing the nav link and page per feature comes with the per-page JSX conversion (next step).
