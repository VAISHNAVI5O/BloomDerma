#!/usr/bin/env bash
# Runs the REAL PaymentService / VideoService / Billing / CurrentUser code (copied from ../../backend) against tiny
# stand-ins for Spring/JPA. Needs a JDK 17+ (javac). No Maven, no MySQL needed.  Optional: `apt install faketime` for a fixed clock.
set -e; cd "$(dirname "$0")"; A=../../backend/src/main/java/com/bloomderma/api; rm -rf .build; mkdir -p .build/real .build/out
for f in service/Billing service/ApptTime service/PaymentService service/VideoService security/CurrentUser dto/PaymentRequest dto/AppointmentDto exception/ResourceNotFoundException exception/ConflictException repository/AppointmentRepository; do
  mkdir -p .build/real/com/bloomderma/api/$(dirname $f); cp $A/$f.java .build/real/com/bloomderma/api/$f.java; done
javac --release 17 -Xlint:-options -Xlint:-unchecked -d .build/out $(find stubs .build/real -name '*.java') HarnessTest.java 2>&1 | grep -v "^Note" || true
if command -v faketime >/dev/null; then FAKETIME_DONT_FAKE_MONOTONIC=1 TZ=UTC faketime '2026-10-29 06:30:00' java -Duser.timezone=Asia/Kolkata -cp .build/out HarnessTest all
else java -Duser.timezone=Asia/Kolkata -cp .build/out HarnessTest all; fi
