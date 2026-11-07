package com.bloomderma.api.controller;

import com.bloomderma.api.dto.ReviewDto;
import com.bloomderma.api.service.ReviewService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Public review board: readable by every logged-in user (patients, doctors, staff). Admin can delete (DELETE /api/reviews/{id}). */
@RestController @RequestMapping("/api/reviews")
public class ReviewController {
    private final ReviewService reviews;
    public ReviewController(ReviewService reviews) { this.reviews = reviews; }

    @GetMapping public List<ReviewDto> all(Authentication auth) { return reviews.list(auth); }

    @DeleteMapping("/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { reviews.deleteAny(id); }       // ADMIN only (SecurityConfig)
}
