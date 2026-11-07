package com.bloomderma.api.repository;

import com.bloomderma.api.model.RevisitSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RevisitSuggestionRepository extends JpaRepository<RevisitSuggestion, Long> {
    List<RevisitSuggestion> findByPatientIdOrderByCreatedAtDesc(String patientId);
    List<RevisitSuggestion> findByPatientIdAndStatusOrderBySuggestedDateAsc(String patientId, String status);
}
