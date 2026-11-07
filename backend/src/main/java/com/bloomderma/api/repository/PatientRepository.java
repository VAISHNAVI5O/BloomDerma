package com.bloomderma.api.repository;

import com.bloomderma.api.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data JPA generates save/findAll/findById/deleteById automatically. */
public interface PatientRepository extends JpaRepository<Patient, String> { }
