package com.bloomderma.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Turns a doctor's keywords + prescription into a complete patient report (plain text with "## " headings).
 *  - With bloomderma.ai.api-key set, the wording is written by Claude (Anthropic Messages API).
 *  - Without a key, or if the AI call fails, a built-in template is used so the feature always works.
 * The prescription section is ALWAYS the doctor's own text, copied verbatim - the AI never writes medicines or doses.
 * The patient's name is never sent to the AI service (only age, gender and the doctor's speciality).
 */
@Service
public class AiReportService {
    public record Draft(String text, boolean aiUsed, String note) { }

    private static final String SYSTEM = String.join("\n",
            "You write patient reports for a dermatology clinic from a doctor's short notes.",
            "Rules:",
            "- Use ONLY the information the doctor gave. Never invent diagnoses, test results, medicines, doses or durations.",
            "- Write in clear, simple, reassuring language a patient can understand.",
            "- Do NOT write a prescription or name any medicine; the prescription is added separately.",
            "- Output plain text with exactly these sections, in this order, each starting with a line '## <Title>':",
            "## Presenting Complaints   (short '- ' bullets)",
            "## Clinical Summary        (one short paragraph)",
            "## Advice & Precautions    (4 to 6 short '- ' bullets of general skin/hair care consistent with the notes)",
            "## Follow-up               (one or two sentences)",
            "- No other headings, no markdown besides '## ' and '- ', no code fences, no greetings or sign-off.");

    private final String apiKey, model;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    public AiReportService(@Value("${bloomderma.ai.api-key:}") String apiKey,
                           @Value("${bloomderma.ai.model:claude-sonnet-5-5}") String model) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
    }

    public Draft draft(String keywords, String prescription, Integer age, String gender, String speciality) {
        Map<String, String> ai = null;
        String note;
        if (apiKey.isEmpty()) {
            note = "AI is not configured (no API key), so a standard template was used. Please review and edit the text.";
        } else {
            try {
                ai = callAi(keywords, age, gender, speciality);
                note = ai == null ? "The AI answer could not be used, so a standard template was used. Please review and edit." : null;
            } catch (Exception e) {
                note = "The AI service could not be reached, so a standard template was used. Please review and edit.";
            }
        }
        boolean used = ai != null;
        Map<String, String> s = used ? ai : template(keywords, age, gender);
        return new Draft(compose(s, prescription), used, used ? "Written by AI from your keywords. Please review before saving." : note);
    }

    // ---------- AI call ----------
    private Map<String, String> callAi(String keywords, Integer age, String gender, String speciality) throws Exception {
        String who = (age == null ? "adult" : age + "-year-old") + (gender == null || gender.isBlank() ? " patient" : " " + gender.toLowerCase(Locale.ROOT) + " patient");
        String user = "Doctor's speciality: " + (speciality == null ? "Dermatology" : speciality) + "\nPatient: " + who
                + "\nDoctor's keywords / notes:\n" + keywords;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", 1200);
        body.put("system", SYSTEM);
        body.put("messages", List.of(Map.of("role", "user", "content", user)));

        HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.anthropic.com/v1/messages"))
                .timeout(Duration.ofSeconds(60))
                .header("content-type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) return null;

        StringBuilder text = new StringBuilder();
        for (JsonNode block : mapper.readTree(res.body()).path("content"))
            if ("text".equals(block.path("type").asText())) text.append(block.path("text").asText()).append('\n');
        return parseSections(text.toString());
    }

    /** Splits "## Title" sections; returns null unless the complaints and summary sections are present. */
    static Map<String, String> parseSections(String raw) {
        String cleaned = raw.replace("```", "").trim();
        Map<String, String> out = new LinkedHashMap<>();
        String current = null;
        StringBuilder buf = new StringBuilder();
        for (String line : cleaned.split("\n")) {
            if (line.startsWith("## ")) {
                if (current != null) out.put(current, buf.toString().trim());
                current = canonical(line.substring(3));
                buf.setLength(0);
            } else if (current != null) buf.append(line).append('\n');
        }
        if (current != null) out.put(current, buf.toString().trim());
        out.remove(null);
        return out.getOrDefault("complaints", "").isBlank() || out.getOrDefault("summary", "").isBlank() ? null : out;
    }

    private static String canonical(String title) {
        String t = title.toLowerCase(Locale.ROOT);
        if (t.contains("complaint")) return "complaints";
        if (t.contains("summary")) return "summary";
        if (t.contains("advice") || t.contains("precaution")) return "advice";
        if (t.contains("follow")) return "followup";
        return null;                                        // unknown (e.g. a prescription written by the AI) is dropped
    }

    // ---------- template fallback ----------
    private static Map<String, String> template(String keywords, Integer age, String gender) {
        List<String> items = new ArrayList<>();
        for (String k : keywords.split("[,;\\n]+")) {
            String t = k.trim();
            if (!t.isEmpty()) items.add(Character.toUpperCase(t.charAt(0)) + t.substring(1));
        }
        StringBuilder complaints = new StringBuilder();
        for (String i : items) complaints.append("- ").append(i).append('\n');
        String who = (age == null ? "The patient" : "The " + age + "-year-old patient")
                + (gender == null || gender.isBlank() ? "" : " (" + gender.toLowerCase(Locale.ROOT) + ")");
        Map<String, String> s = new LinkedHashMap<>();
        s.put("complaints", complaints.toString().trim());
        s.put("summary", who + " was examined for the concerns listed above. " + "Notes from the consultation: "
                + String.join(", ", items).toLowerCase(Locale.ROOT) + ".");
        s.put("advice", String.join("\n",
                "- Take the prescribed medicines exactly as directed by your doctor.",
                "- Use a gentle cleanser and apply a broad-spectrum sunscreen every morning.",
                "- Avoid picking, scratching or applying products that were not prescribed.",
                "- Contact the clinic if you notice worsening redness, swelling, pain or any side effects."));
        s.put("followup", "Please review with your doctor as advised, or sooner if your symptoms get worse.");
        return s;
    }

    // ---------- final text (doctor's prescription is inserted verbatim) ----------
    private static String compose(Map<String, String> s, String prescription) {
        StringBuilder b = new StringBuilder();
        b.append("## Presenting Complaints\n").append(bullets(s.get("complaints"))).append("\n\n");
        b.append("## Clinical Summary\n").append(s.get("summary")).append("\n\n");
        b.append("## Prescription\n").append(prescriptionLines(prescription)).append("\n\n");
        if (s.get("advice") != null && !s.get("advice").isBlank()) b.append("## Advice & Precautions\n").append(bullets(s.get("advice"))).append("\n\n");
        b.append("## Follow-up\n").append(s.getOrDefault("followup", "Please review with your doctor as advised."));
        return b.toString().trim();
    }

    private static String bullets(String text) {
        StringBuilder b = new StringBuilder();
        for (String line : text.split("\n")) {
            String t = line.trim();
            if (t.isEmpty()) continue;
            b.append(t.startsWith("- ") ? t : t.startsWith("* ") ? "- " + t.substring(2) : "- " + t).append('\n');
        }
        return b.toString().trim();
    }

    /** One bullet per line the doctor typed, with any "1." / "-" list markers removed. */
    static String prescriptionLines(String prescription) {
        StringBuilder b = new StringBuilder();
        for (String line : prescription.split("\n")) {
            String t = line.trim().replaceFirst("^([-*\u2022]|\\d+[.)])\\s*", "");
            if (!t.isEmpty()) b.append("- ").append(t).append('\n');
        }
        return b.toString().trim();
    }
}
