package com.bloomderma.api.controller;

import com.bloomderma.api.dto.DashboardStats;
import com.bloomderma.api.service.DashboardService;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

@RestController @RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping("/stats") public DashboardStats stats(Authentication authentication) { return service.stats(authentication); }
}
