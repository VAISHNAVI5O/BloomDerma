package com.bloomderma.api.service;

import com.bloomderma.api.model.Appointment;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Start date-time of an appointment from its date + "10:30 AM" slot; null when it has no booked time. */
final class ApptTime {
    private static final DateTimeFormatter SLOT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private ApptTime() { }

    static LocalDateTime start(Appointment a) { return start(a.getDate(), a.getTimeSlot()); }

    static LocalDateTime start(LocalDate date, String slot) {
        if (date == null || slot == null || slot.isBlank()) return null;
        try { return LocalDateTime.of(date, LocalTime.parse(slot.trim().toUpperCase(), SLOT)); }
        catch (Exception e) { return null; }
    }
}
