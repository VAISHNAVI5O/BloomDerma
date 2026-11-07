# Syllabus Mapping
| Module | Requirement | BloomDerma implementation | Location |
|---|---|---|---|
| I | Full stack, client–server, MVC, Maven, Spring Boot | React (view) → Controller → Service → Repository (MVC-style layers); Maven build | `backend/pom.xml`, `backend/.../controller`, `service`, `repository`, `model` |
| II | HTML5, CSS3, responsive, forms, tables, modals, icons | Original BloomDerma UI (semantic HTML, CSS variables, media queries at 1000/800/600px, forms, modals). *Bootstrap Icons are used; Bootstrap CSS was deliberately not added so the design stays identical.* | `frontend/src/styles/bloomderma.css`, `frontend/src/legacy/shell.html` |
| II | React.js basics, Fetch/Axios | React components, hooks (`useState`, `useEffect`), Axios | `frontend/src/App.jsx`, `components/`, `services/apiService.js` |
| III | Spring Boot, REST, DI/IoC, annotations, exceptions | `@RestController`, `@RequestMapping`, `@Get/Post/Put/Patch/DeleteMapping`, `@RequestBody`, `@PathVariable`, `@RequestParam`, constructor injection, `@RestControllerAdvice` | `backend/.../controller/*`, `exception/GlobalExceptionHandler.java` |
| III | Validation, DTOs | `@Valid`, `@NotBlank`, `@Min`, records | `dto/AppointmentRequest.java` |
| IV | MySQL, DDL/DML, joins, keys | `derma_clinic_db`; tables patients, doctors, services, appointments, users (+ doctor_slots, doctor_treats) | `database/schema.sql` |
| IV | JPA/Hibernate, entities, JpaRepository, derived queries | `@Entity`, `@Id`, `@ManyToOne`, `@OneToMany`, `findByDoctorIdAndDateAndTimeSlotAndStatusNot` | `backend/.../model`, `repository` |
| V | React ↔ Spring Boot, CORS, Axios, Postman | Axios service + interceptors, CORS bean, Vite proxy | `services/apiService.js`, `security/SecurityConfig.java` |
| V | JWT, Spring Security, RBAC, protected routes | Login → JWT → filter → role rules (DELETE = ADMIN); React login gate, 401 → logout | `security/*`, `AuthService`, `components/LoginGate.jsx` |
| VI | Docker, Compose, Nginx, multi-stage builds | 3 containers | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `nginx.conf` |
| VI | Git/GitHub, docs | `.gitignore`, README | root |
