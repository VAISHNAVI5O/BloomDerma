package com.bloomderma.api.service;

import com.bloomderma.api.dto.RevisitDto;
import com.bloomderma.api.dto.RevisitRequest;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.model.RevisitSuggestion;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.repository.RevisitSuggestionRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Revisit suggestions. A doctor suggests that a patient comes back (e.g. after a month); the patient sees a notice in
 * the portal but is free to book or to ignore it - nothing is ever booked automatically and nothing is forced.
 * Statuses: ACTIVE (shown to the patient) | BOOKED (patient booked with that doctor) | DISMISSED (patient chose not to) | REPLACED (doctor sent a newer one).
 */
@Service
public class RevisitService {
    private final RevisitSuggestionRepository repo;
    private final PatientRepository patients;
    private final DoctorRepository doctors;
    private final CurrentUser current;

    public RevisitService(RevisitSuggestionRepository repo, PatientRepository patients, DoctorRepository doctors, CurrentUser current) {
        this.repo = repo; this.patients = patients; this.doctors = doctors; this.current = current;
    }

    /** Doctor only: the doctor is taken from the login, never from the request. */
    @Transactional
    public RevisitDto suggest(String patientId, RevisitRequest r, Authentication auth) {
        String doctorId = current.doctorId(auth);
        if (doctorId == null) throw new AccessDeniedException("Only a doctor can suggest a revisit.");
        if (!patients.existsById(patientId)) throw new ResourceNotFoundException("Patient " + patientId + " not found");
        if (!r.date().isAfter(LocalDate.now())) throw new IllegalArgumentException("Choose a date after today for the revisit.");
        String note = r.note() == null ? "" : r.note().trim();
        if (note.contains("<") || note.contains(">")) throw new IllegalArgumentException("The note cannot contain < or >.");

        for (RevisitSuggestion old : repo.findByPatientIdAndStatusOrderBySuggestedDateAsc(patientId, "ACTIVE"))
            if (doctorId.equals(old.getDoctorId())) { old.setStatus("REPLACED"); repo.save(old); }   // only the doctor's latest suggestion stays visible

        RevisitSuggestion s = new RevisitSuggestion();
        s.setPatientId(patientId); s.setDoctorId(doctorId); s.setSuggestedDate(r.date());
        s.setNote(note.isEmpty() ? null : note); s.setStatus("ACTIVE"); s.setCreatedAt(LocalDateTime.now());
        return dto(repo.save(s));
    }

    /** Everything suggested for one patient (doctors and staff look at this on the patient page). */
    public List<RevisitDto> forPatient(String patientId) {
        return repo.findByPatientIdOrderByCreatedAtDesc(patientId).stream().map(this::dto).toList();
    }

    /** What the patient sees as a notice: suggestions that are still open. */
    public List<RevisitDto> active(String patientId) {
        return repo.findByPatientIdAndStatusOrderBySuggestedDateAsc(patientId, "ACTIVE").stream().map(this::dto).toList();
    }

    /** The patient decides not to book (now). They stay free to book an appointment whenever they like. */
    @Transactional
    public void dismiss(String patientId, Long id) {
        RevisitSuggestion s = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Revisit suggestion " + id + " not found"));
        if (!s.getPatientId().equals(patientId)) throw new ResourceNotFoundException("Revisit suggestion " + id + " not found");
        if ("ACTIVE".equals(s.getStatus())) { s.setStatus("DISMISSED"); repo.save(s); }
    }

    /** The patient booked an appointment with the suggesting doctor: the notice has done its job. */
    @Transactional
    public void markBooked(String patientId, String doctorId) {
        for (RevisitSuggestion s : repo.findByPatientIdAndStatusOrderBySuggestedDateAsc(patientId, "ACTIVE"))
            if (s.getDoctorId().equals(doctorId)) { s.setStatus("BOOKED"); repo.save(s); }
    }

    private RevisitDto dto(RevisitSuggestion s) {
        String name = doctors.findById(s.getDoctorId()).map(Doctor::getName).orElse(s.getDoctorId());
        return RevisitDto.from(s, name);
    }
}
