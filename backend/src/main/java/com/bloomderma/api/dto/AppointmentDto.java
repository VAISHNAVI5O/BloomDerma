package com.bloomderma.api.dto;

import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.service.Billing;
import java.time.LocalDate;

/** Output DTO: flat JSON so React does not need to walk entity graphs. amountPaid/due come from Billing. */
public record AppointmentDto(Long id, String code, String patientId, String patient, String doctorId,
        String issue, String treatment, LocalDate date, String time, Integer fee,
        String status, boolean paid, String notes, int amountPaid, int due, String mode,
        String paymentMethod, String paymentRef) {
    public static AppointmentDto from(Appointment a) {
        return new AppointmentDto(a.getId(), String.format("APT%03d", a.getId()), a.getPatient().getId(),
                a.getPatient().getName(), a.getDoctor().getId(), a.getIssue(), a.getTreatment(), a.getDate(),
                a.getTimeSlot(), a.getFee(), a.getStatus(), Billing.due(a) == 0, a.getNotes(),
                Billing.paid(a), Billing.due(a), a.getConsultMode() == null ? "IN_CLINIC" : a.getConsultMode(),
                a.getPaymentMethod(), a.getPaymentRef());
    }
}
