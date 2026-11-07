package com.bloomderma.api.service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Minimal, dependency-free PDF writer used for generated patient reports (A4, Helvetica, automatic page breaks).
 * Body format understood by {@link #build}:  "## Heading" lines, "- bullet" lines, blank line = paragraph gap,
 * anything else = wrapped paragraph text.
 */
public final class ReportPdf {
    private ReportPdf() { }

    private static final int[] REG = {278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584};
    private static final int[] BOLD = {278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584};

    private static final float W = 595f, H = 842f, MARGIN = 50f, BOTTOM = 70f;
    private static final float[] ROSE = {0.741f, 0.357f, 0.482f};
    private static final float[] INK = {0.267f, 0.220f, 0.286f};
    private static final float[] SOFT = {0.537f, 0.475f, 0.553f};
    private static final float[] TINT = {0.988f, 0.941f, 0.961f};

    /** Everything that goes on the report besides the doctor's body text. */
    public record Header(String patientName, String patientId, String ageGender, String doctorName,
                         String speciality, LocalDate date) { }

    // ---------- text helpers ----------
    /** Keep only characters the standard PDF fonts can show (Latin-1); map a few common symbols. */
    static String clean(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\u2013': case '\u2014': b.append('-'); break;
                case '\u2018': case '\u2019': b.append('\''); break;
                case '\u201C': case '\u201D': b.append('"'); break;
                case '\u2022': case '\u00B7': b.append('-'); break;
                case '\u2026': b.append("..."); break;
                case '\u20B9': b.append("Rs."); break;
                case '\t': b.append("    "); break;
                case '\r': break;
                default:
                    if (c == '\n' || (c >= 32 && c <= 126) || (c >= 161 && c <= 255)) b.append(c);
                    else if (c >= 32) b.append('?');
            }
        }
        return b.toString();
    }

    static float width(String s, boolean bold, float size) {
        int[] w = bold ? BOLD : REG;
        float total = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            total += (c >= 32 && c <= 126) ? w[c - 32] : 556;
        }
        return total * size / 1000f;
    }

    static List<String> wrap(String text, boolean bold, float size, float maxWidth) {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" +")) {
            if (word.isEmpty()) continue;
            while (width(word, bold, size) > maxWidth) {                 // a single very long word: hard-break it
                int cut = word.length();
                while (cut > 1 && width(word.substring(0, cut), bold, size) > maxWidth) cut--;
                if (line.length() > 0) { lines.add(line.toString()); line.setLength(0); }
                lines.add(word.substring(0, cut));
                word = word.substring(cut);
            }
            String candidate = line.length() == 0 ? word : line + " " + word;
            if (width(candidate, bold, size) <= maxWidth) { line.setLength(0); line.append(candidate); }
            else { lines.add(line.toString()); line.setLength(0); line.append(word); }
        }
        if (line.length() > 0) lines.add(line.toString());
        if (lines.isEmpty()) lines.add("");
        return lines;
    }

    private static String esc(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '\\' || c == '(' || c == ')') b.append('\\').append(c);
            else if (c > 126) b.append(String.format("\\%03o", (int) c));
            else b.append(c);
        }
        return b.toString();
    }

    // ---------- page model ----------
    private static final class Page {
        final StringBuilder ops = new StringBuilder();
        void text(String font, float size, float[] rgb, float x, float y, String s) {
            ops.append(String.format(Locale.ROOT, "BT /%s %.2f Tf %.3f %.3f %.3f rg %.2f %.2f Td (%s) Tj ET\n",
                    font, size, rgb[0], rgb[1], rgb[2], x, y, esc(s)));
        }
        void rect(float[] rgb, float x, float y, float w, float h) {
            ops.append(String.format(Locale.ROOT, "%.3f %.3f %.3f rg %.2f %.2f %.2f %.2f re f\n", rgb[0], rgb[1], rgb[2], x, y, w, h));
        }
        void line(float[] rgb, float x1, float y1, float x2, float y2) {
            ops.append(String.format(Locale.ROOT, "%.3f %.3f %.3f RG 0.8 w %.2f %.2f m %.2f %.2f l S\n", rgb[0], rgb[1], rgb[2], x1, y1, x2, y2));
        }
        void dot(float[] rgb, float cx, float cy, float r) {          // small filled square used as bullet
            rect(rgb, cx - r, cy - r, 2 * r, 2 * r);
        }
    }

    /** Builds the report PDF. {@code body} uses the light markup described in the class comment. */
    public static byte[] build(Header h, String body) {
        List<Page> pages = new ArrayList<>();
        Page[] cur = { newPage(pages) };
        float[] y = { H - MARGIN };

        // ---- brand band + title (first page only) ----
        Page p0 = cur[0];
        p0.rect(ROSE, 0, H - 92, W, 92);
        p0.text("F2", 24, new float[]{1, 1, 1}, MARGIN, H - 48, "BloomDerma");
        p0.text("F1", 10.5f, new float[]{1, 0.93f, 0.96f}, MARGIN, H - 66, "Dermatology Clinic");
        p0.text("F2", 15, new float[]{1, 1, 1}, W - MARGIN - width("MEDICAL REPORT", true, 15), H - 50, "MEDICAL REPORT");
        p0.text("F1", 10, new float[]{1, 0.93f, 0.96f}, W - MARGIN - width(longDate(h.date()), false, 10), H - 66, longDate(h.date()));
        y[0] = H - 92 - 22;

        // ---- patient / doctor box ----
        String[][] rows = {
            {"Patient", clean(h.patientName()), "Patient ID", clean(h.patientId())},
            {"Age / Gender", clean(h.ageGender()), "Date", shortDate(h.date())},
            {"Doctor", clean(h.doctorName()), "Speciality", clean(h.speciality())}};
        float boxH = rows.length * 20 + 14;
        p0.rect(TINT, MARGIN, y[0] - boxH, W - 2 * MARGIN, boxH);
        float ry = y[0] - 20;
        float colB = MARGIN + (W - 2 * MARGIN) / 2 + 8;
        for (String[] r : rows) {
            p0.text("F2", 9, SOFT, MARGIN + 12, ry, r[0].toUpperCase(Locale.ROOT));
            p0.text("F1", 10.5f, INK, MARGIN + 92, ry, fit(r[1], false, 10.5f, (W - 2 * MARGIN) / 2 - 100));
            p0.text("F2", 9, SOFT, colB, ry, r[2].toUpperCase(Locale.ROOT));
            p0.text("F1", 10.5f, INK, colB + 80, ry, fit(r[3], false, 10.5f, (W - 2 * MARGIN) / 2 - 92));
            ry -= 20;
        }
        y[0] -= boxH + 24;

        // ---- body ----
        float textW = W - 2 * MARGIN;
        for (String raw : clean(body).split("\n", -1)) {
            String line = raw.stripTrailing();
            if (line.isBlank()) { y[0] -= 6; continue; }
            if (line.startsWith("## ")) {
                String t = line.substring(3).trim();
                y[0] -= 6;
                ensure(pages, cur, y, 40);
                cur[0].text("F2", 12.5f, ROSE, MARGIN, y[0], t);
                cur[0].line(ROSE, MARGIN, y[0] - 5, W - MARGIN, y[0] - 5);
                y[0] -= 22;
            } else if (line.startsWith("- ") || line.startsWith("* ")) {
                List<String> parts = wrap(line.substring(2).trim(), false, 10.5f, textW - 18);
                for (int i = 0; i < parts.size(); i++) {
                    ensure(pages, cur, y, 16);
                    if (i == 0) cur[0].dot(ROSE, MARGIN + 6, y[0] + 3, 1.8f);
                    cur[0].text("F1", 10.5f, INK, MARGIN + 18, y[0], parts.get(i));
                    y[0] -= 15;
                }
            } else {
                for (String part : wrap(line.trim(), false, 10.5f, textW)) {
                    ensure(pages, cur, y, 16);
                    cur[0].text("F1", 10.5f, INK, MARGIN, y[0], part);
                    y[0] -= 15;
                }
            }
        }

        // ---- signature ----
        ensure(pages, cur, y, 90);
        y[0] -= 30;
        cur[0].line(SOFT, W - MARGIN - 190, y[0], W - MARGIN, y[0]);
        cur[0].text("F2", 10.5f, INK, W - MARGIN - 190, y[0] - 15, fit(clean(h.doctorName()), true, 10.5f, 190));
        cur[0].text("F1", 9, SOFT, W - MARGIN - 190, y[0] - 28, fit(clean(h.speciality()), false, 9, 190));

        // ---- footers (need the final page count) ----
        for (int i = 0; i < pages.size(); i++) {
            Page pg = pages.get(i);
            pg.line(new float[]{0.94f, 0.87f, 0.91f}, MARGIN, 52, W - MARGIN, 52);
            pg.text("F3", 8, SOFT, MARGIN, 38, "Reviewed and approved by the treating doctor. This report does not replace an in-person consultation.");
            String num = "Page " + (i + 1) + " of " + pages.size();
            pg.text("F1", 8, SOFT, W - MARGIN - width(num, false, 8), 38, num);
        }
        return assemble(pages);
    }

    private static Page newPage(List<Page> pages) { Page p = new Page(); pages.add(p); return p; }

    private static void ensure(List<Page> pages, Page[] cur, float[] y, float needed) {
        if (y[0] - needed < BOTTOM) { cur[0] = newPage(pages); y[0] = H - MARGIN; }
    }

    private static String fit(String s, boolean bold, float size, float max) {
        if (width(s, bold, size) <= max) return s;
        String t = s;
        while (t.length() > 1 && width(t + "...", bold, size) > max) t = t.substring(0, t.length() - 1);
        return t + "...";
    }

    private static String longDate(LocalDate d) {
        return d.getDayOfMonth() + " " + d.getMonth().getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH) + " " + d.getYear();
    }
    private static String shortDate(LocalDate d) { return String.format(Locale.ROOT, "%02d/%02d/%d", d.getDayOfMonth(), d.getMonthValue(), d.getYear()); }

    // ---------- PDF file structure ----------
    private static byte[] assemble(List<Page> pages) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        List<Integer> offsets = new ArrayList<>();
        int n = pages.size();
        // object numbers: 1 catalog, 2 pages, 3-5 fonts, then (page, content) pairs
        write(out, "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
        obj(out, offsets, 1, "<< /Type /Catalog /Pages 2 0 R >>");
        StringBuilder kids = new StringBuilder();
        for (int i = 0; i < n; i++) kids.append(6 + 2 * i).append(" 0 R ");
        obj(out, offsets, 2, "<< /Type /Pages /Kids [" + kids + "] /Count " + n + " >>");
        obj(out, offsets, 3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        obj(out, offsets, 4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        obj(out, offsets, 5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
        for (int i = 0; i < n; i++) {
            int pageNo = 6 + 2 * i, contentNo = pageNo + 1;
            obj(out, offsets, pageNo, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents " + contentNo
                    + " 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>");
            byte[] content = pages.get(i).ops.toString().getBytes(StandardCharsets.ISO_8859_1);
            offsets.add(out.size());
            write(out, contentNo + " 0 obj\n<< /Length " + content.length + " >>\nstream\n");
            out.write(content, 0, content.length);
            write(out, "\nendstream\nendobj\n");
        }
        int xref = out.size();
        int total = 6 + 2 * n;
        write(out, "xref\n0 " + total + "\n0000000000 65535 f \n");
        for (int off : offsets) write(out, String.format(Locale.ROOT, "%010d 00000 n \n", off));
        write(out, "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
        return out.toByteArray();
    }

    private static void obj(ByteArrayOutputStream out, List<Integer> offsets, int no, String body) {
        offsets.add(out.size());
        write(out, no + " 0 obj\n" + body + "\nendobj\n");
    }
    private static void write(ByteArrayOutputStream out, String s) {
        byte[] b = s.getBytes(StandardCharsets.ISO_8859_1);
        out.write(b, 0, b.length);
    }
}
