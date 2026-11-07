package com.bloomderma.api.service;

import com.bloomderma.api.model.Patient;
import com.bloomderma.api.repository.PatientRepository;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Hands out patient IDs in the clinic format SK + three digits (SK001, SK002 ... SK999).
 * Patients and staff never type a patient ID for a NEW patient: the system gives the next free number.
 * Every ID in the database must match {@link #FORMAT}; see PatientIdCleanup for how old-format records are handled.
 */
@Component
public class PatientIdGenerator {
    /** The only accepted patient ID format: "SK" followed by exactly three digits. */
    public static final Pattern FORMAT = Pattern.compile("^SK\\d{3}$");
    private static final int MAX = 999;
    private final PatientRepository patients;

    public PatientIdGenerator(PatientRepository patients) { this.patients = patients; }

    public static boolean isValid(String id) { return id != null && FORMAT.matcher(id).matches(); }

    /** Next free ID: one more than the highest SK### already in use (so numbers are never re-used out of order). */
    public synchronized String next() {
        int highest = 0;
        for (Patient p : patients.findAll())
            if (isValid(p.getId())) highest = Math.max(highest, Integer.parseInt(p.getId().substring(2)));
        for (int n = highest + 1; n <= MAX; n++) {
            String id = String.format("SK%03d", n);
            if (!patients.existsById(id)) return id;
        }
        throw new IllegalStateException("All patient IDs from SK001 to SK999 are in use.");
    }
}
