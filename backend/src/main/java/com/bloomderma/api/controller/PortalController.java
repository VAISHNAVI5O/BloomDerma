package com.bloomderma.api.controller;

import com.bloomderma.api.dto.*;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.model.RecoveryLog;
import com.bloomderma.api.model.Report;
import com.bloomderma.api.model.PhotoSet;
import com.bloomderma.api.model.Review;
import com.bloomderma.api.service.PhotoService;
import com.bloomderma.api.service.ReviewService;
import com.bloomderma.api.service.PortalService;
import com.bloomderma.api.service.RecoveryService;
import com.bloomderma.api.service.ReportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** Patient portal API. Reachable by role PATIENT only (SecurityConfig); every call is scoped to the token's own patient. */
@RestController @RequestMapping("/api/portal")
public class PortalController {
    private final PortalService portal;
    private final ReportService reports;
    private final RecoveryService recovery;
    private final PhotoService photos;
    private final ReviewService reviews;

    public PortalController(PortalService portal, ReportService reports, RecoveryService recovery, PhotoService photos, ReviewService reviews) {
        this.portal = portal; this.reports = reports; this.recovery = recovery; this.photos = photos; this.reviews = reviews;
    }

    @GetMapping("/me") public Patient me(Authentication auth) { return portal.me(auth); }
    @GetMapping("/availability")
    public List<String> availability(@RequestParam String doctorId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        return portal.bookedSlots(doctorId, date);
    }
    @GetMapping("/fees") public Map<String, Object> fees() { return portal.fees(); }

    // ---- appointments (clinic visits and video consultations) ----
    @GetMapping("/appointments") public List<AppointmentDto> appointments(Authentication auth) { return portal.myAppointments(auth); }
    @PostMapping("/appointments") @ResponseStatus(HttpStatus.CREATED)
    public AppointmentDto book(@Valid @RequestBody PortalBookingRequest r, Authentication auth) { return portal.book(r, auth); }
    @PostMapping("/appointments/{id}/pay")
    public AppointmentDto pay(@PathVariable Long id, @Valid @RequestBody PaymentRequest r, Authentication auth) { return portal.pay(id, r, auth); }
    @PatchMapping("/appointments/{id}/cancel") public AppointmentDto cancel(@PathVariable Long id, Authentication auth) { return portal.cancel(id, auth); }

    // ---- revisit notices (the doctor suggests, the patient decides) ----
    @GetMapping("/revisits") public List<RevisitDto> revisits(Authentication auth) { return portal.myRevisits(auth); }
    @PostMapping("/revisits/{id}/dismiss") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismissRevisit(@PathVariable Long id, Authentication auth) { portal.dismissRevisit(id, auth); }

    // ---- bills ----
    @GetMapping("/bills") public Map<String, Object> bills(Authentication auth) { return portal.bills(auth); }

    // ---- reports ----
    @GetMapping("/reports") public List<ReportDto> reports(Authentication auth) {
        return reports.list(portal.patientId(auth)).stream().map(ReportDto::from).toList();
    }
    @PostMapping(value = "/reports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public ReportDto upload(@RequestParam("file") MultipartFile file, @RequestParam(required = false) String title, Authentication auth) {
        return ReportDto.from(reports.store(portal.patientId(auth), title, file));
    }
    @GetMapping("/reports/{id}/file") public ResponseEntity<byte[]> file(@PathVariable Long id, Authentication auth) {
        return ReportFiles.send(reports, own(id, auth));
    }
    @DeleteMapping("/reports/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReport(@PathVariable Long id, Authentication auth) {
        Report r = own(id, auth);
        if (r.getCreatedBy() != null) throw new org.springframework.security.access.AccessDeniedException("Reports prepared by your doctor cannot be deleted.");
        reports.delete(r);
    }

    private Report own(Long id, Authentication auth) {
        Report r = reports.get(id);
        if (!r.getPatientId().equals(portal.patientId(auth))) throw new ResourceNotFoundException("Report " + id + " not found");
        return r;
    }

    // ---- before / after photos ----
    @GetMapping("/photos") public List<PhotoSetDto> photos(Authentication auth) {
        return photos.list(portal.patientId(auth)).stream().map(PhotoSetDto::from).toList();
    }
    @PostMapping(value = "/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public PhotoSetDto addPhotos(@RequestParam String caption, @RequestParam("before") MultipartFile before,
                                 @RequestParam(value = "after", required = false) MultipartFile after, Authentication auth) {
        return PhotoSetDto.from(photos.add(portal.patientId(auth), caption, before, after));
    }
    @PostMapping(value = "/photos/{id}/after", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PhotoSetDto addAfter(@PathVariable Long id, @RequestParam("after") MultipartFile after, Authentication auth) {
        return PhotoSetDto.from(photos.setAfter(ownPhotos(id, auth), after));
    }
    @GetMapping("/photos/{id}/{side}") public ResponseEntity<byte[]> photo(@PathVariable Long id, @PathVariable String side, Authentication auth) {
        return PatientExtrasController.image(photos.image(ownPhotos(id, auth), side));
    }
    @DeleteMapping("/photos/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePhotos(@PathVariable Long id, Authentication auth) { photos.delete(ownPhotos(id, auth)); }

    private PhotoSet ownPhotos(Long id, Authentication auth) {
        PhotoSet p = photos.get(id);
        if (!p.getPatientId().equals(portal.patientId(auth))) throw new ResourceNotFoundException("Photo set " + id + " not found");
        return p;
    }

    // ---- public reviews (everyone reads them at GET /api/reviews) ----
    @PostMapping("/reviews") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addReview(@Valid @RequestBody ReviewRequest r, Authentication auth) {
        Review rv = reviews.create(portal.patientId(auth), r);
        return Map.of("id", rv.getId());
    }
    @DeleteMapping("/reviews/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(@PathVariable Long id, Authentication auth) { reviews.deleteOwn(portal.patientId(auth), id); }

    // ---- recovery tracking ----
    @GetMapping("/recovery") public List<RecoveryLog> recovery(Authentication auth) { return recovery.list(portal.patientId(auth)); }
    @PostMapping("/recovery") @ResponseStatus(HttpStatus.CREATED)
    public RecoveryLog addRecovery(@Valid @RequestBody RecoveryRequest r, Authentication auth) { return recovery.add(portal.patientId(auth), r); }
    @DeleteMapping("/recovery/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecovery(@PathVariable Long id, Authentication auth) { recovery.delete(portal.patientId(auth), id); }

    /** Shared by the patient and the staff/doctor endpoints. */
    static final class ReportFiles {
        static ResponseEntity<byte[]> send(ReportService reports, Report r) {
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(r.getContentType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION, org.springframework.http.ContentDisposition.inline()
                            .filename(r.getOriginalName() == null ? "report" : r.getOriginalName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                    .header("X-Content-Type-Options", "nosniff")
                    .body(reports.read(r));
        }
    }
}
