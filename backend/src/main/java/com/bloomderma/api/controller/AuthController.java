package com.bloomderma.api.controller;

import com.bloomderma.api.dto.LoginRequest;
import com.bloomderma.api.dto.RegisterRequest;
import com.bloomderma.api.service.PatientAccountService;
import com.bloomderma.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final PatientAccountService accounts;
    public AuthController(AuthService auth, PatientAccountService accounts) { this.auth = auth; this.accounts = accounts; }

    /** Patient self-registration: creates the patient record AND the patient's login. Never creates staff/doctor accounts. */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        var patient = accounts.register(request);
        return ResponseEntity.status(201).body(Map.of("patientId", patient.getId(), "message", "Account created"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Map<String, String> result = auth.login(request);
        return result == null ? ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"))
                              : ResponseEntity.ok(result);
    }
}
