package com.bloomderma.api.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Entity @Table(name = "services") @Data
public class ClinicService {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @NotBlank private String name;
    private String icon;
    private String description;
    private Integer price;
}
