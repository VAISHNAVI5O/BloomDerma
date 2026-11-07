package com.bloomderma.api.service;

import com.bloomderma.api.model.Doctor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;

/**
 * Concern/treatment -> doctor speciality mapping, loaded from resources/speciality-mapping.json
 * (edit that file to extend the mapping; no code change needed).
 */
@Service
public class SpecialityService {

    public static final class Speciality {
        public final String name;
        final Set<String> aliases = new HashSet<>();
        final Set<String> concerns = new HashSet<>();
        final Set<String> treatments = new HashSet<>();
        final List<String> concernLabels = new ArrayList<>();
        Speciality(String name) { this.name = name; }
        public List<String> concernLabels() { return concernLabels; }
    }

    private final List<Speciality> specialities = new ArrayList<>();

    public SpecialityService() throws Exception {
        try (InputStream in = new ClassPathResource("speciality-mapping.json").getInputStream()) {
            JsonNode root = new ObjectMapper().readTree(in);
            for (JsonNode n : root.get("specialities")) {
                Speciality s = new Speciality(n.get("name").asText());
                s.aliases.add(normalize(s.name));
                for (JsonNode a : n.path("aliases")) s.aliases.add(normalize(a.asText()));
                for (JsonNode c : n.path("concerns")) { s.concerns.add(normalize(c.asText())); s.concernLabels.add(c.asText()); }
                for (JsonNode t : n.path("treatments")) s.treatments.add(normalize(t.asText()));
                specialities.add(s);
            }
        }
    }

    /** lower-case, "&" -> "and", punctuation removed, spaces collapsed. */
    static String normalize(String v) {
        if (v == null) return "";
        return v.toLowerCase(Locale.ROOT).replace("&", " and ").replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** Canonical speciality names, used by the Add Doctor form. */
    public List<String> names() {
        List<String> out = new ArrayList<>();
        for (Speciality s : specialities) out.add(s.name);
        return out;
    }

    /** Accepts a canonical name or an alias; returns the canonical speciality. */
    public Optional<Speciality> canonical(String text) {
        String n = normalize(text);
        if (n.isEmpty()) return Optional.empty();
        return specialities.stream().filter(s -> s.aliases.contains(n)).findFirst();
    }

    /** Specialities relevant for the selection. A mapped treatment wins; otherwise the concern decides. */
    public List<Speciality> resolve(String concern, String treatment) {
        String t = normalize(treatment), c = normalize(concern);
        List<Speciality> out = new ArrayList<>();
        if (!t.isEmpty()) for (Speciality s : specialities) if (s.treatments.contains(t)) out.add(s);
        if (out.isEmpty() && !c.isEmpty()) for (Speciality s : specialities) if (s.concerns.contains(c)) out.add(s);
        return out;
    }

    /** True when the doctor's STORED speciality is the given speciality (or one of its aliases). */
    public boolean matches(Doctor d, Speciality s) {
        return s.aliases.contains(normalize(d.getSpecialty()));
    }

    /** Fallback slots / tags for doctors created from the Add Doctor form. */
    public List<String> defaultTreats(Speciality s) {
        return new ArrayList<>(s.concernLabels.subList(0, Math.min(3, s.concernLabels.size())));
    }
}
