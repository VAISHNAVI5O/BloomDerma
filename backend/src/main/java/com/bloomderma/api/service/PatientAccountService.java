package com.bloomderma.api.service;

import com.bloomderma.api.dto.PatientAccountRequest;
import com.bloomderma.api.dto.RegisterRequest;
import com.bloomderma.api.exception.ConflictException;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.model.User;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

/** Creates patient portal logins: by self-registration, or by staff for an existing patient record. */
@Service
public class PatientAccountService {
    private final PatientRepository patients;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final PatientIdGenerator ids;

    public PatientAccountService(PatientRepository patients, UserRepository users, PasswordEncoder encoder, PatientIdGenerator ids) {
        this.patients = patients; this.users = users; this.encoder = encoder; this.ids = ids;
    }

    @Transactional
    public Patient register(RegisterRequest r) {
        String username = r.username().trim();
        if (users.findByUsername(username).isPresent()) throw new ConflictException("Username " + username + " is already taken");
        Patient p = new Patient();
        p.setId(ids.next());                                          // assigned by the clinic system in the format SK### - never chosen by the patient
        p.setName(r.name().trim()); p.setAge(r.age());
        p.setGender(r.gender() == null || r.gender().isBlank() ? null : r.gender().trim());
        p.setPhone(blankToNull(r.phone())); p.setEmail(blankToNull(r.email()));
        p.setRegistrationDate(LocalDate.now());
        Patient saved = patients.save(p);
        addUser(username, r.password(), saved.getId());
        return saved;
    }

    @Transactional
    public void createForExisting(String patientId, PatientAccountRequest r) {
        if (!patients.existsById(patientId)) throw new ResourceNotFoundException("Patient " + patientId + " not found");
        if (users.findByPatientId(patientId).isPresent()) throw new ConflictException("This patient already has a portal login");
        String username = r.username().trim();
        if (users.findByUsername(username).isPresent()) throw new ConflictException("Username " + username + " is already taken");
        addUser(username, r.password(), patientId);
    }

    public Optional<User> accountOf(String patientId) { return users.findByPatientId(patientId); }

    private void addUser(String username, String password, String patientId) {
        User u = new User();
        u.setUsername(username); u.setPassword(encoder.encode(password)); u.setRole("PATIENT"); u.setPatientId(patientId);
        users.save(u);
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
}
