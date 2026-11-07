package com.bloomderma.api.service;

import com.bloomderma.api.dto.*;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.repository.AppointmentRepository;
import com.bloomderma.api.repository.ClinicServiceRepository;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/** Everything a logged-in PATIENT can do. The patient is ALWAYS taken from the login token, never from the request. */
@Service
public class PortalService {
    private final PatientRepository patients;
    private final AppointmentRepository appointments;
    private final DoctorRepository doctors;
    private final AppointmentService appointmentService;
    private final FeeConfig fees;
    private final CurrentUser current;
    private final ClinicServiceRepository clinicServices;
    private final PaymentService payments;
    private final RevisitService revisits;

    public PortalService(PatientRepository patients, AppointmentRepository appointments, DoctorRepository doctors,
                         AppointmentService appointmentService, FeeConfig fees, CurrentUser current,
                         ClinicServiceRepository clinicServices, PaymentService payments, RevisitService revisits) {
        this.clinicServices = clinicServices; this.payments = payments; this.revisits = revisits;
        this.patients = patients; this.appointments = appointments; this.doctors = doctors;
        this.appointmentService = appointmentService; this.fees = fees; this.current = current;
    }

    public String patientId(Authentication auth) {
        String id = current.patientId(auth);
        if (id == null) throw new AccessDeniedException("Patient account required.");
        return id;
    }

    public Patient me(Authentication auth) {
        String id = patientId(auth);
        return patients.findById(id).orElseThrow(() -> new ResourceNotFoundException("Patient " + id + " not found"));
    }

    public List<AppointmentDto> myAppointments(Authentication auth) {
        return appointments.findByPatientId(patientId(auth)).stream()
                .sorted(Comparator.comparing((Appointment a) -> a.getDate() == null ? LocalDate.MIN : a.getDate()).reversed())
                .map(AppointmentDto::from).toList();
    }

    @Transactional
    public AppointmentDto book(PortalBookingRequest r, Authentication auth) {
        String pid = patientId(auth);
        Patient p = me(auth);
        Doctor d = doctors.findById(r.doctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor " + r.doctorId() + " not found"));
        if (r.date().isBefore(LocalDate.now())) throw new IllegalArgumentException("Choose today or a future date.");
        if (d.getSlots() == null || !d.getSlots().contains(r.time()))
            throw new IllegalArgumentException("That time is not available for " + d.getName() + ".");
        String concern = clean(r.concern());
        String treatment = r.video() ? "Video Consultation"
                : (r.treatment() == null || r.treatment().isBlank() ? "Skin Consultation" : clean(r.treatment()));
        int fee = r.video() ? fees.video(d)                                  // charges are decided by the server, never the browser
                : clinicServices.findAll().stream()
                        .filter(c -> c.getName().equalsIgnoreCase(treatment) && c.getPrice() != null)
                        .map(c -> c.getPrice()).findFirst().orElse(fees.inClinic());
        AppointmentRequest req = new AppointmentRequest(pid, p.getName(), p.getAge() == null ? 0 : p.getAge(), p.getGender(),
                concern, d.getId(), treatment, r.date(), r.time(), fee, (r.video() && fee > 0) ? "Pending" : "Confirmed", null);   // video: confirmed after online payment (a Rs.0 fee needs no payment)
        AppointmentDto booked = appointmentService.bookForPatient(pid, req, r.video() ? "VIDEO" : "IN_CLINIC");
        revisits.markBooked(pid, d.getId());          // a revisit notice from this doctor is closed once the patient books
        return booked;
    }

    /** Open revisit suggestions for the logged-in patient (a notice only - booking stays optional). */
    public List<RevisitDto> myRevisits(Authentication auth) { return revisits.active(patientId(auth)); }

    public void dismissRevisit(Long id, Authentication auth) { revisits.dismiss(patientId(auth), id); }

    /** Patient pays the fee of one of THEIR OWN appointments online (used for video consultations). */
    public AppointmentDto pay(Long id, PaymentRequest r, Authentication auth) {
        return payments.pay(id, patientId(auth), r);
    }

    @Transactional
    public AppointmentDto cancel(Long id, Authentication auth) {
        Appointment a = appointments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Appointment " + id + " not found"));
        if (!a.getPatient().getId().equals(patientId(auth))) throw new ResourceNotFoundException("Appointment " + id + " not found");
        if ("Cancelled".equals(a.getStatus()) || "Completed".equals(a.getStatus()))
            throw new IllegalArgumentException("This appointment can no longer be cancelled.");
        if (a.getDate() != null && a.getDate().isBefore(LocalDate.now())) throw new IllegalArgumentException("Past appointments cannot be cancelled.");
        java.time.LocalDateTime start = ApptTime.start(a);
        if (start != null && !java.time.LocalDateTime.now().isBefore(start.minusHours(1)))
            throw new IllegalArgumentException("Appointments can only be cancelled by you up to 1 hour before the scheduled time - please contact the clinic.");
        if (Billing.paid(a) > 0) throw new IllegalArgumentException("A payment is already recorded - please contact the clinic to cancel.");
        a.setStatus("Cancelled");
        return AppointmentDto.from(appointments.save(a));
    }

    /** All bills of this patient (cancelled visits excluded) with totals. */
    public Map<String, Object> bills(Authentication auth) {
        List<Appointment> mine = appointments.findByPatientId(patientId(auth)).stream()
                .filter(a -> !"Cancelled".equals(a.getStatus()))
                .sorted(Comparator.comparing((Appointment a) -> a.getDate() == null ? LocalDate.MIN : a.getDate()).reversed())
                .toList();
        long billed = mine.stream().mapToLong(Billing::fee).sum();
        long paid = mine.stream().mapToLong(Billing::paid).sum();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalBilled", billed);
        out.put("totalPaid", paid);
        out.put("totalDue", billed - paid);
        out.put("bills", mine.stream().map(BillDto::from).toList());
        return out;
    }

    /** Time slots of a doctor that are already taken on a date (so the patient only sees free ones). */
    public List<String> bookedSlots(String doctorId, LocalDate date) {
        return appointments.findByDoctorId(doctorId).stream()
                .filter(a -> date.equals(a.getDate()) && a.getTimeSlot() != null && !"Cancelled".equals(a.getStatus()))
                .map(Appointment::getTimeSlot).toList();
    }

    public Map<String, Object> fees() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("inClinic", fees.inClinic());
        return m;
    }

    /** Free text typed by a patient ends up in staff screens: no markup allowed. */
    private static String clean(String s) {
        String t = s == null ? "" : s.trim();
        if (t.contains("<") || t.contains(">")) throw new IllegalArgumentException("Text cannot contain < or >.");
        return t;
    }
}
