package com.bloomderma.api.dto;

import com.bloomderma.api.model.Report;
import java.time.LocalDateTime;

public record ReportDto(Long id, String title, String fileName, String contentType, long size, LocalDateTime uploadedAt, String createdBy) {
    public static ReportDto from(Report r) {
        return new ReportDto(r.getId(), r.getTitle(), r.getOriginalName(), r.getContentType(), r.getSize(), r.getUploadedAt(), r.getCreatedBy());
    }
}
