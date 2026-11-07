package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** One row = one visit. timeSlot == null means a history-only visit (no booked slot). */
@Entity @Table(name = "appointments") @Data
public class Appointment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "patient_id") private Patient patient;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "doctor_id") private Doctor doctor;
    private String issue;
    private String treatment;
    private LocalDate date;
    private String timeSlot;
    private Integer fee;
    private String status;        // Pending | Confirmed | Completed | Cancelled
    private boolean paid;            // true = fully paid
    private Integer amountPaid;       // part-payment so far (null = nothing recorded); see Billing
    private String consultMode;       // null / IN_CLINIC | VIDEO
    private String paymentMethod;     // UPI | CARD | NETBANKING (online payment by the patient)
    private String paymentRef;        // transaction reference, e.g. TXN8F3A21C09B
    private LocalDateTime paidAt;
    @Column(length = 500) private String notes;
}
