package com.bloomderma.api.dto;

import jakarta.validation.constraints.NotBlank;

/** loginType: "DOCTOR" or "STAFF" (Admin / Receptionist) - chosen on the first login screen. */
public record LoginRequest(@NotBlank String username, @NotBlank String password, String loginType) { }
