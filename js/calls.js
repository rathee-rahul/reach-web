const WEB_TURN_URL = "turn:free.expressturn.com:3478?transport=tcp";
const WEB_TURN_FALLBACK_URL = "turns:free.expressturn.com:443";
const WEB_TURN_USERNAME = "000000002094654106";
const WEB_TURN_PASSWORD = "7oUYSLUYvac7Nic/LURtWtmnqPI=";

const WebCalls = (() => {
  const SIGNAL_POLL_MS = 1200;
  const INCOMING_POLL_MS = 2500;
  const CALL_TIMEOUT_MS = 45000;
  let client = null;
  let channel = null;
  let current = null;
  let pollTimer = null;
  let incomingPollTimer = null;
  let timeoutTimer = null;
  let processedSignals = new Set();
  let toneContext = null;
  let toneTimer = null;
  let toneNodes = [];
  let audioUnlocked = false;

  function supported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);
  }

  function iceServers() {
    const turn = {
      urls: [WEB_TURN_URL, WEB_TURN_FALLBACK_URL],
      username: WEB_TURN_USERNAME,
      credential: WEB_TURN_PASSWORD,
    };
    return [turn, { urls: "stun:stun.l.google.com:19302" }];
  }

  function startForegroundMonitor() {
    if (window.PREVIEW_MODE || !Auth.isLoggedIn()) return;
    startIncomingOfferPolling();
    if (!window.supabase) return;
    const vid = Utils.normalizeVid(Auth.getVid());
    if (!vid) return;
    const { createClient } = window.supabase;
    if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (channel) client.removeChannel(channel);
    channel = client
      .channel(`web-call-signals:${vid}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "call_signals",
        filter: `receiver_vid=eq.${vid}`,
      }, (event) => {
        const callId = event?.new?.call_id || event?.new?.callId || "";
        if (callId) fetchSignals(callId);
      })
      .subscribe();
  }

  function stopForegroundMonitor() {
    if (client && channel) client.removeChannel(channel);
    channel = null;
    stopIncomingOfferPolling();
  }

  function reset() {
    stopCall({ signal: false, updateStatus: false });
    stopForegroundMonitor();
    processedSignals = new Set();
  }

  async function startOutgoing(contact) {
    if (!supported()) return showToast("Voice calls need a modern browser with microphone access");
    if (!Auth.isLoggedIn()) return showToast("Sign in again to call");
    if (current) return showToast("A call is already active");
    const chatId = contact?.chatId || currentChatId || "";
    if (!chatId) return showToast("Open a chat before calling");

    current = baseCallState({
      direction: "outgoing",
      chatId,
      otherName: contact?.name || "REACH User",
      otherVid: Utils.normalizeVid(contact?.vid || ""),
      otherPhoto: contact?.photo || "",
      otherAvatar: contact?.avatar || 1,
      status: "Calling...",
    });
    render();
    ensureToneContext();
    prepareRemoteAudio();
    enableAudio({ silent: true });
    startTimeout();

    try {
      current.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const call = await Api.startVoiceCall(Auth.getToken(), chatId);
      current.callId = call.call_id || call.callId || "";
      current.chatId = call.chat_id || call.chatId || chatId;
      startPolling(current.callId);
      setTimeout(sendOutgoingPushOnce, 900);
      setupPeer();
      const offer = await current.pc.createOffer({ offerToReceiveAudio: true });
      await current.pc.setLocalDescription(offer);
      await sendSignal("call_offer", {
        type: offer.type,
        sdp: offer.sdp,
        chat_id: current.chatId,
        caller_vid: Auth.getVid(),
        caller_name: Auth.getName() || "REACH User",
        target_name: current.otherName,
      });
      sendOutgoingPushOnce();
    } catch (error) {
      showToast(error.message || "Could not start call");
      stopCall({ result: "Failed", signal: false, updateStatus: true, reason: "failed" });
    }
  }

  function baseCallState(overrides) {
    return {
      callId: "",
      chatId: "",
      direction: "outgoing",
      status: "Calling...",
      otherName: "REACH User",
      otherVid: "",
      otherPhoto: "",
      otherAvatar: 1,
      pc: null,
      localStream: null,
      remoteStream: null,
      pendingIce: [],
      remoteDescriptionSet: false,
      muted: false,
      speakerOn: true,
      pushSent: false,
      connectedAt: 0,
      audioBlocked: false,
      ...overrides,
    };
  }

  async function sendOutgoingPushOnce() {
    if (!current || current.pushSent || current.direction !== "outgoing" || !current.callId || !current.chatId) return;
    current.pushSent = true;
    try {
      const result = await Api.sendCallPush(Auth.getToken(), current.chatId, current.callId, Auth.getName(), Auth.getVid());
      if (Number(result?.sent ?? 1) === 0) showToast("Receiver notification token is not ready");
    } catch (error) {
      showToast(`Call notification not delivered: ${error.message || "try again"}`);
    }
  }

  async function fetchSignals(callId) {
    if (!Auth.isLoggedIn() || !callId) return;
    try {
      const signals = await Api.listCallSignals(Auth.getToken(), callId);
      for (const signal of normalizeSignals(signals)) handleSignal(signal);
    } catch {}
  }

  function startIncomingOfferPolling() {
    stopIncomingOfferPolling();
    pollPendingCallOffers();
    incomingPollTimer = setInterval(pollPendingCallOffers, INCOMING_POLL_MS);
  }

  function stopIncomingOfferPolling() {
    clearInterval(incomingPollTimer);
    incomingPollTimer = null;
  }

  async function pollPendingCallOffers() {
    if (!Auth.isLoggedIn() || current) return;
    try {
      const signals = await Api.listPendingCallOffers(Auth.getToken());
      for (const signal of normalizeSignals(signals)) handleSignal(signal);
    } catch {}
  }

  function normalizeSignals(value) {
    const rows = Array.isArray(value) ? value : (Array.isArray(value?.result) ? value.result : []);
    return rows.map((row) => ({
      id: row.id || "",
      callId: row.call_id || row.callId || "",
      senderVid: Utils.normalizeVid(row.sender_vid || row.senderVid || ""),
      receiverVid: Utils.normalizeVid(row.receiver_vid || row.receiverVid || ""),
      type: row.signal_type || row.signalType || "",
      payload: normalizePayload(row.payload),
    }));
  }

  function normalizePayload(payload) {
    if (!payload) return {};
    if (typeof payload === "object") return payload;
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }

  async function handleSignal(signal) {
    if (!signal || processedSignals.has(signal.id) || signal.senderVid === Utils.normalizeVid(Auth.getVid())) return;
    if (signal.id) processedSignals.add(signal.id);
    if (signal.type === "call_offer") return handleIncomingOffer(signal);
    if (!current || current.callId !== signal.callId) return;
    if (signal.type === "call_ringing") return handleRinging();
    if (signal.type === "call_answer") return handleAnswer(signal.payload);
    if (signal.type === "ice_candidate") return handleRemoteIce(signal.payload);
    if (["call_decline", "call_busy", "call_cancel", "call_end"].includes(signal.type)) {
      const reason = signal.type === "call_busy" ? "Busy" : (signal.type === "call_decline" ? "Declined" : "Ended");
      showToast(`Call ${reason.toLowerCase()}`);
      stopCall({ result: reason, signal: false, updateStatus: false });
    }
  }

  async function handleIncomingOffer(signal) {
    if (current) {
      Api.sendCallSignal(Auth.getToken(), signal.callId, "call_busy", { reason: "busy" }).catch(() => {});
      return;
    }
    const payload = signal.payload || {};
    current = baseCallState({
      direction: "incoming",
      callId: signal.callId,
      chatId: payload.chat_id || payload.chatId || "",
      otherName: payload.caller_name || "REACH User",
      otherVid: Utils.normalizeVid(payload.caller_vid || signal.senderVid),
      status: "Incoming voice call",
      pendingOffer: payload,
    });
    render();
    ensureToneContext();
    startIncomingTone();
    startTimeout();
    startPolling(current.callId);
    sendSignal("call_ringing", { ringing_by: Auth.getVid(), ringing_at: Date.now() }).catch(() => {});
  }

  async function acceptIncoming() {
    if (!current || current.direction !== "incoming" || !current.pendingOffer) return;
    stopTone();
    prepareRemoteAudio();
    enableAudio({ silent: true });
    try {
      current.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      setupPeer();
      await current.pc.setRemoteDescription(new RTCSessionDescription({
        type: current.pendingOffer.type || "offer",
        sdp: current.pendingOffer.sdp || "",
      }));
      current.remoteDescriptionSet = true;
      await drainIce();
      const answer = await current.pc.createAnswer();
      await current.pc.setLocalDescription(answer);
      current.status = "Connecting...";
      render();
      await Api.updateVoiceCallStatus(Auth.getToken(), current.callId, "connected", "");
      await sendSignal("call_answer", { type: answer.type, sdp: answer.sdp });
    } catch (error) {
      showToast(error.message || "Could not answer call");
      stopCall({ result: "Failed", signal: true, signalType: "call_end", updateStatus: true, reason: "failed" });
    }
  }

  function handleRinging() {
    if (!current || current.direction !== "outgoing") return;
    current.status = "Ringing...";
    render();
    startRingbackTone();
  }

  async function handleAnswer(payload) {
    if (!current?.pc) return;
    try {
      stopTone();
      await current.pc.setRemoteDescription(new RTCSessionDescription({
        type: payload.type || "answer",
        sdp: payload.sdp || "",
      }));
      current.remoteDescriptionSet = true;
      await drainIce();
      current.status = "Connecting...";
      render();
    } catch (error) {
      stopCall({ result: "Failed", signal: true, signalType: "call_end", updateStatus: true, reason: "failed" });
    }
  }

  async function handleRemoteIce(payload) {
    if (!current?.pc || !payload?.candidate) return;
    const candidate = new RTCIceCandidate({
      candidate: payload.candidate,
      sdpMid: payload.sdp_mid || payload.sdpMid || "",
      sdpMLineIndex: payload.sdp_mline_index ?? payload.sdpMLineIndex ?? 0,
    });
    if (!current.remoteDescriptionSet) {
      current.pendingIce.push(candidate);
      return;
    }
    try {
      await current.pc.addIceCandidate(candidate);
    } catch {}
  }

  async function drainIce() {
    if (!current?.pc || !current.remoteDescriptionSet) return;
    const pending = current.pendingIce.splice(0);
    for (const candidate of pending) {
      try {
        await current.pc.addIceCandidate(candidate);
      } catch {}
    }
  }

  function setupPeer() {
    if (!current || current.pc) return;
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    current.pc = pc;
    const audioTracks = current.localStream?.getAudioTracks?.() || [];
    audioTracks.forEach((track) => pc.addTrack(track, current.localStream));
    if (!audioTracks.length && pc.addTransceiver) {
      pc.addTransceiver("audio", { direction: "recvonly" });
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate || !current?.callId) return;
      sendSignal("ice_candidate", {
        candidate: event.candidate.candidate,
        sdp_mid: event.candidate.sdpMid,
        sdp_mline_index: event.candidate.sdpMLineIndex,
      }).catch(() => {});
    };
    pc.ontrack = (event) => {
      if (!current) return;
      if (event.streams?.[0]) {
        current.remoteStream = event.streams[0];
      } else {
        if (!current.remoteStream) current.remoteStream = new MediaStream();
        if (!current.remoteStream.getTracks().some((track) => track.id === event.track.id)) {
          current.remoteStream.addTrack(event.track);
        }
      }
      event.track.enabled = true;
      attachRemoteAudio();
    };
    pc.onconnectionstatechange = () => handlePeerState(pc.connectionState);
    pc.oniceconnectionstatechange = () => handlePeerState(pc.iceConnectionState);
  }

  function handlePeerState(state) {
    if (!current) return;
    if (["connected", "completed"].includes(state)) markConnected();
    if (["failed", "closed"].includes(state)) {
      if (current.status === "Connected") stopCall({ result: "Dropped", signal: true, signalType: "call_end", updateStatus: true, reason: "dropped" });
    }
  }

  function prepareRemoteAudio() {
    let audio = document.getElementById("reach-call-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "reach-call-audio";
      audio.autoplay = true;
      audio.playsInline = true;
      audio.controls = false;
      document.body.appendChild(audio);
    }
    audio.autoplay = true;
    audio.playsInline = true;
    audio.muted = current ? !current.speakerOn : false;
    audio.volume = current?.speakerOn === false ? 0 : 1;
    if (!audio.srcObject) audio.srcObject = new MediaStream();
    return audio;
  }

  function attachRemoteAudio() {
    if (!current?.remoteStream) return;
    const audio = prepareRemoteAudio();
    audio.srcObject = current.remoteStream;
    audio.play?.()
      .then(() => {
        if (!current) return;
        current.audioBlocked = false;
      })
      .catch(() => {
        if (!current) return;
        current.audioBlocked = true;
        render();
      });
  }

  async function markConnected() {
    if (!current || current.status === "Connected") return;
    stopTone();
    current.status = "Connected";
    current.connectedAt = Date.now();
    render();
    if (current.callId) Api.updateVoiceCallStatus(Auth.getToken(), current.callId, "connected", "").catch(() => {});
  }

  function toggleMute() {
    if (!current?.localStream) return;
    current.muted = !current.muted;
    current.localStream.getAudioTracks().forEach((track) => { track.enabled = !current.muted; });
    render();
  }

  function enableAudio(options = {}) {
    const audio = prepareRemoteAudio();
    if (current?.remoteStream) audio.srcObject = current.remoteStream;
    audio.muted = current ? !current.speakerOn : false;
    audio.volume = current?.speakerOn === false ? 0 : 1;
    ensureToneContext();
    return audio.play?.()
      .then(() => {
        audioUnlocked = true;
        if (!current) return;
        current.audioBlocked = false;
        render();
      })
      .catch(() => {
        if (!current) return;
        current.audioBlocked = true;
        if (!options.silent) showToast("Tap again, or allow sound for this site");
        render();
      });
  }

  function unlockAudio() {
    const ctx = ensureToneContext();
    if (ctx?.state === "running") audioUnlocked = true;
    const audio = prepareRemoteAudio();
    audio.play?.()
      .then(() => { audioUnlocked = true; })
      .catch(() => {});
  }

  function toggleSpeaker() {
    if (!current) return;
    current.speakerOn = !current.speakerOn;
    const audio = prepareRemoteAudio();
    audio.muted = !current.speakerOn;
    audio.volume = current.speakerOn ? 1 : 0;
    if (current.speakerOn) enableAudio();
    render();
  }

  async function stopCall(options = {}) {
    const call = current;
    if (!call) return;
    current = null;
    stopTone();
    stopPolling();
    stopTimeout();
    try {
      if (options.signal !== false && call.callId) {
        await Api.sendCallSignal(Auth.getToken(), call.callId, options.signalType || "call_end", { reason: options.reason || options.result || "ended" });
      }
    } catch {}
    try {
      if (options.updateStatus !== false && call.callId) {
        const status = options.status || (options.reason === "failed" ? "failed" : (options.reason === "cancelled" ? "cancelled" : "ended"));
        await Api.updateVoiceCallStatus(Auth.getToken(), call.callId, status, options.reason || options.result || status);
      }
    } catch {}
    try { call.pc?.close(); } catch {}
    call.localStream?.getTracks().forEach((track) => track.stop());
    document.getElementById("reach-call-audio")?.remove();
    document.getElementById("reach-call-overlay")?.remove();
  }

  function declineIncoming() {
    if (!current) return;
    stopCall({ result: "Declined", signal: true, signalType: "call_decline", updateStatus: true, status: "declined", reason: "declined" });
  }

  function endCurrentCall() {
    if (!current) return;
    if (current.direction === "incoming" && current.status === "Incoming voice call") return declineIncoming();
    const signalType = current.direction === "outgoing" && current.status !== "Connected" ? "call_cancel" : "call_end";
    const status = signalType === "call_cancel" ? "cancelled" : "ended";
    stopCall({ result: status, signal: true, signalType, updateStatus: true, status, reason: status });
  }

  function startPolling(callId) {
    stopPolling();
    if (!callId) return;
    pollTimer = setInterval(() => fetchSignals(callId), SIGNAL_POLL_MS);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function startTimeout() {
    stopTimeout();
    timeoutTimer = setTimeout(() => {
      if (!current || current.status === "Connected") return;
      const incoming = current.direction === "incoming";
      stopCall({
        result: incoming ? "Missed" : "No answer",
        signal: true,
        signalType: incoming ? "call_decline" : "call_cancel",
        updateStatus: true,
        status: incoming ? "missed" : "cancelled",
        reason: incoming ? "missed" : "no_answer",
      });
    }, CALL_TIMEOUT_MS);
  }

  function stopTimeout() {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }

  async function sendSignal(type, payload) {
    if (!current?.callId) return;
    return Api.sendCallSignal(Auth.getToken(), current.callId, type, payload || {});
  }

  function ensureToneContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!toneContext) toneContext = new AudioContext();
    if (toneContext.state === "suspended") toneContext.resume().catch(() => {});
    return toneContext;
  }

  function playToneBurst() {
    const ctx = ensureToneContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.58].forEach((offset) => {
      [440, 520].forEach((frequency) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.035);
        gain.gain.setValueAtTime(0.22, now + offset + 0.38);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.43);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.45);
        toneNodes.push(osc, gain);
      });
    });
  }

  function startRingbackTone() {
    stopTone();
    if (!audioUnlocked && current) {
      current.audioBlocked = true;
      render();
    }
    playToneBurst();
    toneTimer = setInterval(playToneBurst, 3000);
  }

  function startIncomingTone() {
    startRingbackTone();
  }

  function stopTone() {
    clearInterval(toneTimer);
    toneTimer = null;
    toneNodes.forEach((node) => {
      try { node.disconnect?.(); } catch {}
      try { node.stop?.(); } catch {}
    });
    toneNodes = [];
  }

  function render() {
    if (!current) {
      document.getElementById("reach-call-overlay")?.remove();
      return;
    }
    let overlay = document.getElementById("reach-call-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "reach-call-overlay";
      document.body.appendChild(overlay);
    }
    const incoming = current.direction === "incoming" && current.status === "Incoming voice call";
    overlay.className = "call-overlay";
    overlay.innerHTML = `
      <div class="call-panel">
        <div class="call-title">${incoming ? "Incoming Call" : "Voice Call"}</div>
        <div class="call-avatar">${Avatar(current.otherName, current.otherAvatar || 1, 96, current.otherPhoto || "")}</div>
        <div class="call-name">${Utils.escape(current.otherName || "REACH User")}</div>
        <div class="call-vid">${current.otherVid ? `ID ${Utils.escape(current.otherVid)}` : ""}</div>
        <div class="call-status">${Utils.escape(current.status || "")}</div>
        ${current.audioBlocked ? `<button class="call-tool active" onclick="WebCalls.enableAudio()">Enable audio</button>` : ""}
        ${incoming ? `
          <div class="call-actions">
            <button class="call-btn danger" onclick="WebCalls.declineIncoming()">${Icon("back", 20)}<span>Decline</span></button>
            <button class="call-btn accept" onclick="WebCalls.acceptIncoming()">${Icon("call", 20)}<span>Accept</span></button>
          </div>
        ` : `
          <div class="call-actions compact">
            <div class="call-tools-row">
              <button class="call-tool ${current.muted ? "active" : ""}" onclick="WebCalls.toggleMute()">${Icon(current.muted ? "micOff" : "mic", 19)}<span>${current.muted ? "Unmute" : "Mute"}</span></button>
              <button class="call-tool ${current.speakerOn ? "active" : ""}" onclick="WebCalls.toggleSpeaker()">${Icon(current.speakerOn ? "speaker" : "speakerOff", 19)}<span>${current.speakerOn ? "Speaker On" : "Speaker Off"}</span></button>
            </div>
            <button class="call-btn danger" onclick="WebCalls.endCurrentCall()">${Icon("back", 20)}<span>End</span></button>
          </div>
        `}
      </div>`;
  }

  return {
    startForegroundMonitor,
    stopForegroundMonitor,
    reset,
    startOutgoing,
    acceptIncoming,
    declineIncoming,
    endCurrentCall,
    toggleMute,
    toggleSpeaker,
    enableAudio,
    unlockAudio,
  };
})();

window.WebCalls = WebCalls;
window.addEventListener("beforeunload", () => WebCalls.reset());
