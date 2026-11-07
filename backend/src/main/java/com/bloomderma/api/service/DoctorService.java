package com.bloomderma.api.service;

import com.bloomderma.api.dto.DoctorDto;
import com.bloomderma.api.dto.DoctorRequest;
import com.bloomderma.api.exception.*;
import com.bloomderma.api.model.Doctor;
import com.bloomderma.api.model.User;
import com.bloomderma.api.repository.DoctorRepository;
import com.bloomderma.api.repository.UserRepository;
import com.bloomderma.api.security.CurrentUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@ConditionalOnProperty(name = "bloomderma.modules.doctors", havingValue = "true", matchIfMissing = true)
public class DoctorService {
    private static final List<String> DEFAULT_SLOTS = List.of("10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
            "12:00 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM");
    private static final String[][] PALETTE = { {"#E88AA7", "#C15C7C"}, {"#C9B6E4", "#8768B3"}, {"#A9D8EE", "#4D91B4"},
            {"#9FD8C4", "#4F9C82"}, {"#F3C98B", "#E39A4A"} };

    private final DoctorRepository repo;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final CurrentUser current;
    private final SpecialityService specialities;
    private final FeeConfig fees;

    public DoctorService(DoctorRepository repo, UserRepository users, PasswordEncoder encoder,
                         CurrentUser current, SpecialityService specialities, FeeConfig fees) {
        this.fees = fees;
        this.repo = repo; this.users = users; this.encoder = encoder; this.current = current; this.specialities = specialities;
    }

    /** Contact details (phone/email) are only returned to ADMIN. Credentials are never returned to anyone. */
    public List<DoctorDto> findAll(Authentication auth) {
        boolean contact = current.isAdmin(auth);
        return repo.findAll().stream().map(d -> DoctorDto.from(d, contact,
                contact ? users.findByDoctorId(d.getId()).map(User::getUsername).orElse(null) : null,
                fees.video(d))).toList();
    }

    /** Creates the doctor record and the doctor's own login (username = Doctor ID, BCrypt password) atomically. */
    @Transactional
    public DoctorDto create(DoctorRequest r) {
        String id = r.id().trim();
        if (repo.existsById(id)) throw new ConflictException("Doctor ID " + id + " already exists");
        if (users.findByUsername(id).isPresent()) throw new ConflictException("Doctor ID " + id + " is already in use by another account");
        var spec = specialities.canonical(r.specialty())
                .orElseThrow(() -> new IllegalArgumentException("Unknown speciality: " + r.specialty()));

        Doctor d = new Doctor();
        d.setId(id);
        String name = r.name().trim();
        d.setName(name.matches("(?i)^dr\\.?\\s.*") ? name : "Dr. " + name);
        d.setSpecialty(spec.name);                                   // stored canonical speciality drives suggestions
        d.setVideoFee(r.videoFee());
        d.setPhone(blankToNull(r.phone())); d.setEmail(blankToNull(r.email()));
        d.setBio(r.bio() == null || r.bio().isBlank() ? spec.name + " specialist." : r.bio().trim());
        String[] colours = PALETTE[(int) (repo.count() % PALETTE.length)];
        d.setColor1(colours[0]); d.setColor2(colours[1]);
        d.setSlots(r.slots() == null || r.slots().isEmpty() ? new ArrayList<>(DEFAULT_SLOTS) : new ArrayList<>(r.slots()));
        d.setTreats(r.treats() == null || r.treats().isEmpty() ? specialities.defaultTreats(spec) : new ArrayList<>(r.treats()));
        Doctor saved = repo.save(d);

        User u = new User();
        u.setUsername(id); u.setPassword(encoder.encode(r.password())); u.setRole("DOCTOR"); u.setDoctorId(id);
        users.save(u);
        return DoctorDto.from(saved, true, id, fees.video(saved));
    }

    public Doctor update(String id, Doctor d) {
        if (!repo.existsById(id)) throw new ResourceNotFoundException("Doctor " + id + " not found");
        d.setId(id);
        return repo.save(d);
    }

    @Transactional
    public void delete(String id) {
        if (!repo.existsById(id)) throw new ResourceNotFoundException("Doctor " + id + " not found");
        users.findByDoctorId(id).ifPresent(users::delete);
        repo.deleteById(id);
        repo.flush();   // fails with 409 (and rolls the login deletion back) if the doctor still has appointments
    }

    /** Doctors whose STORED speciality matches the concern / treatment selected while booking. */
    public Map<String, Object> suggest(String concern, String treatment) {
        Map<String, Object> out = new LinkedHashMap<>();
        boolean hasInput = (concern != null && !concern.isBlank()) || (treatment != null && !treatment.isBlank());
        List<Doctor> all = repo.findAll();
        String basedOn = treatment != null && !treatment.isBlank() && !specialities.resolve(null, treatment).isEmpty()
                ? treatment : (concern == null ? "" : concern);
        List<SpecialityService.Speciality> wanted = hasInput ? specialities.resolve(concern, treatment) : List.of();

        out.put("basedOn", basedOn);
        if (wanted.isEmpty()) {
            out.put("mapped", false);
            out.put("specialities", List.of());
            out.put("doctors", all.stream().map(this::brief).toList());
            out.put("message", hasInput
                    ? "No speciality is mapped to \"" + basedOn + "\" yet - showing all doctors."
                    : "Select a concern or treatment to see suggested doctors.");
            return out;
        }
        List<String> names = wanted.stream().map(s -> s.name).toList();
        List<Map<String, Object>> matches = new ArrayList<>();
        for (SpecialityService.Speciality s : wanted)                  // primary speciality first
            for (Doctor d : all)
                if (specialities.matches(d, s) && matches.stream().noneMatch(m -> m.get("id").equals(d.getId())))
                    matches.add(brief(d));
        out.put("mapped", true);
        out.put("specialities", names);
        out.put("doctors", matches);
        out.put("message", matches.isEmpty()
                ? "No matching doctor is currently available for " + String.join(" / ", names) + "."
                : "Suggested for \"" + basedOn + "\": " + String.join(" / ", names) + ".");
        return out;
    }

    public List<String> specialityNames() { return specialities.names(); }

    private Map<String, Object> brief(Doctor d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId()); m.put("name", d.getName()); m.put("specialty", d.getSpecialty());
        return m;
    }
    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
}
