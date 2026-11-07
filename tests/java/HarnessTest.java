import com.bloomderma.api.dto.*;
import com.bloomderma.api.model.*;
import com.bloomderma.api.repository.*;
import com.bloomderma.api.security.CurrentUser;
import com.bloomderma.api.service.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.*;
import java.lang.reflect.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class HarnessTest {
    static int pass = 0, fail = 0;
    static void check(boolean ok, String name, String detail) {
        if (ok) pass++; else fail++;
        System.out.println((ok ? "  PASS  " : "  FAIL  ") + name + (detail.isEmpty() ? "" : "   -> " + detail));
    }
    static void check(boolean ok, String name) { check(ok, name, ""); }
    /** runs r, expects an exception of type t whose message contains sub */
    static void throwsMsg(Class<? extends Throwable> t, String sub, String name, Runnable r) {
        try { r.run(); check(false, name, "no exception thrown"); }
        catch (Throwable e) {
            boolean ok = t.isInstance(e) && (sub == null || String.valueOf(e.getMessage()).contains(sub));
            check(ok, name, ok ? "" : "got " + e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    // ---------- in-memory fakes ----------
    static final Map<Long, Appointment> DB = new LinkedHashMap<>();
    static final Map<String, User> USERS = new HashMap<>();
    static AppointmentRepository repo() {
        return (AppointmentRepository) Proxy.newProxyInstance(HarnessTest.class.getClassLoader(), new Class[]{AppointmentRepository.class}, (p, m, a) -> {
            switch (m.getName()) {
                case "findById": return Optional.ofNullable(DB.get((Long) a[0]));
                case "save": { Appointment x = (Appointment) a[0]; if (x.getId() == null) x.setId((long) DB.size() + 1); DB.put(x.getId(), x); return x; }
                case "findAll": return new ArrayList<>(DB.values());
                default: throw new UnsupportedOperationException(m.getName());
            }
        });
    }
    static Authentication auth(String user, String role) {
        return new Authentication() {
            public String getName() { return user; }
            public Collection<? extends GrantedAuthority> getAuthorities() { return List.of((GrantedAuthority) () -> "ROLE_" + role); }
        };
    }
    static Appointment appt(String patient, String doctor, int fee, String status, boolean video, LocalDate date, String slot) {
        Appointment a = new Appointment();
        a.setPatient(new Patient(patient, patient)); a.setDoctor(new Doctor(doctor, doctor));
        a.setFee(fee); a.setStatus(status); a.setConsultMode(video ? "VIDEO" : "IN_CLINIC");
        a.setDate(date); a.setTimeSlot(slot); a.setTreatment("Video Consultation"); a.setIssue("Acne");
        return repo().save(a);
    }
    static final DateTimeFormatter SLOT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    static String slot(LocalDateTime t) { return SLOT.format(t); }
    static PaymentRequest upi(String id) { return new PaymentRequest("UPI", id, null, null, null, null, null); }
    static PaymentRequest card(String no, String name, String exp, String cvv) { return new PaymentRequest("CARD", null, no, name, exp, cvv, null); }
    static PaymentRequest bank(String b) { return new PaymentRequest("NETBANKING", null, null, null, null, null, b); }

    public static void main(String[] args) throws Exception {
        String mode = args.length > 0 ? args[0] : "all";
        User up = new User(); up.username = "pat1"; up.role = "PATIENT"; up.patientId = "P1"; USERS.put("pat1", up);
        User up2 = new User(); up2.username = "pat2"; up2.role = "PATIENT"; up2.patientId = "P2"; USERS.put("pat2", up2);
        User ud = new User(); ud.username = "docA"; ud.role = "DOCTOR"; ud.doctorId = "D1"; USERS.put("docA", ud);
        User ud2 = new User(); ud2.username = "docB"; ud2.role = "DOCTOR"; ud2.doctorId = "D2"; USERS.put("docB", ud2);
        UserRepository ur = u -> Optional.ofNullable(USERS.get(u));
        CurrentUser cu = new CurrentUser(ur);
        AppointmentRepository ar = repo();
        PaymentService pay = new PaymentService(ar);
        VideoService video = new VideoService(ar, cu);
        Authentication P1 = auth("pat1", "PATIENT"), P2 = auth("pat2", "PATIENT"), DA = auth("docA", "DOCTOR"), DB2 = auth("docB", "DOCTOR"), REC = auth("rec", "RECEPTIONIST");
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        System.out.println("JVM zone=" + ZoneId.systemDefault() + "  now=" + now);

        if (mode.equals("tz")) {
            // booking for 2:30 AM on the IST calendar day, paid, tested at 02:00 IST (= 20:30 UTC the previous day)
            Appointment a = appt("P1", "D1", 500, "Confirmed", true, LocalDate.of(2026, 10, 29), "2:30 AM"); a.setPaid(true);
            try { video.join(a.getId(), P1); System.out.println("  TZ-RESULT  join allowed"); }
            catch (Exception e) { System.out.println("  TZ-RESULT  join REJECTED: " + e.getMessage()); }
            return;
        }

        System.out.println("\n[1] PAYMENT  (real PaymentService / Billing)");
        Appointment a1 = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(3)));
        AppointmentDto d = pay.pay(a1.getId(), "P1", upi("vedant@okaxis"));
        check(d.paid() && d.due() == 0 && d.amountPaid() == 500, "UPI payment marks the video appointment fully paid", "amountPaid=" + d.amountPaid() + " due=" + d.due());
        check("Confirmed".equals(d.status()), "status Pending -> Confirmed after payment", "status=" + d.status());
        check(d.paymentRef() != null && d.paymentRef().matches("TXN[0-9A-F]{10}"), "transaction id issued", d.paymentRef());
        check(d.paymentMethod().startsWith("UPI"), "payment method recorded", d.paymentMethod());
        throwsMsg(IllegalArgumentException.class, "already paid", "paying the same appointment twice is refused", () -> pay.pay(a1.getId(), "P1", upi("vedant@okaxis")));

        Appointment a2 = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(3)));
        String mmyy = String.format("%02d/%02d", LocalDate.now().getMonthValue(), (LocalDate.now().getYear() + 2) % 100);
        AppointmentDto d2 = pay.pay(a2.getId(), "P1", card("4111 1111 1111 1111", "Vedant Singh", mmyy, "123"));
        check(d2.paymentMethod().contains("xxxx 1111"), "card payment accepted; only last 4 digits kept", d2.paymentMethod());
        String stored = DB.get(a2.getId()).toString() + DB.get(a2.getId()).getPaymentMethod();
        check(!stored.contains("4111111111111111") && !stored.contains("4111 1111 1111 1111") && !stored.contains("123 "), "full card number / CVV not present in stored record");
        Appointment a3 = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(3)));
        check(pay.pay(a3.getId(), "P1", bank("HDFC")).paid(), "net banking payment accepted");

        Appointment b = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(3)));
        throwsMsg(IllegalArgumentException.class, "valid card", "card failing the Luhn check is rejected", () -> pay.pay(b.getId(), "P1", card("4111 1111 1111 1112", "V S", mmyy, "123")));
        throwsMsg(IllegalArgumentException.class, "expired", "expired card is rejected", () -> pay.pay(b.getId(), "P1", card("4111111111111111", "V S", "01/24", "123")));
        String lastMonth = String.format("%02d/%02d", LocalDate.now().minusMonths(1).getMonthValue(), LocalDate.now().minusMonths(1).getYear() % 100);
        throwsMsg(IllegalArgumentException.class, "expired", "card that expired last month is rejected", () -> pay.pay(b.getId(), "P1", card("4111111111111111", "V S", lastMonth, "123")));
        String thisMonth = String.format("%02d/%02d", LocalDate.now().getMonthValue(), LocalDate.now().getYear() % 100);
        check(tryPay(pay, b.getId(), card("4111111111111111", "V S", thisMonth, "123")) == null, "card expiring THIS month is still accepted (valid until month end)");
        Appointment b2 = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(3)));
        throwsMsg(IllegalArgumentException.class, "CVV", "bad CVV rejected", () -> pay.pay(b2.getId(), "P1", card("4111111111111111", "V S", mmyy, "12")));
        throwsMsg(IllegalArgumentException.class, "name on the card", "missing card holder name rejected", () -> pay.pay(b2.getId(), "P1", card("4111111111111111", " ", mmyy, "123")));
        throwsMsg(IllegalArgumentException.class, "UPI", "malformed UPI id rejected", () -> pay.pay(b2.getId(), "P1", upi("not-a-upi")));
        throwsMsg(IllegalArgumentException.class, "bank", "unknown bank rejected", () -> pay.pay(b2.getId(), "P1", bank("FakeBank")));
        throwsMsg(IllegalArgumentException.class, "payment method", "unknown method (e.g. WALLET) rejected", () -> pay.pay(b2.getId(), "P1", new PaymentRequest("WALLET", null, null, null, null, null, null)));
        check(!DB.get(b2.getId()).isPaid() && "Pending".equals(DB.get(b2.getId()).getStatus()), "failed attempts leave the appointment unpaid + Pending");

        Appointment c = appt("P2", "D1", 500, "Pending", true, today, slot(now.plusHours(3)));
        throwsMsg(com.bloomderma.api.exception.ResourceNotFoundException.class, "not found", "patient cannot pay someone else's appointment", () -> pay.pay(c.getId(), "P1", upi("a.b@okbank")));
        Appointment cx = appt("P1", "D1", 500, "Cancelled", true, today, slot(now.plusHours(3)));
        throwsMsg(IllegalArgumentException.class, "cancelled", "cancelled appointment cannot be paid", () -> pay.pay(cx.getId(), "P1", upi("a.b@okbank")));
        Appointment part = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(3))); part.setAmountPaid(200);
        AppointmentDto dp = pay.pay(part.getId(), "P1", upi("a.b@okbank"));
        check(dp.paid() && dp.amountPaid() == 500 && dp.due() == 0, "part-paid (front desk Rs.200) appointment settles to the full Rs.500", "amountPaid=" + dp.amountPaid());
        Appointment free = appt("P1", "D1", 0, "Pending", true, today, slot(now.plusHours(3)));
        String freeOutcome; try { pay.pay(free.getId(), "P1", upi("a.b@okbank")); freeOutcome = "paid"; } catch (Exception e) { freeOutcome = e.getMessage(); }
        System.out.println("  NOTE   Rs.0 video fee (doctor.videoFee = 0): pay() -> \"" + freeOutcome + "\"; status stays \"" + free.getStatus() + "\"");

        System.out.println("\n[2] WHO MAY JOIN THE CALL  (real VideoService.authorize / join)");
        Appointment unpaid = appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(1)));
        throwsMsg(IllegalArgumentException.class, "not been paid", "UNPAID video consult: patient is blocked", () -> video.join(unpaid.getId(), P1));
        throwsMsg(IllegalArgumentException.class, "not been paid", "UNPAID video consult: doctor is blocked", () -> video.join(unpaid.getId(), DA));
        pay.pay(unpaid.getId(), "P1", upi("a.b@okbank"));
        check("patient".equals(video.join(unpaid.getId(), P1).get("role")), "after payment: patient can join (role=patient)");
        check("doctor".equals(video.join(unpaid.getId(), DA).get("role")), "after payment: the booked doctor can join (role=doctor)");
        throwsMsg(AccessDeniedException.class, "not your", "a different patient cannot join", () -> video.join(unpaid.getId(), P2));
        throwsMsg(AccessDeniedException.class, "not your", "a different doctor cannot join", () -> video.join(unpaid.getId(), DB2));
        throwsMsg(AccessDeniedException.class, "not your", "receptionist/admin role cannot enter the room", () -> video.join(unpaid.getId(), REC));
        Appointment clinic = appt("P1", "D1", 1000, "Confirmed", false, today, slot(now.plusHours(1))); clinic.setPaid(true);
        throwsMsg(IllegalArgumentException.class, "not a video", "in-clinic appointment has no video room", () -> video.join(clinic.getId(), P1));
        Appointment canc = appt("P1", "D1", 500, "Cancelled", true, today, slot(now.plusHours(1))); canc.setPaid(true);
        throwsMsg(IllegalArgumentException.class, "cancelled", "cancelled consultation cannot be joined", () -> video.join(canc.getId(), P1));
        Appointment tomorrow = appt("P1", "D1", 500, "Confirmed", true, today.plusDays(1), "10:00 AM"); tomorrow.setPaid(true);
        throwsMsg(IllegalArgumentException.class, "day of the consultation", "tomorrow's consultation cannot be joined today", () -> video.join(tomorrow.getId(), P1));
        Appointment yest = appt("P1", "D1", 500, "Confirmed", true, today.minusDays(1), "10:00 AM"); yest.setPaid(true);
        throwsMsg(IllegalArgumentException.class, "day of the consultation", "yesterday's consultation cannot be joined", () -> video.join(yest.getId(), P1));
        Appointment late = appt("P1", "D1", 500, "Confirmed", true, today, slot(now.minusHours(2))); late.setPaid(true);
        throwsMsg(IllegalArgumentException.class, "join window", "joining 2h after the slot is refused (1h window)", () -> video.join(late.getId(), P1));
        Appointment grace = appt("P1", "D1", 500, "Confirmed", true, today, slot(now.minusMinutes(30))); grace.setPaid(true);
        check(video.join(grace.getId(), P1) != null, "joining 30 min after the slot is allowed");
        Appointment early = appt("P1", "D1", 500, "Confirmed", true, today, slot(now.plusHours(6))); early.setPaid(true);
        String earlyOut; try { video.join(early.getId(), P1); earlyOut = "ALLOWED"; } catch (Exception e) { earlyOut = "refused"; }
        System.out.println("  NOTE   joining 6 hours BEFORE the booked slot (same day): " + earlyOut);

        System.out.println("\n[3] SIGNALLING RELAY  (real VideoService.send / poll)");
        Appointment room = appt("P1", "D1", 500, "Confirmed", true, today, slot(now.plusMinutes(10))); room.setPaid(true);
        Appointment room2 = appt("P2", "D1", 500, "Confirmed", true, today, slot(now.plusMinutes(10))); room2.setPaid(true);
        video.send(room.getId(), "ready", "", DA);                      // doctor announces BEFORE the patient joined
        long cp = (long) video.join(room.getId(), P1).get("cursor");
        long cd = (long) video.join(room.getId(), DA).get("cursor");
        Map<String, Object> r0 = video.poll(room.getId(), cp, P1);
        check(((List<?>) r0.get("signals")).isEmpty(), "signals sent before a participant joined are NOT replayed (design relies on 'ready' pings)");
        video.send(room.getId(), "ready", "", P1);
        Map<String, Object> rd = video.poll(room.getId(), cd, DA);
        List<Map<String, Object>> sd = (List<Map<String, Object>>) rd.get("signals");
        check(sd.size() == 1 && "ready".equals(sd.get(0).get("type")) && "patient".equals(sd.get(0).get("from")), "doctor receives the patient's 'ready'");
        check(((List<?>) video.poll(room.getId(), cp, P1).get("signals")).isEmpty(), "sender never receives its own signals");
        video.send(room.getId(), "offer", "{\"sdp\":\"x\"}", DA);
        video.send(room.getId(), "ice", "{\"c\":1}", DA);
        List<Map<String, Object>> sp = (List<Map<String, Object>>) video.poll(room.getId(), cp, P1).get("signals");
        check(sp.size() == 2 && "offer".equals(sp.get(0).get("type")) && "ice".equals(sp.get(1).get("type")), "patient gets offer then ice, in order");
        long cur = (long) video.poll(room.getId(), cp, P1).get("cursor");
        check(((List<?>) video.poll(room.getId(), cur, P1).get("signals")).isEmpty(), "advancing the cursor does not redeliver old signals");
        video.send(room2.getId(), "offer", "{}", DA);
        check(((List<?>) video.poll(room.getId(), cur, P1).get("signals")).isEmpty(), "rooms are isolated from each other");
        throwsMsg(IllegalArgumentException.class, "Unknown signal", "unknown signal type refused", () -> video.send(room.getId(), "hack", "x", P1));
        throwsMsg(IllegalArgumentException.class, "not been paid", "signalling on an unpaid consultation refused", () -> video.send(appt("P1", "D1", 500, "Pending", true, today, slot(now.plusHours(1))).getId(), "ready", "", P1));
        for (int i = 0; i < 500; i++) video.send(room.getId(), "ice", "{}", DA);
        int backlog = ((List<?>) video.poll(room.getId(), 0, P1).get("signals")).size();
        check(backlog <= 400, "per-room backlog capped at 400 signals", "backlog=" + backlog);

        System.out.println("\n===== " + pass + " passed, " + fail + " failed =====");
        System.exit(fail == 0 ? 0 : 1);
    }
    static String tryPay(PaymentService p, Long id, PaymentRequest r) { try { p.pay(id, "P1", r); return null; } catch (Exception e) { return e.getMessage(); } }
}
