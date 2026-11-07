package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

/** Input DTO for POST/PUT /api/appointments (validated with Bean Validation). A blank patientId registers a new patient. */
public record AppointmentRequest(
        String patientId, @NotBlank String patientName,
        @NotNull @Min(0) Integer age, String gender,
        @NotBlank String issue, @NotBlank String doctorId, @NotBlank String treatment,
        @NotNull LocalDate date, String time,
        @NotNull @Min(0) Integer fee, String status, String notes) { }
