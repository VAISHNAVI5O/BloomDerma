package com.bloomderma.api.repository;

import com.bloomderma.api.model.RecoveryLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RecoveryLogRepository extends JpaRepository<RecoveryLog, Long> {
    List<RecoveryLog> findByPatientIdOrderByLogDateAscIdAsc(String patientId);
}
