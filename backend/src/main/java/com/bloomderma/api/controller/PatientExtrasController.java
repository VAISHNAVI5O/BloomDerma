package com.bloomderma.api.controller;

import com.bloomderma.api.dto.PatientAccountRequest;
import com.bloomderma.api.dto.ReportDto;
import com.bloomderma.api.dto.ReportDraftRequest;
import com.bloomderma.api.dto.ReportSaveRequest;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.model.Patient;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.repository.PatientRepository;
import com.bloomderma.api.dto.PhotoSetDto;
import com.bloomderma.api.model.PhotoSet;
import com.bloomderma.api.service.AiReportService;
import com.bloomderma.api.service.PhotoService;
import org.springframework.http.MediaType;
import com.bloomderma.api.service.ReportPdf;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.RecoveryLog;
import com.bloomderma.api.model.Report;
import com.bloomderma.api.security.CurrentUser;
import com.bloomderma.api.service.PatientAccountService;
import com.bloomderma.api.service.RecoveryService;
import com.bloomderma.api.service.ReportService;
import com.bloomderma.api.service.RevisitService;
import com.bloomderma.api.dto.RevisitDto;
import com.bloomderma.api.dto.RevisitRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Staff / doctor side of the patient portal: read a patient's uploaded reports and recovery check-ins, and
 * (front desk only) give an existing patient a portal login. Patients cannot reach /api/patients/** at all.
 */
@RestController @RequestMapping("/api/patients/{patientId}")
public class PatientExtrasController {
    private final ReportService reports;
    private final RecoveryService recovery;
    private final PatientAccountService accounts;
    private final CurrentUser current;
    private final PatientRepository patients;
    private final DoctorRepository doctors;
    private final AiReportService ai;
    private final PhotoService photos;
    private final RevisitService revisits;

    public PatientExtrasController(ReportService reports, RecoveryService recovery, PatientAccountService accounts, CurrentUser current,
                                   PatientRepository patients, DoctorRepository doctors, AiReportService ai, PhotoService photos,
                                   RevisitService revisits) {
        this.photos = photos; this.revisits = revisits;
        this.reports = reports; this.recovery = recovery; this.accounts = accounts; this.current = current;
        this.patients = patients; this.doctors = doctors; this.ai = ai;
    }

    /** Step 1 (doctor only): keywords + prescription -> editable report text. Nothing is saved yet. */
    @PostMapping("/reports/draft")
    public Map<String, Object> draft(@PathVariable String patientId, @Valid @RequestBody ReportDraftRequest r, Authentication auth) {
        Doctor d = doctorOf(auth);
        Patient p = patientOf(patientId);
        var draft = ai.draft(r.keywords().trim(), r.prescription().trim(), p.getAge(), p.getGender(), d.getSpecialty());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("text", draft.text()); m.put("aiUsed", draft.aiUsed()); m.put("note", draft.note());
        return m;
    }

    /** Step 2 (doctor only): the reviewed text becomes a PDF stored on the patient's account. */
    @PostMapping("/reports/generated") @ResponseStatus(HttpStatus.CREATED)
    public ReportDto saveGenerated(@PathVariable String patientId, @Valid @RequestBody ReportSaveRequest r, Authentication auth) {
        Doctor d = doctorOf(auth);
        Patient p = patientOf(patientId);
        java.time.LocalDate today = java.time.LocalDate.now();
        byte[] pdf = ReportPdf.build(new ReportPdf.Header(p.getName(), p.getId(),
                (p.getAge() == null ? "-" : p.getAge().toString()) + " / " + (p.getGender() == null ? "-" : p.getGender()),
                d.getName(), d.getSpecialty(), today), r.text());
        String title = "Medical report - " + d.getName() + " - " + today;
        String fileName = "BloomDerma-Report-" + p.getId() + "-" + today + ".pdf";
        return ReportDto.from(reports.storeGenerated(p.getId(), title, fileName, pdf, d.getName()));
    }

    private Doctor doctorOf(Authentication auth) {
        String id = current.doctorId(auth);
        if (id == null) throw new AccessDeniedException("Only a doctor can create patient reports.");
        return doctors.findById(id).orElseThrow(() -> new ResourceNotFoundException("Doctor " + id + " not found"));
    }
    private Patient patientOf(String id) {
        return patients.findById(id).orElseThrow(() -> new ResourceNotFoundException("Patient " + id + " not found"));
    }

    @GetMapping("/reports") public List<ReportDto> reports(@PathVariable String patientId) {
        return reports.list(patientId).stream().map(ReportDto::from).toList();
    }

    @GetMapping("/reports/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable String patientId, @PathVariable Long id) {
        Report r = reports.get(id);
        if (!r.getPatientId().equals(patientId)) throw new ResourceNotFoundException("Report " + id + " not found");
        return PortalController.ReportFiles.send(reports, r);
    }

    /** Before / after photo sets of this patient (read only for doctors and staff). */
    @GetMapping("/photos") public List<PhotoSetDto> photos(@PathVariable String patientId) {
        return photos.list(patientId).stream().map(PhotoSetDto::from).toList();
    }

    @GetMapping("/photos/{id}/{side}")
    public ResponseEntity<byte[]> photo(@PathVariable String patientId, @PathVariable Long id, @PathVariable String side) {
        PhotoSet p = photos.get(id);
        if (!p.getPatientId().equals(patientId)) throw new ResourceNotFoundException("Photo set " + id + " not found");
        return image(photos.image(p, side));
    }

    static ResponseEntity<byte[]> image(PhotoService.Image img) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(img.contentType()))
                .header("X-Content-Type-Options", "nosniff").body(img.bytes());
    }

    /** Doctor: suggest that this patient comes back (e.g. after a month). The patient is only notified - booking stays their choice. */
    @PostMapping("/revisits") @ResponseStatus(HttpStatus.CREATED)
    public RevisitDto suggestRevisit(@PathVariable String patientId, @Valid @RequestBody RevisitRequest r, Authentication auth) {
        return revisits.suggest(patientId, r, auth);
    }
    @GetMapping("/revisits") public List<RevisitDto> revisits(@PathVariable String patientId) { return revisits.forPatient(patientId); }

    @GetMapping("/recovery") public List<RecoveryLog> recovery(@PathVariable String patientId) { return recovery.list(patientId); }

    /** Does this patient already have a portal login? (login ID is only shown to the front desk) */
    @GetMapping("/account")
    public Map<String, Object> account(@PathVariable String patientId, Authentication auth) {
        if (!current.isFrontDesk(auth)) throw new AccessDeniedException("Only Admin or Receptionist can see portal accounts.");
        Map<String, Object> m = new LinkedHashMap<>();
        var u = accounts.accountOf(patientId);
        m.put("exists", u.isPresent());
        m.put("username", u.map(x -> x.getUsername()).orElse(null));
        return m;
    }

    @PostMapping("/account") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> createAccount(@PathVariable String patientId, @Valid @RequestBody PatientAccountRequest r) {
        accounts.createForExisting(patientId, r);
        return Map.of("message", "Portal login created");
    }
}
