package com.bloomderma.api.service;

import com.bloomderma.api.dto.*;
import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.repository.AppointmentRepository;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * Patient history = every patient with every visit, across ALL doctors.
 * ADMIN / RECEPTIONIST get billing (fee/paid) per visit; DOCTORS get the full clinical history
 * but fee/paid are removed, so no other doctor's revenue can leak through history.
 */
@Service
public class PatientHistoryService {
    private final PatientRepository patients;
    private final AppointmentRepository appointments;
    private final CurrentUser current;

    public PatientHistoryService(PatientRepository p, AppointmentRepository a, CurrentUser c) {
        patients = p; appointments = a; current = c;
    }

    public List<PatientHistoryDto> all(Authentication auth) {
        boolean showBilling = !current.isDoctor(auth);
        Map<String, List<Appointment>> byPatient = new HashMap<>();
        for (Appointment a : appointments.findAll())
            byPatient.computeIfAbsent(a.getPatient().getId(), k -> new ArrayList<>()).add(a);

        List<PatientHistoryDto> out = new ArrayList<>();
        for (Patient p : patients.findAll()) {
            List<VisitDto> visits = byPatient.getOrDefault(p.getId(), List.of()).stream()
                    .sorted(Comparator.comparing((Appointment a) -> a.getDate() == null ? LocalDate.MIN : a.getDate()).reversed())
                    .map(a -> new VisitDto(a.getId(), a.getDate(), a.getTimeSlot(), a.getDoctor().getId(), a.getDoctor().getName(),
                            a.getIssue(), a.getTreatment(),
                            showBilling ? a.getFee() : null, showBilling ? Boolean.valueOf(Billing.due(a) == 0) : null,
                            showBilling ? Integer.valueOf(Billing.paid(a)) : null, a.getStatus()))
                    .toList();
            out.add(new PatientHistoryDto(p.getId(), p.getName(), p.getAge(), p.getGender(), p.getPhone(), p.getEmail(),
                    p.getAddress(), p.getSkinConcern(), p.getMedicalHistory(), p.getAllergies(), p.getRegistrationDate(), visits));
        }
        out.sort(Comparator.comparing(PatientHistoryDto::name, String.CASE_INSENSITIVE_ORDER));
        return out;
    }
}
