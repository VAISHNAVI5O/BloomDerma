package com.bloomderma.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Doctor's input for an AI-written report: short keywords + the prescription. */
public record ReportDraftRequest(@NotBlank @Size(max = 1500) String keywords, @NotBlank @Size(max = 3000) String prescription) { }
