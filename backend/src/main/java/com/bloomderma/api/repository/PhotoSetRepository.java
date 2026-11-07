package com.bloomderma.api.repository;

import com.bloomderma.api.model.PhotoSet;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PhotoSetRepository extends JpaRepository<PhotoSet, Long> {
    List<PhotoSet> findByPatientIdOrderByCreatedAtDesc(String patientId);
}
