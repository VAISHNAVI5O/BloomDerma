package com.bloomderma.api.service;

import com.bloomderma.api.dto.*;
import com.bloomderma.api.exception.*;
import com.bloomderma.api.model.*;
import com.bloomderma.api.repository.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
@ConditionalOnProperty(name = "bloomderma.modules.appointments", havingValue = "true", matchIfMissing = true)
public class AppointmentService {
    private final AppointmentRepository appointments;
    private final PatientRepository patients;
    private final DoctorRepository doctors;
    private final CurrentUser current;
    private final PatientIdGenerator ids;

    public AppointmentService(AppointmentRepository a, PatientRepository p, DoctorRepository d, CurrentUser c, PatientIdGenerator ids) {
        this.appointments = a; this.patients = p; this.doctors = d; this.current = c; this.ids = ids;
    }

    /** Doctors only ever receive THEIR OWN appointments (filtered by the authenticated doctor's id). */
    public List<AppointmentDto> findAll(Authentication auth) {
        if (current.isDoctor(auth)) {
            String doctorId = current.doctorId(auth);
            if (doctorId == null) return List.of();
            return appointments.findByDoctorId(doctorId).stream().map(AppointmentDto::from).toList();
        }
        return appointments.findAll().stream().map(AppointmentDto::from).toList();
    }

    public AppointmentDto get(Long id, Authentication auth) {
        Appointment a = find(id);
        requireOwnerIfDoctor(a, auth);
        return AppointmentDto.from(a);
    }

    /** Booking is server-side restricted to ADMIN / RECEPTIONIST (also enforced in SecurityConfig). */
    private void requireFrontDesk(Authentication auth) {
        if (!current.isFrontDesk(auth)) throw new AccessDeniedException("Only Admin or Receptionist can book appointments.");
    }

    private void requireOwnerIfDoctor(Appointment a, Authentication auth) {
        if (!current.isDoctor(auth)) return;
        String doctorId = current.doctorId(auth);
        if (doctorId == null || a.getDoctor() == null || !doctorId.equals(a.getDoctor().getId()))
            throw new AccessDeniedException("You can only access your own appointments.");
    }

    @Transactional
    public AppointmentDto create(AppointmentRequest r, Authentication auth) {
        requireFrontDesk(auth);
        requireNotInPast(r);
        String pid = r.patientId() == null ? "" : r.patientId().trim();
        Patient patient;
        if (pid.isEmpty()) {                      // new patient: the system generates a unique alphanumeric ID
            Patient p = new Patient();
            p.setId(ids.next()); p.setName(r.patientName()); p.setAge(r.age()); p.setGender(r.gender());
            p.setSkinConcern(r.issue()); p.setRegistrationDate(LocalDate.now());
            patient = patients.save(p);
        } else {
            patient = patients.findById(pid).orElseThrow(() -> new IllegalArgumentException(
                    "Patient ID " + pid + " was not found. Leave Patient ID blank to register a new patient."));
        }
        Appointment a = new Appointment();
        a.setPatient(patient);
        apply(a, r);
        return AppointmentDto.from(appointments.save(a));
    }

    @Transactional
    public AppointmentDto update(Long id, AppointmentRequest r, Authentication auth) {
        requireFrontDesk(auth);
        Appointment a = find(id);
        String newTime = r.time() == null || r.time().isBlank() ? null : r.time();
        if (!java.util.Objects.equals(a.getDate(), r.date()) || !java.util.Objects.equals(a.getTimeSlot(), newTime))
            requireNotInPast(r);                        // moving a booking to another day/time is a new booking: it must be in the future
        apply(a, r);
        return AppointmentDto.from(appointments.save(a));
    }

    /**
     * Front desk records payment: paid=true (all paid), paid=false (nothing paid, full amount due),
     * or amount=N (part payment; the rest stays due). A part payment equal to the fee counts as fully paid.
     */
    @Transactional
    public AppointmentDto updatePayment(Long id, Boolean paid, Integer amount, Authentication auth) {
        requireFrontDesk(auth);
        Appointment a = find(id);
        int fee = Billing.fee(a);
        if (amount != null) {
            if (amount < 0 || amount > fee) throw new IllegalArgumentException("Amount paid must be between 0 and " + fee);
            a.setAmountPaid(amount); a.setPaid(amount >= fee);
        } else if (paid != null) {
            a.setAmountPaid(paid ? fee : 0); a.setPaid(paid);
        } else {
            throw new IllegalArgumentException("Provide paid=true|false or amount=N");
        }
        return AppointmentDto.from(appointments.save(a));
    }

    /** Booking made by a logged-in patient for THEIR OWN record (identity checked by the caller). */
    @Transactional
    public AppointmentDto bookForPatient(String patientId, AppointmentRequest r, String mode) {
        requireNotInPast(r);
        Patient patient = patients.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient " + patientId + " not found"));
        Appointment a = new Appointment();
        a.setPatient(patient);
        apply(a, r);
        a.setConsultMode(mode);
        return AppointmentDto.from(appointments.save(a));
    }

    public AppointmentDto updateStatus(Long id, String status, Authentication auth) {
        if (!List.of("Pending", "Confirmed", "Completed", "Cancelled").contains(status))
            throw new IllegalArgumentException("Invalid status: " + status);
        Appointment a = find(id);
        requireOwnerIfDoctor(a, auth);          // a doctor may only change status of his/her own appointments
        if ("Cancelled".equals(status) && !"Cancelled".equals(a.getStatus())) {   // staff can cancel only until the appointment time arrives
            java.time.LocalDateTime start = ApptTime.start(a);
            if (start != null && !java.time.LocalDateTime.now().isBefore(start))
                throw new IllegalArgumentException("The appointment time has arrived, so it can no longer be cancelled.");
        }
        a.setStatus(status);
        return AppointmentDto.from(appointments.save(a));
    }

    public void delete(Long id) { find(id); appointments.deleteById(id); }

    private Appointment find(Long id) {
        return appointments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Appointment " + id + " not found"));
    }

    /**
     * An appointment cannot be booked for a day that has passed, nor for a time that has already passed today.
     * (A history-only entry - no time slot and status "Completed", as added from the patient's history page - is not a booking.)
     */
    private void requireNotInPast(AppointmentRequest r) {
        boolean noSlot = r.time() == null || r.time().isBlank();
        if (noSlot && "Completed".equalsIgnoreCase(r.status())) return;
        LocalDate today = LocalDate.now();
        if (r.date().isBefore(today))
            throw new IllegalArgumentException("That date has already passed. Please choose today or a future date.");
        java.time.LocalDateTime start = ApptTime.start(r.date(), r.time());
        if (start != null && !start.isAfter(java.time.LocalDateTime.now()))
            throw new IllegalArgumentException("That time has already passed. Please choose a later time slot.");
    }

    /** Copies request fields onto the entity and blocks double booking of a doctor's slot. */
    private void apply(Appointment a, AppointmentRequest r) {
        Doctor doctor = doctors.findById(r.doctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor " + r.doctorId() + " not found"));
        if (r.time() != null && !r.time().isBlank()) {
            boolean taken = appointments.findByDoctorIdAndDateAndTimeSlotAndStatusNot(
                    doctor.getId(), r.date(), r.time(), "Cancelled").stream()
                    .anyMatch(x -> !x.getId().equals(a.getId()));
            if (taken) throw new ConflictException("This slot is already booked for " + doctor.getName() + ".");
        }
        a.setDoctor(doctor);
        a.setIssue(r.issue()); a.setTreatment(r.treatment());
        a.setDate(r.date()); a.setTimeSlot(r.time() == null || r.time().isBlank() ? null : r.time());
        a.setFee(r.fee()); a.setNotes(r.notes());
        a.setStatus(r.status() == null || r.status().isBlank() ? "Confirmed" : r.status());
    }
}
