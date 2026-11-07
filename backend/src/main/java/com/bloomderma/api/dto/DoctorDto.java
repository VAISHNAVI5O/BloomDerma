package com.bloomderma.api.dto;

import com.bloomderma.api.model.Doctor;
import java.util.ArrayList;
import java.util.List;

/** Output DTO. Contact details are only filled for ADMIN. Credentials are never part of a doctor record. */
public record DoctorDto(String id, String name, String specialty, String bio, String color1, String color2,
                        List<String> slots, List<String> treats, String phone, String email, String loginId, Integer videoFee) {
    public static DoctorDto from(Doctor d, boolean includeContact, String loginId, int videoFee) {
        return new DoctorDto(d.getId(), d.getName(), d.getSpecialty(), d.getBio(), d.getColor1(), d.getColor2(),
                d.getSlots() == null ? new ArrayList<>() : new ArrayList<>(d.getSlots()),
                d.getTreats() == null ? new ArrayList<>() : new ArrayList<>(d.getTreats()),
                includeContact ? d.getPhone() : null, includeContact ? d.getEmail() : null, includeContact ? loginId : null, videoFee);
    }
}
