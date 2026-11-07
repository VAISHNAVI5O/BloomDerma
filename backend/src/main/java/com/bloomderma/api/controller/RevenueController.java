package com.bloomderma.api.controller;

import com.bloomderma.api.service.RevenueService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import java.util.Map;

@RestController @RequestMapping("/api/revenue")
@ConditionalOnProperty(name = "bloomderma.modules.revenue", havingValue = "true", matchIfMissing = true)
public class RevenueController {
    private final RevenueService service;
    public RevenueController(RevenueService service) { this.service = service; }
    @GetMapping public Map<String, Object> summary(Authentication authentication) { return service.summary(authentication); }
}
