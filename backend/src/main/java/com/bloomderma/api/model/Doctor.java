package com.bloomderma.api.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Entity @Table(name = "doctors") @Data
public class Doctor {
    @Id @NotBlank private String id;                 // e.g. doc1
    @NotBlank private String name;
    private String specialty;
    private Integer videoFee;                    // video-consultation charge (null = clinic default)
    private String phone;                          // contact info (visible to ADMIN only)
    private String email;
    @Column(length = 500) private String bio;
    private String color1;
    private String color2;
    @ElementCollection(fetch = FetchType.EAGER) @OrderColumn @CollectionTable(name = "doctor_slots")
    private List<String> slots;
    @ElementCollection(fetch = FetchType.EAGER) @OrderColumn @CollectionTable(name = "doctor_treats")
    private List<String> treats;
}
