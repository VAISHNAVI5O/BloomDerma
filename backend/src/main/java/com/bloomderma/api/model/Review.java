package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** A public review written by a patient. Visible to all patients, doctors and staff. */
@Entity @Table(name = "reviews") @Data
public class Review {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "patient_id", nullable = false) private String patientId;
    @Column(name = "doctor_id") private String doctorId;      // optional: the doctor the review is about
    private int rating;                                        // 1..5
    @Column(length = 1000) private String text;
    private boolean anonymous;
    private LocalDateTime createdAt;
}
