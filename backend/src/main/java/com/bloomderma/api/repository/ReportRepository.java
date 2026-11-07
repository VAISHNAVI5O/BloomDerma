package com.bloomderma.api.repository;

import com.bloomderma.api.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByPatientIdOrderByUploadedAtDesc(String patientId);
}
