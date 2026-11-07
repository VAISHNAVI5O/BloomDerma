package com.bloomderma.api.config;

import com.bloomderma.api.model.*;
import com.bloomderma.api.repository.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.*;

/** On first start (empty DB) loads the doctors/patients/services/appointments from your original myskin.html. */
@Component
public class DataSeeder implements CommandLineRunner {
    private final DoctorRepository doctors; private final PatientRepository patients;
    private final ClinicServiceRepository services; private final AppointmentRepository appointments;
    private final UserRepository users; private final PasswordEncoder encoder;

    public DataSeeder(DoctorRepository d, PatientRepository p, ClinicServiceRepository s,
                      AppointmentRepository a, UserRepository u, PasswordEncoder e) {
        doctors = d; patients = p; services = s; appointments = a; users = u; encoder = e;
    }

    private static final Map<String, Integer> PRICES = Map.of("Acne Care", 1000, "Chemical Peel", 3000,
        "Laser Treatment", 3500, "Pigmentation", 1200, "Microneedling", 4500, "Skin Rejuvenation", 5000,
        "Hair & Scalp", 1500, "Tattoo Removal", 6000);

    @Override
    public void run(String... args) throws Exception {
        // Idempotent: also adds missing logins on databases created by an older version.
        seedUserIfMissing("admin", "admin123", "ADMIN");
        seedUserIfMissing("staff", "staff123", "STAFF");
        seedUserIfMissing("receptionist", "reception123", "RECEPTIONIST");
        seedDoctorLogins();
        seedDemoPatientLogin();
        if (doctors.count() > 0) return;
        JsonNode seed = new ObjectMapper().readTree(new ClassPathResource("seed.json").getInputStream());
        ObjectMapper om = new ObjectMapper();

        for (JsonNode n : seed.get("DOCTORS")) {
            Doctor d = new Doctor();
            d.setId(n.get("id").asText()); d.setName(n.get("name").asText()); d.setSpecialty(n.get("specialty").asText());
            d.setBio(n.get("bio").asText()); d.setColor1(n.get("color1").asText()); d.setColor2(n.get("color2").asText());
            d.setSlots(om.convertValue(n.get("slots"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
            d.setTreats(om.convertValue(n.get("treats"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
            doctors.save(d);
        }
        for (JsonNode n : seed.get("SERVICES")) {
            ClinicService s = new ClinicService();
            s.setName(n.get("name").asText()); s.setIcon(n.get("icon").asText());
            s.setDescription(n.get("description").asText()); s.setPrice(PRICES.getOrDefault(s.getName(), 1000));
            services.save(s);
        }
        for (JsonNode n : seed.get("PATIENTS")) {
            Patient p = new Patient();
            p.setId(n.get("id").asText()); p.setName(n.get("name").asText()); p.setAge(n.get("age").asInt());
            p.setGender(n.get("gender").asText()); p.setRegistrationDate(LocalDate.now());
            p.setSkinConcern(n.get("visits").get(0).get("issue").asText());
            patients.save(p);
            for (JsonNode v : n.get("visits")) {                       // each old "visit" becomes a Completed appointment row
                Appointment a = new Appointment();
                a.setPatient(p); a.setDoctor(doctors.getReferenceById(v.get("doctorId").asText()));
                a.setIssue(v.get("issue").asText()); a.setTreatment(v.get("treatment").asText());
                a.setDate(toDate(v.get("date").asText())); a.setFee(v.get("fee").asInt());
                a.setStatus("Completed"); a.setPaid(v.get("paid").asBoolean());
                appointments.save(a);
            }
        }
        for (JsonNode n : seed.get("APPOINTMENTS")) {
            Appointment a = new Appointment();
            a.setPatient(patients.getReferenceById(n.get("patientId").asText()));
            a.setDoctor(doctors.getReferenceById(n.get("doctorId").asText()));
            a.setIssue(n.get("issue").asText()); a.setTreatment(n.get("treatment").asText());
            a.setDate(toDate(n.get("date").asText())); a.setTimeSlot(n.get("time").asText());
            a.setFee(n.get("fee").asInt()); a.setStatus(n.get("status").asText());
            appointments.save(a);
        }
        seedDoctorLogins();
        seedDemoPatientLogin();
    }

    /** Demo portal login for the existing demo patient SK001 (username patient1 / password patient123). */
    private void seedDemoPatientLogin() {
        if (!patients.existsById("SK001") || users.findByPatientId("SK001").isPresent()
                || users.findByUsername("patient1").isPresent()) return;
        User u = new User();
        u.setUsername("patient1"); u.setPassword(encoder.encode("patient123"));
        u.setRole("PATIENT"); u.setPatientId("SK001");
        users.save(u);
    }

    /** The six demo doctors from seed.json log in with their first name (ananya, riya ...). Others use their Doctor ID. */
    private static final java.util.Set<String> SEED_DOCTOR_IDS = java.util.Set.of("doc1", "doc2", "doc3", "doc4", "doc5", "doc6");

    private String loginNameFor(Doctor d) {
        if (!SEED_DOCTOR_IDS.contains(d.getId())) return d.getId();
        String first = d.getName().replace("Dr.", "").trim().split("\\s+")[0].toLowerCase();
        return users.findByUsername(first).isPresent() ? d.getId() : first;   // first-name clash -> fall back to ID
    }

    /**
     * Every doctor owns exactly one login linked through users.doctor_id. Idempotent, so databases from older
     * versions are upgraded on start (a login already renamed to "doc1" is renamed back to the first name; password unchanged).
     */
    private void seedDoctorLogins() {
        for (Doctor d : doctors.findAll()) {
            User linked = users.findByDoctorId(d.getId()).orElse(null);
            if (linked != null) {
                if (SEED_DOCTOR_IDS.contains(d.getId()) && linked.getUsername().equals(d.getId())) {
                    String wanted = loginNameFor(d);
                    if (!wanted.equals(linked.getUsername())) { linked.setUsername(wanted); users.save(linked); }
                }
                continue;
            }
            String first = d.getName().replace("Dr.", "").trim().split("\\s+")[0].toLowerCase();
            User legacy = users.findByUsername(first).orElse(null);
            if (legacy != null && "DOCTOR".equals(legacy.getRole()) && legacy.getDoctorId() == null) {
                legacy.setDoctorId(d.getId());                      // old first-name login keeps its name and password
                users.save(legacy);
                continue;
            }
            String login = loginNameFor(d);
            if (users.findByUsername(login).isEmpty()) {
                User u = new User(); u.setUsername(login); u.setPassword(encoder.encode("doctor123"));
                u.setRole("DOCTOR"); u.setDoctorId(d.getId());
                users.save(u);
            }
        }
        List<User> orphans = users.findAll().stream()
                .filter(u -> "DOCTOR".equals(u.getRole()) && u.getDoctorId() == null).toList();
        users.deleteAll(orphans);
    }

    /** seed.json stores dates as "D18" = 18 days ago, "D0" = today. */
    private LocalDate toDate(String marker) { return LocalDate.now().minusDays(Long.parseLong(marker.substring(1))); }

    private void seedUserIfMissing(String name, String pass, String role) {
        if (users.findByUsername(name).isPresent()) return;
        seedUser(name, pass, role);
    }

    private void seedUser(String name, String pass, String role) {
        User u = new User(); u.setUsername(name); u.setPassword(encoder.encode(pass)); u.setRole(role); users.save(u);
    }
}
