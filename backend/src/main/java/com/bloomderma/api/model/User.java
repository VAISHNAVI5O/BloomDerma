package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity @Table(name = "users") @Data
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(unique = true, nullable = false) private String username;
    @Column(nullable = false) private String password;   // BCrypt hash
    private String role;                                   // ADMIN | RECEPTIONIST | STAFF | DOCTOR | PATIENT
    /** Only for role DOCTOR: the doctors.id this account belongs to. Identity of a doctor always comes from here. */
    @Column(name = "doctor_id", unique = true) private String doctorId;
    /** Only for role PATIENT: the patients.id this portal account belongs to. */
    @Column(name = "patient_id", unique = true) private String patientId;
}
