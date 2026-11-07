package com.bloomderma.api.dto;

import jakarta.validation.constraints.*;

/** Online payment of a video consultation. Card numbers / CVV are validated and then discarded - never stored. */
public record PaymentRequest(
        @NotBlank String method,                 // UPI | CARD | NETBANKING
        @Size(max = 60) String upiId,
        @Size(max = 30) String cardNumber, @Size(max = 80) String cardName,
        @Size(max = 7) String expiry,            // MM/YY
        @Size(max = 4) String cvv,
        @Size(max = 40) String bank) { }
