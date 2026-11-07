package com.bloomderma.api.security;

import com.bloomderma.api.model.User;
import com.bloomderma.api.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Resolves role and doctor identity of the caller from the AUTHENTICATED token - never from request parameters. */
@Component
public class CurrentUser {
    private static final Set<String> FRONT_DESK = Set.of("ADMIN", "RECEPTIONIST", "STAFF");
    private final UserRepository users;
    public CurrentUser(UserRepository users) { this.users = users; }

    public String role(Authentication a) {
        if (a == null || a.getAuthorities() == null || a.getAuthorities().isEmpty()) return "";
        return a.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
    }
    public boolean isDoctor(Authentication a) { return "DOCTOR".equals(role(a)); }
    public boolean isAdmin(Authentication a) { return "ADMIN".equals(role(a)); }
    /** ADMIN, RECEPTIONIST (and legacy STAFF) may book appointments. */
    public boolean isFrontDesk(Authentication a) { return FRONT_DESK.contains(role(a)); }

    public boolean isPatient(Authentication a) { return "PATIENT".equals(role(a)); }

    /** patients.id of the logged-in patient (from the account row, never from the request); null for others. */
    public String patientId(Authentication a) {
        if (!isPatient(a)) return null;
        return users.findByUsername(a.getName()).map(User::getPatientId).orElse(null);
    }

    /** doctors.id of the logged-in doctor, looked up from the account in the database; null for non-doctors. */
    public String doctorId(Authentication a) {
        if (!isDoctor(a)) return null;
        return users.findByUsername(a.getName()).map(User::getDoctorId).orElse(null);
    }
}
