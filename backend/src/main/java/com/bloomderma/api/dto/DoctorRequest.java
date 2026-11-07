package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;
import java.util.List;

/** Input DTO for POST /api/doctors (ADMIN only). Creates the doctor record AND the doctor's login account. */
public record DoctorRequest(
        @NotBlank @Size(max = 100) @Pattern(regexp = "^[^<>\"&]*$", message = "contains invalid characters") String name,
        @NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{3,30}$",
                message = "must be 3-30 characters: letters, digits, dot, dash or underscore") String id,
        @NotBlank @Size(min = 8, max = 72, message = "must be 8-72 characters")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9 ]).*$",
                message = "must include an uppercase letter, a lowercase letter, a digit and a special character") String password,
        @NotBlank String specialty,
        @Pattern(regexp = "^([0-9]{10})?$", message = "must be exactly 10 digits") String phone,
        @Size(max = 100) String email,
        @Size(max = 500) @Pattern(regexp = "^[^<>]*$", message = "contains invalid characters") String bio,
        @Min(0) @Max(100000) Integer videoFee,
        List<String> slots,
        List<String> treats) { }
