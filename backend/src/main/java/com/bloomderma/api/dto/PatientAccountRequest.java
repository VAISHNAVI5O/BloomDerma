package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;

/** Staff creates a portal login for an EXISTING patient. */
public record PatientAccountRequest(
        @NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{3,30}$",
                message = "must be 3-30 characters: letters, digits, dot, dash or underscore") String username,
        @NotBlank @Size(min = 8, max = 72, message = "must be 8-72 characters")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9 ]).*$",
                message = "must include an uppercase letter, a lowercase letter, a digit and a special character") String password) { }
