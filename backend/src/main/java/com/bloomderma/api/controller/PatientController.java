package com.bloomderma.api.controller;

import com.bloomderma.api.model.Patient;
import com.bloomderma.api.dto.PatientHistoryDto;
import com.bloomderma.api.service.PatientHistoryService;
import com.bloomderma.api.service.PatientService;
import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/patients")
public class PatientController {
    private final PatientService service;
    private final PatientHistoryService history;
    public PatientController(PatientService service, PatientHistoryService history) { this.service = service; this.history = history; }

    /** All patients with all visits - available to Admin, Receptionist AND every Doctor. */
    @GetMapping("/history") public List<PatientHistoryDto> history(Authentication auth) { return history.all(auth); }

    @GetMapping public List<Patient> all(@RequestParam(required = false) String search) { return service.findAll(search); }
    @GetMapping("/{id}") public Patient one(@PathVariable String id) { return service.get(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Patient create(@Valid @RequestBody Patient p) { return service.create(p); }
    @PutMapping("/{id}") public Patient update(@PathVariable String id, @Valid @RequestBody Patient p) { return service.update(id, p); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) { service.delete(id); }
}
