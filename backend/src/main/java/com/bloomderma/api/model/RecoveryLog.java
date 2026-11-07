package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** One recovery check-in written by the patient: how the skin/hair feels today (1 = very bad ... 10 = great). */
@Entity @Table(name = "recovery_logs") @Data
public class RecoveryLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "patient_id", nullable = false) private String patientId;
    private LocalDate logDate;
    private Integer score;
    @Column(length = 500) private String symptoms;
    @Column(length = 500) private String notes;
    private LocalDateTime createdAt;
}
