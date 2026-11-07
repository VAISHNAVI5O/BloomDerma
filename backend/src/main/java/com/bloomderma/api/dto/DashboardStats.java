package com.bloomderma.api.dto;

/** Fields are null (plus a note) when the owning module is disabled — the dashboard never crashes. */
public record DashboardStats(Long totalPatients, Long totalDoctors, Long todaysAppointments,
                             Long todaysRevenue, String appointmentsNote, String revenueNote, String doctorsNote) { }
