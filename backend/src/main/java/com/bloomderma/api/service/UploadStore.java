package com.bloomderma.api.service;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;

/** Saves uploaded IMAGES (before/after photos) in the database after checking their real content. */
@Component
public class UploadStore {
    public record Saved(String storedName, String contentType) { }

    private final FileStore files;

    public UploadStore(FileStore files) { this.files = files; }

    public Saved saveImage(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Please choose an image.");
        byte[] d;
        try { d = file.getBytes(); } catch (IOException e) { throw new UncheckedIOException(e); }
        String ext = ReportService.detect(d);
        if (ext == null || ext.equals("pdf"))
            throw new IllegalArgumentException("Photos must be PNG, JPG or WEBP images. (HEIC photos must be saved as JPG first.)");
        String type = ext.equals("png") ? "image/png" : ext.equals("webp") ? "image/webp" : "image/jpeg";
        return new Saved(files.save(d, type, ext), type);
    }

    public byte[] read(String stored) { return files.read(stored); }

    public void delete(String stored) { files.delete(stored); }
}
