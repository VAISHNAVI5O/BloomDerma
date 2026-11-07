package com.bloomderma.api.dto;

import com.bloomderma.api.model.PhotoSet;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PhotoSetDto(Long id, String caption, boolean hasAfter, LocalDate beforeOn, LocalDate afterOn, LocalDateTime createdAt) {
    public static PhotoSetDto from(PhotoSet p) {
        return new PhotoSetDto(p.getId(), p.getCaption(), p.getAfterFile() != null, p.getBeforeOn(), p.getAfterOn(), p.getCreatedAt());
    }
}
