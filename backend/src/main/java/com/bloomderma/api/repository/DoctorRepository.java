package com.bloomderma.api.repository;

import com.bloomderma.api.model.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data JPA generates save/findAll/findById/deleteById automatically. */
public interface DoctorRepository extends JpaRepository<Doctor, String> { }
