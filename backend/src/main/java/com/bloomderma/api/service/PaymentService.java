package com.bloomderma.api.service;

import com.bloomderma.api.dto.AppointmentDto;
import com.bloomderma.api.dto.PaymentRequest;
import com.bloomderma.api.exception.ResourceNotFoundException;
import com.bloomderma.api.model.Appointment;
import com.bloomderma.api.repository.AppointmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Online payment of a video consultation by the logged-in patient.
 * The amount is ALWAYS the server-side fee of the appointment (never sent by the browser).
 * This is a built-in demo gateway: it validates the payment details and issues a transaction reference.
 * To use a real gateway (Razorpay, Stripe ...), replace {@link #charge} - nothing else needs to change.
 */
@Service
public class PaymentService {
    private static final Set<String> METHODS = Set.of("UPI", "CARD", "NETBANKING");
    private static final Set<String> BANKS = Set.of("SBI", "HDFC", "ICICI", "Axis", "Kotak", "Bank of Baroda", "PNB", "Other");
    private static final Pattern UPI = Pattern.compile("^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$");
    private static final Pattern EXPIRY = Pattern.compile("^(0[1-9]|1[0-2])/(\\d{2})$");

    private final AppointmentRepository appointments;
    public PaymentService(AppointmentRepository appointments) { this.appointments = appointments; }

    @Transactional
    public AppointmentDto pay(Long id, String patientId, PaymentRequest r) {
        Appointment a = appointments.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment " + id + " not found"));
        if (!a.getPatient().getId().equals(patientId)) throw new ResourceNotFoundException("Appointment " + id + " not found");
        if ("Cancelled".equals(a.getStatus())) throw new IllegalArgumentException("This appointment was cancelled.");
        if ("Completed".equals(a.getStatus())) throw new IllegalArgumentException("This appointment is already completed.");
        int due = Billing.due(a);
        if (due <= 0) throw new IllegalArgumentException("This appointment is already paid.");

        String method = r.method() == null ? "" : r.method().trim().toUpperCase();
        if (!METHODS.contains(method)) throw new IllegalArgumentException("Choose a payment method: UPI, Card or Net Banking.");
        String detail = validate(method, r);

        String ref = charge(method, due);
        a.setAmountPaid(Billing.fee(a)); a.setPaid(true);
        a.setPaymentMethod(method + (detail.isEmpty() ? "" : " (" + detail + ")"));
        a.setPaymentRef(ref); a.setPaidAt(LocalDateTime.now());
        if ("Pending".equals(a.getStatus())) a.setStatus("Confirmed");     // slot is confirmed once it is paid for
        return AppointmentDto.from(appointments.save(a));
    }

    /** Validates the details and returns a safe, non-sensitive description (UPI id / last 4 digits / bank). */
    private String validate(String method, PaymentRequest r) {
        switch (method) {
            case "UPI": {
                String u = r.upiId() == null ? "" : r.upiId().trim();
                if (!UPI.matcher(u).matches()) throw new IllegalArgumentException("Enter a valid UPI ID, e.g. name@okbank.");
                return u;
            }
            case "CARD": {
                String n = r.cardNumber() == null ? "" : r.cardNumber().replaceAll("[\\s-]", "");
                if (!n.matches("\\d{13,19}") || !luhn(n)) throw new IllegalArgumentException("Enter a valid card number.");
                if (r.cardName() == null || r.cardName().isBlank()) throw new IllegalArgumentException("Enter the name on the card.");
                var m = EXPIRY.matcher(r.expiry() == null ? "" : r.expiry().trim());
                if (!m.matches()) throw new IllegalArgumentException("Enter the expiry date as MM/YY.");
                LocalDate end = LocalDate.of(2000 + Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)), 1).plusMonths(1);
                if (!end.isAfter(LocalDate.now())) throw new IllegalArgumentException("This card has expired.");
                if (r.cvv() == null || !r.cvv().matches("\\d{3,4}")) throw new IllegalArgumentException("Enter the 3 or 4 digit CVV.");
                return "xxxx " + n.substring(n.length() - 4);
            }
            default: {
                String b = r.bank() == null ? "" : r.bank().trim();
                if (!BANKS.contains(b)) throw new IllegalArgumentException("Choose your bank.");
                return b;
            }
        }
    }

    /** Demo gateway: always approves valid details. Swap with a real gateway call here. */
    private String charge(String method, int amount) {
        return "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }

    private static boolean luhn(String n) {
        int sum = 0; boolean alt = false;
        for (int i = n.length() - 1; i >= 0; i--) {
            int d = n.charAt(i) - '0';
            if (alt) { d *= 2; if (d > 9) d -= 9; }
            sum += d; alt = !alt;
        }
        return sum % 10 == 0;
    }
}
