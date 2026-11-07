-- MODULE IV demo script (Hibernate creates these tables automatically; use this to show raw SQL in viva)
CREATE DATABASE IF NOT EXISTS derma_clinic_db;
USE derma_clinic_db;

-- Sample queries to run after the app has started once:
SELECT * FROM patients ORDER BY name;                                   -- SELECT + ORDER BY
SELECT * FROM appointments WHERE status = 'Confirmed';                  -- WHERE
SELECT d.name AS doctor, COUNT(*) AS visits, SUM(a.fee) AS billed       -- JOIN + GROUP BY
  FROM appointments a JOIN doctors d ON a.doctor_id = d.id
 WHERE a.status <> 'Cancelled' GROUP BY d.name ORDER BY billed DESC;
SELECT p.name, a.treatment, a.date, a.fee                               -- 3-table relationship
  FROM appointments a JOIN patients p ON a.patient_id = p.id ORDER BY a.date DESC LIMIT 10;
UPDATE appointments SET paid = TRUE WHERE id = 1;                       -- UPDATE
-- DELETE FROM appointments WHERE id = 99;                              -- DELETE

-- Role/doctor account checks (new): each doctor login is linked to exactly one doctor record
SELECT u.username AS doctor_id, u.role, d.name, d.specialty FROM users u JOIN doctors d ON d.id = u.doctor_id;
SELECT d.name AS doctor, SUM(a.fee) AS own_revenue FROM appointments a JOIN doctors d ON a.doctor_id = d.id
 WHERE a.status <> 'Cancelled' GROUP BY d.name;                          -- what each doctor may see: only their own row

-- Patient portal (new): accounts, part payments, video consultations
SELECT u.username, u.role, p.id AS patient_id, p.name FROM users u JOIN patients p ON p.id = u.patient_id;
SELECT id, fee, amount_paid, paid, (fee - IF(paid, fee, COALESCE(amount_paid, 0))) AS due, consult_mode FROM appointments;
SELECT * FROM reports;        -- file metadata (files are in backend/uploads/)
SELECT * FROM recovery_logs;  -- patient recovery check-ins

-- Doctor-generated reports are rows in `reports` with created_by = the doctor's name (NULL = uploaded by the patient)
SELECT patient_id, title, created_by, uploaded_at FROM reports ORDER BY uploaded_at DESC;

-- Before / after photos and public reviews (new)
SELECT id, patient_id, caption, before_on, after_on FROM photo_sets;        -- files are in backend/uploads/
SELECT r.id, r.rating, r.anonymous, r.doctor_id, LEFT(r.text, 40) AS text FROM reviews r ORDER BY r.created_at DESC;

-- Online payment of video consultations (new columns are created automatically by Hibernate)
SELECT id, consult_mode, fee, paid, payment_method, payment_ref, paid_at FROM appointments WHERE consult_mode = 'VIDEO';
