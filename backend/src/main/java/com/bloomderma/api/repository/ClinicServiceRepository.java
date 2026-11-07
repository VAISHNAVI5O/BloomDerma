package com.bloomderma.api.repository;

import com.bloomderma.api.model.ClinicService;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data JPA generates save/findAll/findById/deleteById automatically. */
public interface ClinicServiceRepository extends JpaRepository<ClinicService, Long> { }
