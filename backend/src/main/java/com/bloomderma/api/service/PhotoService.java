package com.bloomderma.api.service;

import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.PhotoSet;
import com.bloomderma.api.repository.PhotoSetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Before / after photo sets. A patient manages their own; doctors and staff can look at them (read only). */
@Service
public class PhotoService {
    public record Image(byte[] bytes, String contentType) { }

    private final PhotoSetRepository repo;
    private final UploadStore store;

    public PhotoService(PhotoSetRepository repo, UploadStore store) { this.repo = repo; this.store = store; }

    public List<PhotoSet> list(String patientId) { return repo.findByPatientIdOrderByCreatedAtDesc(patientId); }

    public PhotoSet get(Long id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Photo set " + id + " not found"));
    }

    @Transactional
    public PhotoSet add(String patientId, String caption, MultipartFile before, MultipartFile after) {
        String cap = caption == null ? "" : caption.trim();
        if (cap.isEmpty()) throw new IllegalArgumentException("Please describe the photos (for example: Acne treatment).");
        if (cap.length() > 100 || cap.contains("<") || cap.contains(">"))
            throw new IllegalArgumentException("The description must be at most 100 characters and cannot contain < or >.");
        UploadStore.Saved b = store.saveImage(before);
        UploadStore.Saved a = null;
        if (after != null && !after.isEmpty()) {
            try { a = store.saveImage(after); } catch (RuntimeException e) { store.delete(b.storedName()); throw e; }
        }
        PhotoSet p = new PhotoSet();
        p.setPatientId(patientId); p.setCaption(cap); p.setCreatedAt(LocalDateTime.now());
        p.setBeforeFile(b.storedName()); p.setBeforeType(b.contentType()); p.setBeforeOn(LocalDate.now());
        if (a != null) { p.setAfterFile(a.storedName()); p.setAfterType(a.contentType()); p.setAfterOn(LocalDate.now()); }
        return repo.save(p);
    }

    /** Add (or replace) the "after" photo of an existing set. */
    @Transactional
    public PhotoSet setAfter(PhotoSet p, MultipartFile after) {
        UploadStore.Saved a = store.saveImage(after);
        String old = p.getAfterFile();
        p.setAfterFile(a.storedName()); p.setAfterType(a.contentType()); p.setAfterOn(LocalDate.now());
        PhotoSet saved = repo.save(p);
        store.delete(old);
        return saved;
    }

    public Image image(PhotoSet p, String side) {
        if ("after".equals(side) && p.getAfterFile() != null) return new Image(store.read(p.getAfterFile()), p.getAfterType());
        if ("before".equals(side)) return new Image(store.read(p.getBeforeFile()), p.getBeforeType());
        throw new ResourceNotFoundException("There is no " + side + " photo in this set.");
    }

    @Transactional
    public void delete(PhotoSet p) {
        store.delete(p.getBeforeFile()); store.delete(p.getAfterFile());
        repo.delete(p);
    }
}
