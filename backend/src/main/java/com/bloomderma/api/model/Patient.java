package com.bloomderma.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import java.time.LocalDate;
import java.util.List;

@Entity @Table(name = "patients") @Data
public class Patient {
    @Id private String id;                              // SK### - assigned by the system (PatientIdGenerator)
    @NotBlank private String name;
    @Min(0) private Integer age;
    private String gender;
    private String phone;
    private String email;
    private String address;
    private String skinConcern;
    @Column(length = 1000) private String medicalHistory;
    private String allergies;
    private LocalDate registrationDate;

    @JsonIgnore @ToString.Exclude @EqualsAndHashCode.Exclude @OneToMany(mappedBy = "patient", cascade = CascadeType.REMOVE)   // 1 patient -> many appointments
    private List<Appointment> appointments;
}
