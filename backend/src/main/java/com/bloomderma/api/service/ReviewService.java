package com.bloomderma.api.service;

import com.bloomderma.api.dto.ReviewDto;
import com.bloomderma.api.dto.ReviewRequest;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.model.Review;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.repository.ReviewRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Public reviews: every logged-in user can read them, only patients write (and delete their own). */
@Service
public class ReviewService {
    private final ReviewRepository reviews;
    private final PatientRepository patients;
    private final DoctorRepository doctors;
    private final CurrentUser current;

    public ReviewService(ReviewRepository reviews, PatientRepository patients, DoctorRepository doctors, CurrentUser current) {
        this.reviews = reviews; this.patients = patients; this.doctors = doctors; this.current = current;
    }

    public List<ReviewDto> list(Authentication auth) {
        String me = current.patientId(auth);
        Map<String, String> patientNames = new HashMap<>();
        for (Patient p : patients.findAll()) patientNames.put(p.getId(), p.getName());
        Map<String, String> doctorNames = new HashMap<>();
        for (Doctor d : doctors.findAll()) doctorNames.put(d.getId(), d.getName());
        return reviews.findAllByOrderByCreatedAtDesc().stream().map(r -> new ReviewDto(
                r.getId(), r.getRating(), r.getText(), r.getDoctorId(), doctorNames.get(r.getDoctorId()),
                r.isAnonymous() ? "Anonymous patient" : shortName(patientNames.get(r.getPatientId())),
                me != null && me.equals(r.getPatientId()), r.getCreatedAt())).toList();
    }

    public Review create(String patientId, ReviewRequest r) {
        String text = r.text().trim();
        if (text.isEmpty()) throw new IllegalArgumentException("Please write your review.");
        if (text.contains("<") || text.contains(">")) throw new IllegalArgumentException("The review cannot contain < or >.");
        String doctorId = r.doctorId() == null || r.doctorId().isBlank() ? null : r.doctorId().trim();
        if (doctorId != null && !doctors.existsById(doctorId)) throw new ResourceNotFoundException("Doctor " + doctorId + " not found");
        Review rv = new Review();
        rv.setPatientId(patientId); rv.setDoctorId(doctorId); rv.setRating(r.rating()); rv.setText(text);
        rv.setAnonymous(r.anonymous()); rv.setCreatedAt(LocalDateTime.now());
        return reviews.save(rv);
    }

    public void deleteOwn(String patientId, Long id) {
        Review r = reviews.findById(id).orElseThrow(() -> new ResourceNotFoundException("Review " + id + " not found"));
        if (!r.getPatientId().equals(patientId)) throw new ResourceNotFoundException("Review " + id + " not found");
        reviews.delete(r);
    }

    /** Admin moderation. */
    public void deleteAny(Long id) {
        if (!reviews.existsById(id)) throw new ResourceNotFoundException("Review " + id + " not found");
        reviews.deleteById(id);
    }

    private static String shortName(String full) {
        if (full == null || full.isBlank()) return "Patient";
        String[] parts = full.trim().split("\\s+");
        return parts.length == 1 ? parts[0] : parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }
}
