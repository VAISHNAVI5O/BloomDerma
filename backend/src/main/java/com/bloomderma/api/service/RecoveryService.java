package com.bloomderma.api.service;

import com.bloomderma.api.dto.RecoveryRequest;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.RecoveryLog;
import com.bloomderma.api.repository.RecoveryLogRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Patient's own recovery check-ins (1 = very bad ... 10 = great), oldest first so charts read left to right. */
@Service
public class RecoveryService {
    private final RecoveryLogRepository repo;
    public RecoveryService(RecoveryLogRepository repo) { this.repo = repo; }

    public List<RecoveryLog> list(String patientId) { return repo.findByPatientIdOrderByLogDateAscIdAsc(patientId); }

    public RecoveryLog add(String patientId, RecoveryRequest r) {
        LocalDate date = r.date() == null ? LocalDate.now() : r.date();
        if (date.isAfter(LocalDate.now())) throw new IllegalArgumentException("The date cannot be in the future.");
        if (bad(r.symptoms()) || bad(r.notes())) throw new IllegalArgumentException("Text cannot contain < or >.");
        RecoveryLog l = new RecoveryLog();
        l.setPatientId(patientId); l.setLogDate(date); l.setScore(r.score());
        l.setSymptoms(r.symptoms() == null ? null : r.symptoms().trim());
        l.setNotes(r.notes() == null ? null : r.notes().trim());
        l.setCreatedAt(LocalDateTime.now());
        return repo.save(l);
    }

    public void delete(String patientId, Long id) {
        RecoveryLog l = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Entry " + id + " not found"));
        if (!l.getPatientId().equals(patientId)) throw new ResourceNotFoundException("Entry " + id + " not found");
        repo.delete(l);
    }

    private static boolean bad(String s) { return s != null && (s.contains("<") || s.contains(">")); }
}
