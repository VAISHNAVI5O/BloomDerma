package com.bloomderma.api.service;

import com.bloomderma.api.dto.LoginRequest;
import com.bloomderma.api.model.User;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.repository.UserRepository;
import com.bloomderma.api.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {
    private final UserRepository users;
    private final DoctorRepository doctors;
    private final PatientRepository patients;
    private final PasswordEncoder encoder;
    private final JwtTokenProvider jwt;
    public AuthService(UserRepository u, DoctorRepository d, PatientRepository pt, PasswordEncoder e, JwtTokenProvider j) {
        users = u; doctors = d; patients = pt; encoder = e; jwt = j;
    }

    /**
     * Returns {token, username, role[, doctorId, doctorName]} or null when the login is refused.
     * loginType DOCTOR  -> only registered doctor accounts are accepted; PATIENT -> only patient accounts.
     * loginType STAFF   -> only ADMIN / RECEPTIONIST / STAFF accounts are accepted.
     */
    public Map<String, String> login(LoginRequest r) {
        User user = users.findByUsername(r.username().trim()).orElse(null);
        if (user == null || !encoder.matches(r.password(), user.getPassword())) return null;

        boolean isDoctorAccount = "DOCTOR".equals(user.getRole());
        boolean isPatientAccount = "PATIENT".equals(user.getRole());
        String category = isDoctorAccount ? "DOCTOR" : isPatientAccount ? "PATIENT" : "STAFF";
        String type = r.loginType();
        if (type != null && !type.isBlank() && !category.equalsIgnoreCase(type)) return null;   // wrong login screen
        String doctorName = null;
        if (isDoctorAccount) {                                  // must be linked to a real doctor record
            if (user.getDoctorId() == null) return null;
            var doctor = doctors.findById(user.getDoctorId()).orElse(null);
            if (doctor == null) return null;
            doctorName = doctor.getName();
        }
        String patientName = null;
        if (isPatientAccount) {
            if (user.getPatientId() == null) return null;
            var patient = patients.findById(user.getPatientId()).orElse(null);
            if (patient == null) return null;
            patientName = patient.getName();
        }
        Map<String, String> out = new LinkedHashMap<>();
        out.put("token", jwt.generate(user.getUsername(), user.getRole(), user.getDoctorId(), user.getPatientId()));
        out.put("username", user.getUsername());
        out.put("role", user.getRole());
        if (isDoctorAccount) { out.put("doctorId", user.getDoctorId()); out.put("doctorName", doctorName); }
        if (isPatientAccount) { out.put("patientId", user.getPatientId()); out.put("patientName", patientName); }
        return out;
    }
}
