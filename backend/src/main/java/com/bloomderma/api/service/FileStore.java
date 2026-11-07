package com.bloomderma.api.service;

import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.StoredFile;
import com.bloomderma.api.repository.StoredFileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;

/**
 * Stores uploaded files in the database. Files saved by older versions in the upload folder are still found:
 * the first time one is opened it is copied into the database, so it keeps working from then on.
 */
@Component
public class FileStore {
    private final StoredFileRepository repo;
    private final Path legacyFolder;

    public FileStore(StoredFileRepository repo, @Value("${bloomderma.upload-dir:./uploads}") String legacyDir) {
        this.repo = repo;
        this.legacyFolder = Paths.get(legacyDir).toAbsolutePath().normalize();
    }

    /** Saves the bytes and returns the file id (kept in the report / photo record). */
    public String save(byte[] data, String contentType, String ext) {
        StoredFile f = new StoredFile();
        f.setId(UUID.randomUUID() + "." + ext);
        f.setContentType(contentType);
        f.setSize(data.length);
        f.setData(data);
        return repo.save(f).getId();
    }

    public byte[] read(String id) {
        Optional<StoredFile> stored = repo.findById(id);
        if (stored.isPresent() && stored.get().getData() != null) return stored.get().getData();

        // file written by an older version into the upload folder -> copy it into the database
        try {
            Path p = legacyFolder.resolve(id).normalize();
            if (p.startsWith(legacyFolder) && Files.isRegularFile(p)) {
                byte[] bytes = Files.readAllBytes(p);
                StoredFile f = new StoredFile();
                f.setId(id); f.setSize(bytes.length); f.setData(bytes);
                f.setContentType(id.endsWith(".pdf") ? "application/pdf" : id.endsWith(".png") ? "image/png"
                        : id.endsWith(".webp") ? "image/webp" : "image/jpeg");
                repo.save(f);
                return bytes;
            }
        } catch (IOException e) { throw new UncheckedIOException(e); }
        throw new ResourceNotFoundException("This file was uploaded before the files were moved into the database and could not be found. Please upload it again.");
    }

    public void delete(String id) {
        if (id != null && repo.existsById(id)) repo.deleteById(id);
    }
}
