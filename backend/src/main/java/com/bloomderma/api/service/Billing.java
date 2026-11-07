package com.bloomderma.api.service;

import com.bloomderma.api.model.Appointment;

/** Single place that decides how much of an appointment's fee has been paid. */
public final class Billing {
    private Billing() { }

    public static int fee(Appointment a) { return a.getFee() == null ? 0 : a.getFee(); }

    /** Amount received so far. Old rows (paid=true, no amount recorded) count as fully paid. */
    public static int paid(Appointment a) {
        int fee = fee(a);
        if (a.isPaid()) return fee;
        int part = a.getAmountPaid() == null ? 0 : a.getAmountPaid();
        return Math.max(0, Math.min(part, fee));
    }

    public static int due(Appointment a) { return fee(a) - paid(a); }

    /** "Paid" | "Partial" | "Due" */
    public static String state(Appointment a) {
        if (due(a) == 0) return "Paid";
        return paid(a) > 0 ? "Partial" : "Due";
    }
}
