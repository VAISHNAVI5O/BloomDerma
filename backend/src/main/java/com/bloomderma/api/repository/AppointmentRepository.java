package com.bloomderma.api.repository;

import com.bloomderma.api.model.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    // Derived query: WHERE doctor_id=? AND date=? AND time_slot=? AND status<>?
    List<Appointment> findByDoctorIdAndDateAndTimeSlotAndStatusNot(String doctorId, LocalDate date, String slot, String status);
    List<Appointment> findByDoctorId(String doctorId);
    List<Appointment> findByPatientId(String patientId);
    List<Appointment> findByDateAndStatusNot(LocalDate date, String status);
}
