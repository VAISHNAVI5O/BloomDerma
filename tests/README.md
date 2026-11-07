# Video-consultation tests
- `java/run.sh`   – 43 checks on payment validation, the "must be paid before joining" rule, who may join, the join window and the signalling relay.
- `webrtc/run.sh` – simulates 640 patient/doctor calls (4 join orders x 3 network speeds) plus leave-and-rejoin.
Neither replaces a test with two real browsers (camera, microphone, NAT/firewall) and a running Spring Boot + MySQL.
