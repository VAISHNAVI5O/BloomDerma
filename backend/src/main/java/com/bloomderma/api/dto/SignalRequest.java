package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;

public record SignalRequest(@NotBlank String type, @Size(max = 20000) String payload) { }
