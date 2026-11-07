package com.bloomderma.api.model;
import java.time.*;
public class Appointment {
  private Long id; private Patient patient; private Doctor doctor; private String issue, treatment; private LocalDate date; private String timeSlot;
  private Integer fee; private String status; private boolean paid; private Integer amountPaid; private String consultMode, paymentMethod, paymentRef; private LocalDateTime paidAt; private String notes;
  public Long getId(){return id;} public void setId(Long v){id=v;} public Patient getPatient(){return patient;} public void setPatient(Patient v){patient=v;}
  public Doctor getDoctor(){return doctor;} public void setDoctor(Doctor v){doctor=v;} public String getIssue(){return issue;} public void setIssue(String v){issue=v;}
  public String getTreatment(){return treatment;} public void setTreatment(String v){treatment=v;} public LocalDate getDate(){return date;} public void setDate(LocalDate v){date=v;}
  public String getTimeSlot(){return timeSlot;} public void setTimeSlot(String v){timeSlot=v;} public Integer getFee(){return fee;} public void setFee(Integer v){fee=v;}
  public String getStatus(){return status;} public void setStatus(String v){status=v;} public boolean isPaid(){return paid;} public void setPaid(boolean v){paid=v;}
  public Integer getAmountPaid(){return amountPaid;} public void setAmountPaid(Integer v){amountPaid=v;} public String getConsultMode(){return consultMode;} public void setConsultMode(String v){consultMode=v;}
  public String getPaymentMethod(){return paymentMethod;} public void setPaymentMethod(String v){paymentMethod=v;} public String getPaymentRef(){return paymentRef;} public void setPaymentRef(String v){paymentRef=v;}
  public LocalDateTime getPaidAt(){return paidAt;} public void setPaidAt(LocalDateTime v){paidAt=v;} public String getNotes(){return notes;} public void setNotes(String v){notes=v;}
  public String toString(){ return "Appt[" + id + "," + status + ",paid=" + paid + ",amt=" + amountPaid + "," + paymentMethod + "," + paymentRef + "]"; }
}
