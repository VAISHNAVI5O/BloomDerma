package com.bloomderma.api.service;

import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.repository.AppointmentRepository;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Revenue is computed from real appointment rows (cancelled ones are excluded).
 * Role rules:
 *  - ADMIN/STAFF: full clinic revenue, including doctor breakdown.
 *  - RECEPTIONIST: clinic totals only; doctor revenue breakdown is omitted.
 *  - DOCTOR: ONLY the authenticated doctor's revenue (query filtered by that doctor's id from the login account).
 */
@Service
@ConditionalOnProperty(name = "bloomderma.modules.revenue", havingValue = "true", matchIfMissing = true)
public class RevenueService {
    private final AppointmentRepository repo;
    private final DoctorRepository doctors;
    private final CurrentUser current;

    public RevenueService(AppointmentRepository repo, DoctorRepository doctors, CurrentUser current) {
        this.repo = repo;
        this.doctors = doctors;
        this.current = current;
    }

    private static long fee(Appointment a) { return a.getFee() == null ? 0L : a.getFee(); }

    public Map<String, Object> summary(Authentication authentication) {
        String role = current.role(authentication);
        String username = authentication == null ? "" : authentication.getName();
        LocalDate today = LocalDate.now();

        Doctor loggedInDoctor = null;
        List<Appointment> source;
        if ("DOCTOR".equals(role)) {
            String doctorId = current.doctorId(authentication);
            loggedInDoctor = doctorId == null ? null : doctors.findById(doctorId).orElse(null);
            source = doctorId == null ? List.of() : repo.findByDoctorId(doctorId);   // never findAll() for a doctor
        } else {
            source = repo.findAll();
        }
        List<Appointment> billed = source.stream().filter(a -> !"Cancelled".equals(a.getStatus())).toList();

        long total = billed.stream().mapToLong(RevenueService::fee).sum();
        long collected = billed.stream().mapToLong(Billing::paid).sum();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("username", username);
        m.put("doctorId", loggedInDoctor == null ? null : loggedInDoctor.getId());
        m.put("doctorName", loggedInDoctor == null ? null : loggedInDoctor.getName());
        m.put("totalRevenue", total);
        m.put("collectedRevenue", collected);
        m.put("pendingPayments", total - collected);
        m.put("todaysRevenue", billed.stream().filter(a -> today.equals(a.getDate())).mapToLong(RevenueService::fee).sum());
        m.put("monthlyRevenue", billed.stream()
                .filter(a -> a.getDate() != null && a.getDate().getMonth() == today.getMonth() && a.getDate().getYear() == today.getYear())
                .mapToLong(RevenueService::fee).sum());

        // Receptionists must not receive doctor-level revenue at all.
        if ("RECEPTIONIST".equals(role)) {
            m.put("byTreatment", byTreatment(billed));
            return m;
        }

        // A doctor receives only their own entry and own monthly graph data.
        if ("DOCTOR".equals(role)) {
            Map<String, Long> own = new LinkedHashMap<>();
            if (loggedInDoctor != null) own.put(loggedInDoctor.getName(), total);
            m.put("byDoctor", own);
            m.put("monthly", monthly(billed, today));
            return m;
        }

        m.put("byDoctor", billed.stream().collect(Collectors.groupingBy(
                a -> a.getDoctor().getName(), Collectors.summingLong(RevenueService::fee))));
        m.put("byTreatment", byTreatment(billed));
        return m;
    }

    private Map<String, Long> byTreatment(List<Appointment> billed) {
        return billed.stream().collect(Collectors.groupingBy(
                a -> a.getTreatment() == null ? "Other" : a.getTreatment(), Collectors.summingLong(RevenueService::fee)));
    }

    private List<Map<String, Object>> monthly(List<Appointment> billed, LocalDate today) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            final int m = month;
            long amount = billed.stream()
                    .filter(a -> a.getDate() != null && a.getDate().getYear() == today.getYear()
                            && a.getDate().getMonthValue() == m)
                    .mapToLong(RevenueService::fee)
                    .sum();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", LocalDate.of(today.getYear(), month, 1)
                    .getMonth().getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH));
            row.put("amount", amount);
            result.add(row);
        }
        return result;
    }
}
