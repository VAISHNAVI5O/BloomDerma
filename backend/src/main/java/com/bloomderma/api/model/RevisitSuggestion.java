package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A doctor's suggestion that a patient comes back for a review (e.g. "after a month").
 * It is only a notice: the patient decides whether to book (status BOOKED) or ignore it (DISMISSED).
 */
@Entity @Table(name = "revisit_suggestions") @Data
public class RevisitSuggestion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "patient_id", nullable = false) private String patientId;
    @Column(name = "doctor_id", nullable = false) private String doctorId;
    private LocalDate suggestedDate;               // roughly when the doctor would like to see the patient again
    @Column(length = 300) private String note;     // optional message from the doctor
    private String status;                         // ACTIVE | BOOKED | DISMISSED
    private LocalDateTime createdAt;
}
