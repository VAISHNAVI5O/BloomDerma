package com.bloomderma.api.service;

import com.bloomderma.api.dto.DashboardStats;
import com.bloomderma.api.repository.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.security.core.Authentication;
import com.bloomderma.api.security.CurrentUser;

/** Depends on OPTIONAL beans (ObjectProvider) so a disabled module never breaks the dashboard. */
@Service
public class DashboardService {
    private final PatientRepository patients;
    private final DoctorRepository doctors;
    private final ObjectProvider<AppointmentService> appointmentService;
    private final ObjectProvider<RevenueService> revenueService;
    private final ObjectProvider<DoctorService> doctorService;
    private final AppointmentRepository appointmentRepo;
    private final CurrentUser current;

    public DashboardService(PatientRepository p, DoctorRepository d, AppointmentRepository ar,
            ObjectProvider<AppointmentService> as, ObjectProvider<RevenueService> rs, ObjectProvider<DoctorService> ds, CurrentUser current) {
        this.current = current;
        this.patients = p; this.doctors = d; this.appointmentRepo = ar;
        this.appointmentService = as; this.revenueService = rs; this.doctorService = ds;
    }

    public DashboardStats stats(Authentication authentication) {
        java.time.LocalDate today = java.time.LocalDate.now();
        Long appts = null, revenue = null, docs = null;
        String aNote = null, rNote = null, dNote = null;
        if (appointmentService.getIfAvailable() != null)
            appts = appointmentRepo.findByDateAndStatusNot(today, "Cancelled").stream()
                    .filter(a -> !current.isDoctor(authentication)
                            || (current.doctorId(authentication) != null && current.doctorId(authentication).equals(a.getDoctor().getId())))
                    .count();
        else aNote = "No appointment module available";
        if (revenueService.getIfAvailable() != null)
            revenue = ((Number) revenueService.getIfAvailable().summary(authentication).get("todaysRevenue")).longValue();
        else rNote = "Revenue data unavailable";
        if (doctorService.getIfAvailable() != null) docs = doctors.count();
        else dNote = "Doctor module unavailable";
        return new DashboardStats(patients.count(), docs, appts, revenue, aNote, rNote, dNote);
    }
}
