package com.bloomderma.api.controller;

import com.bloomderma.api.dto.*;
import com.bloomderma.api.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Removed from the app entirely when bloomderma.modules.appointments=false. */
@RestController @RequestMapping("/api/appointments")
@ConditionalOnProperty(name = "bloomderma.modules.appointments", havingValue = "true", matchIfMissing = true)
public class AppointmentController {
    private final AppointmentService service;
    public AppointmentController(AppointmentService service) { this.service = service; }

    @GetMapping public List<AppointmentDto> all(Authentication auth) { return service.findAll(auth); }
    @GetMapping("/{id}") public AppointmentDto one(@PathVariable Long id, Authentication auth) { return service.get(id, auth); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public AppointmentDto create(@Valid @RequestBody AppointmentRequest r, Authentication auth) { return service.create(r, auth); }
    @PutMapping("/{id}") public AppointmentDto update(@PathVariable Long id, @Valid @RequestBody AppointmentRequest r, Authentication auth) { return service.update(id, r, auth); }
    @PatchMapping("/{id}/payment") public AppointmentDto payment(@PathVariable Long id, @RequestParam(required = false) Boolean paid,
            @RequestParam(required = false) Integer amount, Authentication auth) { return service.updatePayment(id, paid, amount, auth); }
    @PatchMapping("/{id}/status") public AppointmentDto status(@PathVariable Long id, @RequestParam String value, Authentication auth) { return service.updateStatus(id, value, auth); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(id); }
}
