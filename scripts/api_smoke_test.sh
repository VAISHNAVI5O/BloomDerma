#!/usr/bin/env bash
# Role/security checks against a RUNNING backend (http://localhost:8080). Needs curl + python3.
B=${BASE:-http://localhost:8080/api}; pass=0; fail=0
chk(){ if [ "$2" = "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (got $2, want $3)"; fail=$((fail+1)); fi; }
login(){ curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\",\"loginType\":\"$3\"}"; }
tok(){ python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
j(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

A=$(login admin admin123 STAFF | tok); R=$(login receptionist reception123 STAFF | tok)
D1=$(login ananya doctor123 DOCTOR | tok); D2=$(login riya doctor123 DOCTOR | tok)
chk "admin login on staff screen" "$([ -n "$A" ] && echo ok)" ok
chk "doctor login on doctor screen" "$([ -n "$D1" ] && echo ok)" ok
chk "doctor refused on Admin/Receptionist screen" "$(login ananya doctor123 STAFF | tok)" ""
chk "admin refused on Doctor screen" "$(login admin admin123 DOCTOR | tok)" ""
chk "wrong password refused" "$(login ananya nope DOCTOR | tok)" ""

APPT='{"patientId":"SK001","patientName":"Api Test","age":30,"gender":"Female","issue":"Acne","doctorId":"doc1","treatment":"Acne Consultation","date":"2099-01-01","time":"09:00 AM","fee":500}'
chk "DOCTOR POST /appointments -> 403" "$(code -X POST $B/appointments -H "Authorization: Bearer $D1" -H 'Content-Type: application/json' -d "$APPT")" 403
chk "DOCTOR PUT /appointments/1 -> 403" "$(code -X PUT $B/appointments/1 -H "Authorization: Bearer $D1" -H 'Content-Type: application/json' -d "$APPT")" 403
chk "DOCTOR POST /doctors -> 403" "$(code -X POST $B/doctors -H "Authorization: Bearer $D1" -H 'Content-Type: application/json' -d '{}')" 403
chk "no token -> 401" "$(code $B/patients/history)" 401
chk "RECEPTIONIST POST /doctors -> 403" "$(code -X POST $B/doctors -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d '{}')" 403

NEW="{\"name\":\"test doctor\",\"id\":\"testdoc$RANDOM\",\"password\":\"Test@1234\",\"specialty\":\"Dermatology\"}"
ID=$(echo "$NEW" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
chk "ADMIN creates doctor -> 201" "$(code -X POST $B/doctors -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d "$NEW")" 201
chk "duplicate Doctor ID -> 409" "$(code -X POST $B/doctors -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d "$NEW")" 409
chk "new doctor can log in" "$([ -n "$(login $ID Test@1234 DOCTOR | tok)" ] && echo ok)" ok

SUG=$(curl -s "$B/doctors/suggestions?concern=Hair%20Fall" -H "Authorization: Bearer $R")
chk "Hair Fall -> Trichology doctor suggested" "$(echo "$SUG" | j "'Dr. Kavya Iyer' in [x['name'] for x in d['doctors']]")" True
chk "Hair Fall -> only hair specialists" "$(echo "$SUG" | j "all('Hair' in x['specialty'] or 'Trichology' in x['specialty'] for x in d['doctors'])")" True

BOOK=$(curl -s -X POST $B/appointments -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d "${APPT/2099-01-01/2099-01-02}")
chk "receptionist books appointment (new booking is Due)" "$(echo "$BOOK" | j "d['paid']")" False
AID=$(echo "$BOOK" | j "d['id']")
chk "DOCTOR cannot mark payment -> 403" "$(code -X PATCH "$B/appointments/$AID/payment?paid=true" -H "Authorization: Bearer $D1")" 403
chk "receptionist marks payment received" "$(curl -s -X PATCH "$B/appointments/$AID/payment?paid=true" -H "Authorization: Bearer $R" | j "d['paid']")" True
chk "receptionist can set it back to due" "$(curl -s -X PATCH "$B/appointments/$AID/payment?paid=false" -H "Authorization: Bearer $R" | j "d['paid']")" False
chk "speciality list is public (login-page Add Doctor)" "$(code $B/doctors/specialities)" 200
chk "admin sees doctor login IDs" "$(curl -s $B/doctors -H "Authorization: Bearer $A" | j "'ananya' in [x['loginId'] for x in d]")" True
chk "doctor sees only own appointments" "$(curl -s $B/appointments -H "Authorization: Bearer $D1" | j "all(a['doctorId']=='doc1' for a in d)")" True
HP=$(curl -s $B/patients/history -H "Authorization: Bearer $D1")
chk "doctor history: patients of ALL doctors" "$(echo "$HP" | j "len({v['doctorId'] for p in d for v in p['visits']})>1")" True
chk "doctor history: no fee/paid leaked" "$(echo "$HP" | j "all(v['fee'] is None and v['paid'] is None for p in d for v in p['visits'])")" True
chk "receptionist history has billing" "$(curl -s $B/patients/history -H "Authorization: Bearer $R" | j "any(v['fee'] is not None for p in d for v in p['visits'])")" True
chk "doc1 revenue scoped to doc1" "$(curl -s $B/revenue -H "Authorization: Bearer $D1" | j "d['doctorId']=='doc1' and list(d['byDoctor'])==['Dr. Ananya Sharma'] and len(d['monthly'])==12")" True
chk "doc2 revenue scoped to doc2" "$(curl -s $B/revenue -H "Authorization: Bearer $D2" | j "d['doctorId']=='doc2' and list(d['byDoctor'])==['Dr. Riya Mehta']")" True
chk "receptionist revenue has no doctor breakdown" "$(curl -s $B/revenue -H "Authorization: Bearer $R" | j "'byDoctor' not in d")" True
chk "doctors list has no contact for receptionist" "$(curl -s $B/doctors -H "Authorization: Bearer $R" | j "all(x['phone'] is None and x['email'] is None for x in d)")" True

# ---------------- patient portal ----------------
P=$(login patient1 patient123 PATIENT | tok)
chk "patient logs in on the Patient screen" "$([ -n "$P" ] && echo ok)" ok
chk "patient refused on Admin/Receptionist screen" "$(login patient1 patient123 STAFF | tok)" ""
chk "admin refused on Patient screen" "$(login admin admin123 PATIENT | tok)" ""
for path in patients patients/history appointments revenue dashboard/stats; do
  chk "patient blocked from /api/$path -> 403" "$(code $B/$path -H "Authorization: Bearer $P")" 403
done
chk "patient cannot book via staff endpoint -> 403" "$(code -X POST $B/appointments -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d "$APPT")" 403
chk "patient cannot record payment -> 403" "$(code -X PATCH "$B/appointments/1/payment?paid=true" -H "Authorization: Bearer $P")" 403
chk "staff token blocked from /api/portal -> 403" "$(code $B/portal/me -H "Authorization: Bearer $R")" 403
chk "patient sees own profile" "$(curl -s $B/portal/me -H "Authorization: Bearer $P" | j "d['id']")" SK001
chk "patient sees no doctor contact/login" "$(curl -s $B/doctors -H "Authorization: Bearer $P" | j "all(x['loginId'] is None and x['phone'] is None for x in d)")" True

TODAY=$(date +%F)
# pick a free slot of Dr. Ananya today (so the script can be re-run)
SLOT=$(curl -s "$B/portal/availability?doctorId=doc1&date=$TODAY" -H "Authorization: Bearer $P" | python3 -c "
import sys,json
booked=json.load(sys.stdin)
slots=['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM']
print(next((s for s in slots if s not in booked),'12:30 PM'))")
VID=$(curl -s -X POST $B/portal/appointments -H "Authorization: Bearer $P" -H 'Content-Type: application/json' \
  -d "{\"doctorId\":\"doc1\",\"concern\":\"Acne\",\"date\":\"$TODAY\",\"time\":\"$SLOT\",\"video\":true,\"fee\":1}")
chk "patient books video consultation" "$(echo "$VID" | j "d['mode']")" VIDEO
chk "video fee is set by the server (client fee ignored)" "$(echo "$VID" | j "d['fee']>1")" True
VID_ID=$(echo "$VID" | j "d['id']")
chk "same slot cannot be booked twice -> 409" "$(code -X POST $B/portal/appointments -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d "{\"doctorId\":\"doc1\",\"concern\":\"Acne\",\"date\":\"$TODAY\",\"time\":\"$SLOT\",\"video\":true}")" 409
chk "patient bills include it as Due" "$(curl -s $B/portal/bills -H "Authorization: Bearer $P" | j "any(b['id']==$VID_ID and b['paymentState']=='Due' for b in d['bills'])")" True

# partial payment by the front desk
FEE=$(echo "$VID" | j "d['fee']")
PART=$((FEE/2))
chk "front desk records PART payment" "$(curl -s -X PATCH "$B/appointments/$VID_ID/payment?amount=$PART" -H "Authorization: Bearer $R" | j "d['amountPaid']==$PART and d['due']==$FEE-$PART and not d['paid']")" True
chk "patient sees Partial + due amount" "$(curl -s $B/portal/bills -H "Authorization: Bearer $P" | j "any(b['id']==$VID_ID and b['paymentState']=='Partial' and b['due']==$FEE-$PART for b in d['bills'])")" True
chk "amount above the bill rejected -> 400" "$(code -X PATCH "$B/appointments/$VID_ID/payment?amount=$((FEE+1))" -H "Authorization: Bearer $R")" 400
chk "front desk marks paid in full" "$(curl -s -X PATCH "$B/appointments/$VID_ID/payment?paid=true" -H "Authorization: Bearer $R" | j "d['paid'] and d['due']==0")" True

# video call signalling
DJ=$(login ananya doctor123 DOCTOR | tok)
chk "doctor joins own video room" "$(curl -s -X POST $B/video/$VID_ID/join -H "Authorization: Bearer $DJ" | j "d['role']")" doctor
chk "patient joins the room" "$(curl -s -X POST $B/video/$VID_ID/join -H "Authorization: Bearer $P" | j "d['role']")" patient
chk "other doctor cannot join -> 403" "$(code -X POST $B/video/$VID_ID/join -H "Authorization: Bearer $D2")" 403
chk "receptionist cannot join -> 403" "$(code -X POST $B/video/$VID_ID/join -H "Authorization: Bearer $R")" 403
curl -s -o /dev/null -X POST $B/video/$VID_ID/signal -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"type":"ready","payload":""}'
chk "doctor receives patient's signal" "$(curl -s "$B/video/$VID_ID/signal?since=0" -H "Authorization: Bearer $DJ" | j "any(s['type']=='ready' for s in d['signals'])")" True

# reports (tiny valid PNG) and recovery
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00' > /tmp/bd_test.png
RID=$(curl -s -X POST $B/portal/reports -H "Authorization: Bearer $P" -F "file=@/tmp/bd_test.png" -F "title=Smoke test" | j "d['id']")
chk "patient uploads a report" "$([ -n "$RID" ] && echo ok)" ok
printf '<script>alert(1)</script>_______' > /tmp/bd_fake.png
chk "fake image (HTML in .png) rejected -> 400" "$(code -X POST $B/portal/reports -H "Authorization: Bearer $P" -F "file=@/tmp/bd_fake.png")" 400
chk "doctor can read patient's report list" "$(curl -s $B/patients/SK001/reports -H "Authorization: Bearer $DJ" | j "any(r['id']==$RID for r in d)")" True
chk "doctor can open the report file" "$(code $B/patients/SK001/reports/$RID/file -H "Authorization: Bearer $DJ")" 200
curl -s -o /dev/null -X DELETE $B/portal/reports/$RID -H "Authorization: Bearer $P"
chk "patient adds recovery check-in" "$(curl -s -X POST $B/portal/recovery -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"score":7,"symptoms":"less redness"}' | j "d['score']")" 7
chk "doctor sees recovery check-ins" "$(curl -s $B/patients/SK001/recovery -H "Authorization: Bearer $DJ" | j "len(d)>=1")" True
chk "score above 10 rejected -> 400" "$(code -X POST $B/portal/recovery -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"score":11}')" 400

# self-registration
U="newpat$RANDOM"
chk "patient self-registers -> 201" "$(code -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"phone\":\"9876543210\",\"name\":\"New Patient\",\"age\":30,\"gender\":\"Female\",\"username\":\"$U\",\"password\":\"Secret@123\"}")" 201
chk "new patient can log in" "$([ -n "$(login $U Secret@123 PATIENT | tok)" ] && echo ok)" ok
chk "duplicate username -> 409" "$(code -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"phone\":\"9876543210\",\"name\":\"X\",\"age\":30,\"username\":\"$U\",\"password\":\"Secret@123\"}")" 409

# ---------------- patient IDs ----------------
NEWP=$(curl -s -X POST $B/appointments -H "Authorization: Bearer $R" -H 'Content-Type: application/json' \
  -d '{"patientId":"","patientName":"Blank Id Test","age":31,"gender":"Female","issue":"Acne","doctorId":"doc2","treatment":"Skin Consultation","date":"2099-02-01","time":"","fee":500}')
chk "blank Patient ID -> new patient gets a system-assigned SK### ID" "$(echo "$NEWP" | j "bool(__import__('re').fullmatch(r'SK[0-9]{3}', d['patientId']))")" True
chk "unknown Patient ID -> 400 (no accidental new patients)" "$(code -X POST $B/appointments -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d "${APPT/SK001/ZZ-NOPE}")" 400
chk "self-registered patient gets a system-assigned SK### ID (an ID typed by the patient is ignored)" "$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"patientId\":\"id$RANDOM\",\"phone\":\"9876543210\",\"name\":\"Id Test\",\"age\":30,\"username\":\"idt$RANDOM\",\"password\":\"Secret@123\"}" | j "bool(__import__('re').fullmatch(r'SK[0-9]{3}', d['patientId']))")" True
REG='{"phone":"9876543210","name":"R","age":30,"username":"rule1","password":"Secret@123"}'
chk "9-digit phone -> 400" "$(code -X POST $B/auth/register -H 'Content-Type: application/json' -d "${REG/9876543210/987654321}")" 400
chk "password without special character -> 400" "$(code -X POST $B/auth/register -H 'Content-Type: application/json' -d "${REG/Secret@123/Secret1234}")" 400
chk "all-lowercase password -> 400" "$(code -X POST $B/auth/register -H 'Content-Type: application/json' -d "${REG/Secret@123/secret@123}")" 400

# ---------------- no bookings in the past ----------------
chk "booking a past DATE -> 400" "$(code -X POST $B/appointments -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d "${APPT/2099-01-01/2020-01-01}")" 400
PASTTIME=$(echo "${APPT/2099-01-01/$(date +%F)}" | sed 's/09:00 AM/12:00 AM/')       # 12:00 AM today is always already over
chk "booking a time that has passed today -> 400" "$(code -X POST $B/appointments -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d "$PASTTIME")" 400
chk "patient portal: booking a past date -> 400" "$(code -X POST $B/portal/appointments -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"doctorId":"doc1","concern":"Acne","date":"2020-01-01","time":"09:00 AM","video":false}')" 400

# ---------------- revisit suggestions (a notice only - the patient decides) ----------------
chk "receptionist cannot suggest a revisit -> 403" "$(code -X POST $B/patients/SK001/revisits -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d '{"date":"2099-01-01"}')" 403
chk "doctor cannot suggest a revisit for a past date -> 400" "$(code -X POST $B/patients/SK001/revisits -H "Authorization: Bearer $DJ" -H 'Content-Type: application/json' -d '{"date":"2020-01-01"}')" 400
RV=$(curl -s -X POST $B/patients/SK001/revisits -H "Authorization: Bearer $DJ" -H 'Content-Type: application/json' -d '{"date":"2099-01-01","note":"Review after a month"}')
chk "doctor suggests a revisit -> ACTIVE" "$(echo "$RV" | j "d['status']")" ACTIVE
chk "patient sees the revisit notice" "$(curl -s $B/portal/revisits -H "Authorization: Bearer $P" | j "any(x['id']==$(echo "$RV" | j "d['id']") for x in d)")" True
chk "patient can dismiss it (their choice)" "$(code -X POST $B/portal/revisits/$(echo "$RV" | j "d['id']")/dismiss -H "Authorization: Bearer $P")" 204
chk "dismissed notice is gone" "$(curl -s $B/portal/revisits -H "Authorization: Bearer $P" | j "all(x['id']!=$(echo "$RV" | j "d['id']") for x in d)")" True

# ---------------- doctor-generated reports (AI draft -> PDF on the patient's account) ----------------
DRAFT=$(curl -s -X POST $B/patients/SK001/reports/draft -H "Authorization: Bearer $DJ" -H 'Content-Type: application/json' \
  -d '{"keywords":"acne on cheeks, oily skin","prescription":"Tab Doxycycline 100 mg twice daily\nAdapalene gel at night"}')
chk "doctor gets an editable report draft" "$(echo "$DRAFT" | j "'## Presenting Complaints' in d['text']")" True
chk "prescription is copied verbatim into the draft" "$(echo "$DRAFT" | j "'- Tab Doxycycline 100 mg twice daily' in d['text'] and '- Adapalene gel at night' in d['text']")" True
chk "receptionist cannot create reports -> 403" "$(code -X POST $B/patients/SK001/reports/draft -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d '{"keywords":"x","prescription":"y"}')" 403
chk "patient cannot create reports -> 403" "$(code -X POST $B/patients/SK001/reports/generated -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"text":"x"}')" 403
TEXT=$(echo "$DRAFT" | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)['text']))")
GEN=$(curl -s -X POST $B/patients/SK001/reports/generated -H "Authorization: Bearer $DJ" -H 'Content-Type: application/json' -d "{\"text\":$TEXT}")
chk "doctor saves the report -> stored as Prepared by the doctor" "$(echo "$GEN" | j "d['createdBy']=='Dr. Ananya Sharma' and d['contentType']=='application/pdf'")" True
GID=$(echo "$GEN" | j "d['id']")
curl -s $B/portal/reports/$GID/file -H "Authorization: Bearer $P" -o /tmp/bd_generated.pdf
chk "patient can download the report - it is a real PDF" "$(head -c 4 /tmp/bd_generated.pdf)" "%PDF"
chk "patient cannot delete a doctor's report -> 403" "$(code -X DELETE $B/portal/reports/$GID -H "Authorization: Bearer $P")" 403
chk "report appears in the patient's list" "$(curl -s $B/portal/reports -H "Authorization: Bearer $P" | j "any(r['id']==$GID and r['createdBy'] for r in d)")" True

# ---------------- before / after photos ----------------
PH=$(curl -s -X POST $B/portal/photos -H "Authorization: Bearer $P" -F "caption=Smoke test acne" -F "before=@/tmp/bd_test.png")
PID=$(echo "$PH" | j "d['id']")
chk "patient uploads a BEFORE photo" "$(echo "$PH" | j "d['hasAfter']==False")" True
chk "fake photo (HTML in .png) rejected -> 400" "$(code -X POST $B/portal/photos -H "Authorization: Bearer $P" -F "caption=x" -F "before=@/tmp/bd_fake.png")" 400
chk "patient adds the AFTER photo later" "$(curl -s -X POST $B/portal/photos/$PID/after -H "Authorization: Bearer $P" -F "after=@/tmp/bd_test.png" | j "d['hasAfter']")" True
chk "patient can fetch own photo (image/png)" "$(curl -s -o /dev/null -w '%{content_type}' $B/portal/photos/$PID/before -H "Authorization: Bearer $P")" image/png
chk "doctor sees the patient's photo sets" "$(curl -s $B/patients/SK001/photos -H "Authorization: Bearer $DJ" | j "any(p['id']==$PID and p['hasAfter'] for p in d)")" True
chk "doctor can open the AFTER photo" "$(code $B/patients/SK001/photos/$PID/after -H "Authorization: Bearer $DJ")" 200
NEWTOK=$(login $U Secret@123 PATIENT | tok)
chk "another patient cannot open it -> 404" "$(code $B/portal/photos/$PID/before -H "Authorization: Bearer $NEWTOK")" 404
chk "patient deletes the photos" "$(code -X DELETE $B/portal/photos/$PID -H "Authorization: Bearer $P")" 204

# ---------------- public reviews ----------------
RV=$(curl -s -X POST $B/portal/reviews -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"rating":5,"text":"Smoke test review","doctorId":"doc1","anonymous":false}')
RVID=$(echo "$RV" | j "d['id']")
chk "patient publishes a review -> 201" "$([ -n "$RVID" ] && echo ok)" ok
chk "doctor can read it with the patient's short name" "$(curl -s $B/reviews -H "Authorization: Bearer $DJ" | j "any(r['id']==$RVID and r['doctorName']=='Dr. Ananya Sharma' and r['author']!='Anonymous patient' for r in d)")" True
chk "other patient can read it" "$(curl -s $B/reviews -H "Authorization: Bearer $NEWTOK" | j "any(r['id']==$RVID and not r['mine'] for r in d)")" True
chk "author sees it marked as theirs" "$(curl -s $B/reviews -H "Authorization: Bearer $P" | j "any(r['id']==$RVID and r['mine'] for r in d)")" True
ANON=$(curl -s -X POST $B/portal/reviews -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"rating":4,"text":"Anonymous smoke review","anonymous":true}' | j "d['id']")
chk "anonymous review hides the name" "$(curl -s $B/reviews -H "Authorization: Bearer $DJ" | j "[r['author'] for r in d if r['id']==$ANON][0]")" "Anonymous patient"
chk "rating 6 rejected -> 400" "$(code -X POST $B/portal/reviews -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"rating":6,"text":"x"}')" 400
chk "markup in a review rejected -> 400" "$(code -X POST $B/portal/reviews -H "Authorization: Bearer $P" -H 'Content-Type: application/json' -d '{"rating":5,"text":"<script>alert(1)</script>"}')" 400
chk "staff cannot post reviews -> 403" "$(code -X POST $B/portal/reviews -H "Authorization: Bearer $R" -H 'Content-Type: application/json' -d '{"rating":5,"text":"x"}')" 403
chk "another patient cannot delete it -> 404" "$(code -X DELETE $B/portal/reviews/$RVID -H "Authorization: Bearer $NEWTOK")" 404
chk "receptionist cannot remove reviews -> 403" "$(code -X DELETE $B/reviews/$RVID -H "Authorization: Bearer $R")" 403
chk "patient deletes own review -> 204" "$(code -X DELETE $B/portal/reviews/$RVID -H "Authorization: Bearer $P")" 204
chk "admin removes any review -> 204" "$(code -X DELETE $B/reviews/$ANON -H "Authorization: Bearer $A")" 204

# ---------------- report files are kept in the database & detected by content ----------------
cp /tmp/bd_test.png /tmp/bd_misnamed.jpg      # a PNG that has a .jpg name (common with screenshots)
MIS=$(curl -s -X POST $B/portal/reports -H "Authorization: Bearer $P" -F "file=@/tmp/bd_misnamed.jpg" -F "title=Misnamed")
MISID=$(echo "$MIS" | j "d['id']")
chk "PNG named .jpg is accepted and stored as a PNG" "$(echo "$MIS" | j "d['contentType']=='image/png' and d['fileName'].endswith('.png')")" True
chk "patient can open it (image/png)" "$(curl -s -o /dev/null -w '%{content_type}' $B/portal/reports/$MISID/file -H "Authorization: Bearer $P")" image/png
chk "doctor can open it too" "$(code $B/patients/SK001/reports/$MISID/file -H "Authorization: Bearer $DJ")" 200
chk "unknown report id gives a clear 404" "$(code $B/portal/reports/99999999/file -H "Authorization: Bearer $P")" 404
curl -s -o /dev/null -X DELETE $B/portal/reports/$MISID -H "Authorization: Bearer $P"
echo "passed=$pass failed=$fail"; [ $fail -eq 0 ]
