package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

/** A patient books for themselves. The fee is NOT part of the request: the server sets it. */
public record PortalBookingRequest(
        @NotBlank String doctorId, @NotBlank @Size(max = 100) String concern, @Size(max = 100) String treatment,
        @NotNull LocalDate date, @NotBlank String time, boolean video) { }
