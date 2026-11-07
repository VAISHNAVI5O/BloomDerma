#!/usr/bin/env bash
# Runs the REAL frontend/src/services/videoCall.js twice (patient + doctor) in jsdom against a relay that copies VideoService's
# behaviour, with a fake RTCPeerConnection, random network latency and a virtual clock. Needs Node 18+.
# It simulates the signalling only - it cannot prove real camera/microphone/NAT behaviour; test that in two real browsers.
set -e; cd "$(dirname "$0")"
[ -d node_modules ] || npm i --silent jsdom @sinonjs/fake-timers esbuild
mkdir -p build/src/services; cp ../../frontend/src/services/videoCall.js build/src/services/; cp mock/apiService.js build/src/services/
npx esbuild build/src/services/videoCall.js --bundle --format=iife --global-name=VC --outfile=bundle.js --log-level=warning
node sim.js "${1:-40}"
