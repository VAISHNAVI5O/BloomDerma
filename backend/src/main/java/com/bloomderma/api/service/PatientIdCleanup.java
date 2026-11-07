package com.bloomderma.api.service;

import com.bloomderma.api.model.Patient;
import com.bloomderma.api.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * On every start-up, removes patients whose ID is not in the clinic format SK### (see PatientIdGenerator), together
 * with everything that belongs to them: appointments, portal login, reports (and their files), before/after photos,
 * recovery check-ins, reviews and revisit suggestions. It does nothing once only SK### patients are left, and since
 * new patients can only get system-assigned SK### IDs, no new "wrong" records can appear.
 * Dependent rows are removed first and the patient last, so an interrupted run is simply finished on the next start.
 */
@Component
public class PatientIdCleanup implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(PatientIdCleanup.class);
    private final PatientRepository patients;
    private final AppointmentRepository appointments;
    private final UserRepository users;
    private final ReportService reports;
    private final PhotoService photos;
    private final RecoveryLogRepository recovery;
    private final ReviewRepository reviews;
    private final RevisitSuggestionRepository revisits;

    public PatientIdCleanup(PatientRepository patients, AppointmentRepository appointments, UserRepository users,
                            ReportService reports, PhotoService photos, RecoveryLogRepository recovery,
                            ReviewRepository reviews, RevisitSuggestionRepository revisits) {
        this.patients = patients; this.appointments = appointments; this.users = users; this.reports = reports;
        this.photos = photos; this.recovery = recovery; this.reviews = reviews; this.revisits = revisits;
    }

    @Override
    public void run(String... args) { removeInvalidPatients(); }

    /** @return how many patients were removed */
    public int removeInvalidPatients() {
        List<String> bad = patients.findAll().stream().map(Patient::getId)
                .filter(id -> !PatientIdGenerator.isValid(id)).toList();
        for (String id : bad) {
            appointments.deleteAll(appointments.findByPatientId(id));
            users.findByPatientId(id).ifPresent(users::delete);
            reports.list(id).forEach(reports::delete);
            photos.list(id).forEach(photos::delete);
            recovery.deleteAll(recovery.findByPatientIdOrderByLogDateAscIdAsc(id));
            reviews.deleteAll(reviews.findAll().stream().filter(r -> id.equals(r.getPatientId())).toList());
            revisits.deleteAll(revisits.findByPatientIdOrderByCreatedAtDesc(id));
            patients.deleteById(id);
            log.warn("Removed patient {} (ID is not in the format SK###) and all of their records.", id);
        }
        return bad.size();
    }
}
