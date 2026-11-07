package com.bloomderma.api.dto;

import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.service.Billing;
import java.time.LocalDate;

/** One bill line shown to a patient in "My Bills". */
public record BillDto(Long id, String code, LocalDate date, String time, String doctorName, String treatment,
                      String mode, String status, int fee, int paid, int due, String paymentState) {
    public static BillDto from(Appointment a) {
        return new BillDto(a.getId(), String.format("APT%03d", a.getId()), a.getDate(), a.getTimeSlot(),
                a.getDoctor().getName(), a.getTreatment(), a.getConsultMode() == null ? "IN_CLINIC" : a.getConsultMode(),
                a.getStatus(), Billing.fee(a), Billing.paid(a), Billing.due(a), Billing.state(a));
    }
}
