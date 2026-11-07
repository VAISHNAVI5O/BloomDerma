package com.bloomderma.api.dto;

import com.bloomderma.api.model.RevisitSuggestion;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record RevisitDto(Long id, String patientId, String doctorId, String doctorName, LocalDate date, String note,
                         String status, LocalDateTime createdAt) {
    public static RevisitDto from(RevisitSuggestion s, String doctorName) {
        return new RevisitDto(s.getId(), s.getPatientId(), s.getDoctorId(), doctorName, s.getSuggestedDate(),
                s.getNote(), s.getStatus(), s.getCreatedAt());
    }
}
