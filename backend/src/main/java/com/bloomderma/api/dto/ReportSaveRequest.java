package com.bloomderma.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The doctor-reviewed report text that is turned into the PDF. */
public record ReportSaveRequest(@NotBlank @Size(max = 12000) String text) { }
