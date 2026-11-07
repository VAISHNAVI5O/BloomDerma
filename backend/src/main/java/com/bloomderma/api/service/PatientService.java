package com.bloomderma.api.service;

import com.bloomderma.api.exception.*;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.repository.PatientRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;

/** Business logic layer. The repository is injected by Spring (Dependency Injection / IoC). */
@Service
public class PatientService {
    private final PatientRepository repo;
    private final PatientIdGenerator ids;
    public PatientService(PatientRepository repo, PatientIdGenerator ids) { this.repo = repo; this.ids = ids; }

    public List<Patient> findAll(String search) {
        if (search == null || search.isBlank()) return repo.findAll();
        String q = search.toLowerCase();
        return repo.findAll().stream().filter(p ->
            p.getName().toLowerCase().contains(q) || p.getId().toLowerCase().contains(q)).toList();
    }
    public Patient get(String id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Patient " + id + " not found"));
    }
    public Patient create(Patient p) {
        p.setId(ids.next());                                   // the ID is always assigned by the system (SK###); any ID sent is ignored
        if (p.getRegistrationDate() == null) p.setRegistrationDate(LocalDate.now());
        return repo.save(p);
    }
    public Patient update(String id, Patient p) {
        Patient existing = get(id);
        p.setId(id);
        p.setRegistrationDate(existing.getRegistrationDate());
        return repo.save(p);
    }
    public void delete(String id) { get(id); repo.deleteById(id); }
}
