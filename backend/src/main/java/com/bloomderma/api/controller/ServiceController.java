package com.bloomderma.api.controller;

import com.bloomderma.api.model.ClinicService;
import com.bloomderma.api.repository.ClinicServiceRepository;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/services")
@ConditionalOnProperty(name = "bloomderma.modules.services", havingValue = "true", matchIfMissing = true)
public class ServiceController {
    private final ClinicServiceRepository repo;
    public ServiceController(ClinicServiceRepository repo) { this.repo = repo; }

    @GetMapping public List<ClinicService> all() { return repo.findAll(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ClinicService create(@Valid @RequestBody ClinicService s) { s.setId(null); return repo.save(s); }
}
