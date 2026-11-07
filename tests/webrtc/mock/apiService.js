// test double of apiService.js: same 3 functions videoCall.js uses, talking to a host-side relay
export const videoJoin = (id) => window.__relay.join(id, window.__who);
export const videoSignal = (id, type, payload) => window.__relay.signal(id, window.__who, type, payload);
export const videoPoll = (id, since) => window.__relay.poll(id, since, window.__who);
