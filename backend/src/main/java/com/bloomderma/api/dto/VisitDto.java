package com.bloomderma.api.dto;

import java.time.LocalDate;

/** One line of a patient's history. fee/paid are null when the caller is a doctor (billing is not part of history for doctors). */
public record VisitDto(Long appointmentId, LocalDate date, String time, String doctorId, String doctorName,
                       String issue, String treatment, Integer fee, Boolean paid, Integer amountPaid, String status) { }
