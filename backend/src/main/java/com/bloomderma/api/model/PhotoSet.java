package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** A patient's before / after photos of one concern or treatment (the "after" photo can be added later). */
@Entity @Table(name = "photo_sets") @Data
public class PhotoSet {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "patient_id", nullable = false) private String patientId;
    private String caption;
    private String beforeFile;     // random file name on disk
    private String beforeType;
    private LocalDate beforeOn;
    private String afterFile;      // null until the patient adds it
    private String afterType;
    private LocalDate afterOn;
    private LocalDateTime createdAt;
}
