package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

/** Doctor suggests that a patient comes back around this date ("after a month", "in a few weeks" ...). */
public record RevisitRequest(@NotNull LocalDate date, @Size(max = 300) String note) { }
