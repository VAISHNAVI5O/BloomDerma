package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** A medical report / photo uploaded by a patient. The file itself lives in the upload folder. */
@Entity @Table(name = "reports") @Data
public class Report {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "patient_id", nullable = false) private String patientId;
    private String title;
    private String originalName;
    private String storedName;      // random name on disk
    private String contentType;
    private long size;
    private LocalDateTime uploadedAt;
    /** null = uploaded by the patient; otherwise the doctor who generated this report for the patient. */
    private String createdBy;
}
