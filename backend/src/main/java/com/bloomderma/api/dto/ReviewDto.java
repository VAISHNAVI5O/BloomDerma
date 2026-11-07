package com.bloomderma.api.dto;

import java.time.LocalDateTime;

/** What everybody sees. The author is a short name ("Pooja N.") or "Anonymous patient" - never an ID or contact detail. */
public record ReviewDto(Long id, int rating, String text, String doctorId, String doctorName, String author,
                        boolean mine, LocalDateTime createdAt) { }
