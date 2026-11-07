package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record RecoveryRequest(LocalDate date, @NotNull @Min(1) @Max(10) Integer score,
                              @Size(max = 500) String symptoms, @Size(max = 500) String notes) { }
