package com.bloomderma.api.service;

import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.repository.AppointmentRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tiny in-memory signalling relay for browser-to-browser (WebRTC) video calls: the two browsers exchange
 * offer/answer/ICE messages through here, the video itself never touches the server.
 * Only the patient and the doctor of a VIDEO appointment may use a room, and only on the appointment day.
 */
@Service
public class VideoService {
    private static final Set<String> TYPES = Set.of("ready", "offer", "answer", "ice", "bye");
    private static final int MAX_SIGNALS = 400;

    private static final class Signal {
        final long id; final String from, type, payload;
        Signal(long id, String from, String type, String payload) { this.id = id; this.from = from; this.type = type; this.payload = payload; }
    }

    private final Map<Long, List<Signal>> rooms = new ConcurrentHashMap<>();
    private final AtomicLong seq = new AtomicLong();
    private final AppointmentRepository appointments;
    private final CurrentUser current;

    public VideoService(AppointmentRepository appointments, CurrentUser current) {
        this.appointments = appointments; this.current = current;
    }

    private String authorize(Long id, Authentication auth) {
        Appointment a = appointments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Appointment " + id + " not found"));
        String role;
        boolean ok;
        if (current.isPatient(auth)) { role = "patient"; ok = a.getPatient().getId().equals(current.patientId(auth)); }
        else if (current.isDoctor(auth)) { role = "doctor"; ok = a.getDoctor().getId().equals(current.doctorId(auth)); }
        else { role = ""; ok = false; }
        if (!ok) throw new AccessDeniedException("This is not your consultation.");
        if (!"VIDEO".equals(a.getConsultMode())) throw new IllegalArgumentException("This is not a video consultation.");
        if ("Cancelled".equals(a.getStatus())) throw new IllegalArgumentException("This consultation was cancelled.");
        if (Billing.due(a) > 0) throw new IllegalArgumentException("The video consultation fee has not been paid yet. Please complete the payment first.");
        if (a.getDate() == null || !a.getDate().equals(LocalDate.now()))
            throw new IllegalArgumentException("The video call can be opened on the day of the consultation only.");
        return role;
    }

    /** New participants can join until 1 hour after the booked time (a call already running is not cut off). */
    private static final DateTimeFormatter SLOT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private void requireJoinWindow(Appointment a) {
        if (a.getTimeSlot() == null || a.getTimeSlot().isBlank()) return;
        LocalTime t;
        try { t = LocalTime.parse(a.getTimeSlot().trim().toUpperCase(), SLOT); } catch (Exception e) { return; }
        if (LocalDateTime.now().isAfter(LocalDateTime.of(a.getDate(), t).plusHours(1)))
            throw new IllegalArgumentException("The join window has closed: a video call can be joined up to 1 hour after its scheduled time.");
    }

    /** Returns the cursor from which this participant should read signals. */
    public Map<String, Object> join(Long id, Authentication auth) {
        String role = authorize(id, auth);
        requireJoinWindow(appointments.findById(id).orElseThrow());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("cursor", seq.get());
        return m;
    }

    public void send(Long id, String type, String payload, Authentication auth) {
        String role = authorize(id, auth);
        if (!TYPES.contains(type)) throw new IllegalArgumentException("Unknown signal type.");
        List<Signal> room = rooms.computeIfAbsent(id, k -> new ArrayList<>());
        synchronized (room) {
            room.add(new Signal(seq.incrementAndGet(), role, type, payload == null ? "" : payload));
            while (room.size() > MAX_SIGNALS) room.remove(0);
        }
    }

    public Map<String, Object> poll(Long id, long since, Authentication auth) {
        String role = authorize(id, auth);
        List<Signal> room = rooms.get(id);
        List<Map<String, Object>> out = new ArrayList<>();
        long cursor = since;
        if (room != null) {
            synchronized (room) {
                for (Signal s : room) {
                    cursor = Math.max(cursor, s.id);
                    if (s.id > since && !s.from.equals(role)) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id", s.id); m.put("from", s.from); m.put("type", s.type); m.put("payload", s.payload);
                        out.add(m);
                    }
                }
            }
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("cursor", cursor);
        res.put("signals", out);
        return res;
    }
}
