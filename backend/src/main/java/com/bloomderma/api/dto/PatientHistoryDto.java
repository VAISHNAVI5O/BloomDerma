package com.bloomderma.api.dto;

import java.time.LocalDate;
import java.util.List;

/** A patient together with every visit/appointment on record (all doctors). */
public record PatientHistoryDto(String id, String name, Integer age, String gender, String phone, String email,
                                String address, String skinConcern, String medicalHistory, String allergies,
                                LocalDate registrationDate, List<VisitDto> visits) { }
