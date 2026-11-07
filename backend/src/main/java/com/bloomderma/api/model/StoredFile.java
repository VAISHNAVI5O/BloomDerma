package com.bloomderma.api.model;

import jakarta.persistence.*;
import lombok.Data;

/**
 * The bytes of an uploaded report / photo. Kept in the DATABASE (not in a folder next to the program), so the
 * files always travel with the report records - moving the project, unzipping a new version or starting the
 * backend from another folder can no longer make uploaded files "disappear".
 */
@Entity @Table(name = "stored_files") @Data
public class StoredFile {
    @Id @Column(length = 120) private String id;
    private String contentType;
    private long size;
    @Lob private byte[] data;
}
