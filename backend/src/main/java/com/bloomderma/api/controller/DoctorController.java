package com.bloomderma.api.controller;

import com.bloomderma.api.dto.DoctorDto;
import com.bloomderma.api.dto.DoctorRequest;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController @RequestMapping("/api/doctors")
@ConditionalOnProperty(name = "bloomderma.modules.doctors", havingValue = "true", matchIfMissing = true)
public class DoctorController {
    private final DoctorService service;
    public DoctorController(DoctorService service) { this.service = service; }

    @GetMapping public List<DoctorDto> all(Authentication auth) { return service.findAll(auth); }

    /** Speciality choices for the Add Doctor form. */
    @GetMapping("/specialities") public List<String> specialities() { return service.specialityNames(); }

    /** Appointment booking: doctors whose stored speciality matches the chosen concern/treatment. */
    @GetMapping("/suggestions")
    public Map<String, Object> suggestions(@RequestParam(required = false) String concern,
                                           @RequestParam(required = false) String treatment) {
        return service.suggest(concern, treatment);
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) public DoctorDto create(@Valid @RequestBody DoctorRequest r) { return service.create(r); }
    @PutMapping("/{id}") public Doctor update(@PathVariable String id, @Valid @RequestBody Doctor d) { return service.update(id, d); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable String id) { service.delete(id); }
}
