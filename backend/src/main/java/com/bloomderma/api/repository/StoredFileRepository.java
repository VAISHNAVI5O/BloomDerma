package com.bloomderma.api.repository;

import com.bloomderma.api.model.StoredFile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredFileRepository extends JpaRepository<StoredFile, String> { }
