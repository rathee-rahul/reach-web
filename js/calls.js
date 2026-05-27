const WEB_TURN_URL = "turn:free.expressturn.com:3478?transport=tcp";
const WEB_TURN_FALLBACK_URL = "turns:free.expressturn.com:443";
const WEB_TURN_USERNAME = "000000002094654106";
const WEB_TURN_PASSWORD = "7oUYSLUYvac7Nic/LURtWtmnqPI=";

const WebCalls = (() => {
  const SIGNAL_POLL_MS = 1200;
  const INCOMING_POLL_MS = 2500;
  const CALL_TIMEOUT_MS = 45000;
  const DISCONNECT_GRACE_MS = 30000;
  let client = null;
  let channel = null;
  let current = null;
  let pollTimer = null;
  let incomingPollTimer = null;
  let timeoutTimer = null;
  let durationTimer = null;
  let qualityTimer = null;
  let processedSignals = new Set();
  let toneContext = null;
  let toneTimer = null;
  let toneNodes = [];
  let audioUnlocked = false;
  let remoteAudioRetryTimer = null;
  let disconnectTimer = null;
  let screenWakeLock = null;

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
        audio: audioConstraints(),
        video: false,
      });
      const call = await Api.startVoiceCall(Auth.getToken(), chatId);
      current.callId = call.call_id || call.callId || "";
      current.chatId = call.chat_id || call.chatId || chatId;
      startPolling(current.callId);
      setTimeout(sendOutgoingPushOnce, 900);
      setupPeer();
      const offer = await current.pc.createOffer({ offerToReceiveAudio: true });
      const tunedOffer = tuneAudioDescription(offer);
      await current.pc.setLocalDescription(tunedOffer);
      await sendSignal("call_offer", {
        type: tunedOffer.type,
        sdp: tunedOffer.sdp,
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
      speakerOn: false,
      outputSwitching: false,
      pushSent: false,
      historySaved: false,
      connectedAt: 0,
      audioBlocked: false,
      quality: "Checking",
      qualityClass: "checking",
      previousInboundStats: null,
      minimized: false,
      ...overrides,
    };
  }

  async function sendOutgoingPushOnce() {
    if (!current || current.pushSent || current.direction !== "outgoing" || !current.callId || !current.chatId) return;
    current.pushSent = true;
    try {
      const result = await Api.sendCallPush(Auth.getToken(), current.chatId, current.callId, Auth.getName(), Auth.getVid());
      if (Number(result?.sent ?? 1) === 0) showToast("No background alert is registered. Web calls ring while REACH is open.");
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
        audio: audioConstraints(),
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
      const tunedAnswer = tuneAudioDescription(answer);
      await current.pc.setLocalDescription(tunedAnswer);
      current.status = "Connecting...";
      render();
      await Api.updateVoiceCallStatus(Auth.getToken(), current.callId, "accepted", "");
      await sendSignal("call_answer", { type: tunedAnswer.type, sdp: tunedAnswer.sdp });
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
    if (!current || !payload?.candidate) return;
    const candidate = new RTCIceCandidate({
      candidate: payload.candidate,
      sdpMid: payload.sdp_mid || payload.sdpMid || "",
      sdpMLineIndex: payload.sdp_mline_index ?? payload.sdpMLineIndex ?? 0,
    });
    if (!current.pc || !current.remoteDescriptionSet) {
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
    const pc = new RTCPeerConnection({
      iceServers: iceServers(),
      iceCandidatePoolSize: 10,
      sdpSemantics: "unified-plan",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
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
      event.track.onunmute = () => attachRemoteAudio();
      event.track.onended = () => scheduleRemoteAudioRetry();
      attachRemoteAudio();
    };
    pc.onconnectionstatechange = () => handlePeerState(pc.connectionState);
    pc.oniceconnectionstatechange = () => handlePeerState(pc.iceConnectionState);
  }

  function tuneAudioDescription(description) {
    if (!description?.sdp) return description;
    return {
      type: description.type,
      sdp: preferOpus(description.sdp),
    };
  }

  function preferOpus(sdp) {
    const lines = String(sdp || "").split(/\r\n/);
    const audioLineIndex = lines.findIndex((line) => line.startsWith("m=audio "));
    if (audioLineIndex < 0) return sdp;
    const opusLineIndex = lines.findIndex((line) => /^a=rtpmap:\d+\s+opus\/48000/i.test(line));
    if (opusLineIndex < 0) return sdp;
    const match = lines[opusLineIndex].match(/^a=rtpmap:(\d+)/i);
    const opusPayload = match?.[1] || "";
    if (!opusPayload) return sdp;

    const audioParts = lines[audioLineIndex].split(" ");
    if (audioParts.length > 3) {
      const header = audioParts.slice(0, 3);
      const payloads = audioParts.slice(3).filter((payload) => payload !== opusPayload);
      lines[audioLineIndex] = [...header, opusPayload, ...payloads].join(" ");
    }

    const fmtpPrefix = `a=fmtp:${opusPayload} `;
    const fmtpIndex = lines.findIndex((line) => line.startsWith(fmtpPrefix));
    const requiredParams = ["minptime=10", "useinbandfec=1"];
    if (fmtpIndex >= 0) {
      let fmtpLine = lines[fmtpIndex];
      for (const param of requiredParams) {
        const key = param.split("=")[0];
        if (!new RegExp(`(?:^|;)\\s*${key}=`).test(fmtpLine.replace(fmtpPrefix, ""))) {
          fmtpLine += `;${param}`;
        }
      }
      lines[fmtpIndex] = fmtpLine;
    } else {
      lines.splice(opusLineIndex + 1, 0, `${fmtpPrefix}${requiredParams.join(";")}`);
    }
    return lines.join("\r\n");
  }

  function handlePeerState(state) {
    if (!current) return;
    if (["connected", "completed"].includes(state)) {
      clearDisconnectTimer();
      markConnected();
      return;
    }
    if (["disconnected", "failed"].includes(state) && current.status === "Connected") {
      if (disconnectTimer) return;
      current.quality = "Reconnecting";
      current.qualityClass = "fair";
      render();
      disconnectTimer = setTimeout(() => {
        disconnectTimer = null;
        if (current?.status === "Connected") {
          stopCall({ result: "Dropped", signal: true, signalType: "call_end", updateStatus: true, reason: "dropped" });
        }
      }, DISCONNECT_GRACE_MS);
    }
  }

  function clearDisconnectTimer() {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  function prepareRemoteAudio() {
    let audio = document.getElementById("reach-call-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "reach-call-audio";
      audio.autoplay = true;
      audio.playsInline = true;
      audio.controls = false;
      audio.setAttribute("autoplay", "autoplay");
      audio.setAttribute("playsinline", "playsinline");
      audio.setAttribute("webkit-playsinline", "webkit-playsinline");
      document.body.appendChild(audio);
    }
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute("autoplay", "autoplay");
    audio.setAttribute("playsinline", "playsinline");
    audio.setAttribute("webkit-playsinline", "webkit-playsinline");
    audio.muted = false;
    audio.volume = 1;
    return audio;
  }

  function hasLiveAudioTrack(stream) {
    return !!stream?.getAudioTracks?.().some((track) => track.readyState === "live" && track.enabled !== false);
  }

  function attachRemoteAudio() {
    if (!current?.remoteStream) return;
    const audio = prepareRemoteAudio();
    if (audio.srcObject !== current.remoteStream) {
      audio.srcObject = current.remoteStream;
    }
    audio.muted = false;
    audio.volume = 1;
    if (!hasLiveAudioTrack(current.remoteStream)) {
      scheduleRemoteAudioRetry();
      return;
    }
    audio.play?.()
      .then(() => {
        if (!current) return;
        current.audioBlocked = false;
        audioUnlocked = true;
      })
      .catch(() => {
        if (!current) return;
        current.audioBlocked = true;
        scheduleRemoteAudioRetry();
        render();
      });
  }

  function scheduleRemoteAudioRetry() {
    clearTimeout(remoteAudioRetryTimer);
    if (!current?.remoteStream) return;
    remoteAudioRetryTimer = setTimeout(() => attachRemoteAudio(), 700);
  }

  async function markConnected() {
    if (!current || current.status === "Connected") return;
    stopTone();
    stopTimeout();
    current.status = "Connected";
    current.connectedAt = Date.now();
    render();
    requestCallWakeLock();
    preferSpeakerOutput();
    startDurationTimer();
    startQualityMonitor();
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
    audio.muted = false;
    audio.volume = 1;
    ensureToneContext();
    if (current && (current.status === "Incoming voice call" || current.status === "Ringing...")) {
      playToneBurst();
    }
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

  function outputNameMatches(device, useSpeaker) {
    const label = String(device?.label || "").toLowerCase();
    if (!label) return false;
    if (useSpeaker) return /speaker|speakerphone|loudspeaker/.test(label);
    return /earpiece|receiver|handset/.test(label);
  }

  function canSwitchAudioOutput() {
    return typeof prepareRemoteAudio().setSinkId === "function";
  }

  async function switchAudioOutput(useSpeaker, options = {}) {
    const audio = prepareRemoteAudio();
    if (typeof audio.setSinkId !== "function") {
      if (!options.silent) showToast("This browser controls the call audio route");
      return false;
    }

    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const available = devices.filter((device) => device.kind === "audiooutput");
    let selected = available.find((device) => outputNameMatches(device, useSpeaker));

    if (!selected && !options.silent && typeof navigator.mediaDevices.selectAudioOutput === "function") {
      showToast(useSpeaker ? "Select Speaker in the audio output list" : "Select Earpiece in the audio output list");
      selected = await navigator.mediaDevices.selectAudioOutput().catch(() => null);
    }
    if (!selected) {
      if (!options.silent) showToast(useSpeaker ? "Speaker selection is not available in this browser" : "Earpiece selection is not available in this browser");
      return false;
    }

    const label = String(selected.label || "").toLowerCase();
    if (label && outputNameMatches(selected, !useSpeaker) && !outputNameMatches(selected, useSpeaker)) {
      showToast(useSpeaker ? "Select Speaker to turn speaker on" : "Select Earpiece to turn speaker off");
      return false;
    }

    await audio.setSinkId(selected.deviceId);
    audio.muted = false;
    audio.volume = 1;
    audio.play?.().catch(() => {});
    return true;
  }

  async function preferSpeakerOutput() {
    if (!current || !canSwitchAudioOutput()) return;
    try {
      if (await switchAudioOutput(true, { silent: true })) {
        current.speakerOn = true;
        render();
      }
    } catch {}
  }

  async function toggleSpeaker() {
    if (!current || current.outputSwitching) return;
    const useSpeaker = !current.speakerOn;
    current.outputSwitching = true;
    render();
    try {
      if (await switchAudioOutput(useSpeaker)) {
        current.speakerOn = useSpeaker;
        showToast(useSpeaker ? "Speaker on" : "Speaker off - using earpiece");
      }
    } catch {
      showToast("Could not change call audio output");
    } finally {
      if (!current) return;
      current.outputSwitching = false;
      render();
    }
  }

  async function requestCallWakeLock() {
    if (screenWakeLock || !current || current.status !== "Connected" || document.visibilityState !== "visible" || !navigator.wakeLock?.request) return;
    try {
      screenWakeLock = await navigator.wakeLock.request("screen");
      screenWakeLock.addEventListener("release", () => { screenWakeLock = null; });
    } catch {}
  }

  function releaseCallWakeLock() {
    if (screenWakeLock) screenWakeLock.release().catch(() => {});
    screenWakeLock = null;
  }

  function onVisibilityChanged() {
    if (document.visibilityState === "visible" && current?.status === "Connected") {
      requestCallWakeLock();
      attachRemoteAudio();
    }
  }

  async function stopCall(options = {}) {
    const call = current;
    if (!call) return;
    current = null;
    clearTimeout(remoteAudioRetryTimer);
    remoteAudioRetryTimer = null;
    clearDisconnectTimer();
    releaseCallWakeLock();
    stopTone();
    stopPolling();
    stopTimeout();
    stopDurationTimer();
    stopQualityMonitor();
    if (options.writeHistory === true) {
      writeCallHistoryBubble(call, options.result || options.reason || "Ended");
    }
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
    stopCall({ result: "Declined", signal: true, signalType: "call_decline", updateStatus: true, status: "declined", reason: "declined", writeHistory: true });
  }

  function endCurrentCall() {
    if (!current) return;
    if (current.direction === "incoming" && current.status === "Incoming voice call") return declineIncoming();
    const signalType = current.direction === "outgoing" && current.status !== "Connected" ? "call_cancel" : "call_end";
    const status = signalType === "call_cancel" ? "cancelled" : "ended";
    stopCall({ result: status, signal: true, signalType, updateStatus: true, status, reason: status, writeHistory: true });
  }

  function minimize() {
    if (!current || current.direction === "incoming" && current.status === "Incoming voice call") return;
    current.minimized = true;
    render();
  }

  function restore() {
    if (!current) return;
    current.minimized = false;
    render();
  }

  function hasActiveCall() {
    return !!current;
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
        writeHistory: true,
      });
    }, CALL_TIMEOUT_MS);
  }

  function stopTimeout() {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }

  function formatElapsedDuration(startedAt) {
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function startDurationTimer() {
    stopDurationTimer();
    durationTimer = setInterval(() => {
      if (!current || current.status !== "Connected") {
        stopDurationTimer();
        return;
      }
      render();
    }, 1000);
  }

  function stopDurationTimer() {
    clearInterval(durationTimer);
    durationTimer = null;
  }

  function startQualityMonitor() {
    stopQualityMonitor();
    updateCallQuality();
    qualityTimer = setInterval(updateCallQuality, 3000);
  }

  function stopQualityMonitor() {
    clearInterval(qualityTimer);
    qualityTimer = null;
  }

  async function updateCallQuality() {
    const call = current;
    if (!call?.pc || call.status !== "Connected" || typeof call.pc.getStats !== "function") return;
    try {
      const reports = await call.pc.getStats();
      if (current !== call) return;
      let inbound = null;
      let candidatePair = null;
      reports.forEach((report) => {
        if (report.type === "inbound-rtp" && !report.isRemote && (report.kind === "audio" || report.mediaType === "audio")) {
          inbound = report;
        }
        if (report.type === "candidate-pair" && report.state === "succeeded" && (report.selected || report.nominated)) {
          candidatePair = report;
        }
      });
      if (!inbound) return;

      const previous = call.previousInboundStats;
      const received = Number(inbound.packetsReceived || 0);
      const lost = Number(inbound.packetsLost || 0);
      const receivedDelta = previous ? Math.max(0, received - previous.received) : received;
      const lostDelta = previous ? Math.max(0, lost - previous.lost) : Math.max(0, lost);
      const packetTotal = receivedDelta + lostDelta;
      const lossPercent = packetTotal ? (lostDelta / packetTotal) * 100 : 0;
      const jitterMs = Number(inbound.jitter || 0) * 1000;
      const rttMs = Number(candidatePair?.currentRoundTripTime || 0) * 1000;
      call.previousInboundStats = { received, lost };

      let quality = "Good";
      let qualityClass = "good";
      if (lossPercent > 8 || jitterMs > 80 || rttMs > 450) {
        quality = "Poor";
        qualityClass = "poor";
      } else if (lossPercent > 3 || jitterMs > 40 || rttMs > 250) {
        quality = "Fair";
        qualityClass = "fair";
      }
      if (call.quality !== quality || call.qualityClass !== qualityClass) {
        call.quality = quality;
        call.qualityClass = qualityClass;
        render();
      }
    } catch {}
  }

  function callHistoryResult(value) {
    const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
    const labels = {
      ended: "Ended",
      declined: "Declined",
      cancelled: "Cancelled",
      no_answer: "No answer",
      missed: "Missed",
      failed: "Failed",
      dropped: "Dropped",
    };
    return labels[key] || "Ended";
  }

  function callHistoryDuration(call) {
    const seconds = call.connectedAt ? Math.max(0, Math.floor((Date.now() - call.connectedAt) / 1000)) : 0;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
  }

  async function writeCallHistoryBubble(call, result) {
    if (!call || call.historySaved || !call.chatId || !Auth.isLoggedIn()) return;
    call.historySaved = true;
    const direction = call.direction === "incoming" ? "Incoming" : "Outgoing";
    const content = `${direction} voice call - ${callHistoryResult(result)} - ${callHistoryDuration(call)}`;
    try {
      await Api.sendCallHistoryBubble(Auth.getToken(), call.chatId, content);
      if (typeof loadMessages === "function" && currentChatId === call.chatId) {
        loadMessages(call.chatId, { scroll: false, silent: true });
      }
      if (typeof loadChatListFromServer === "function") {
        loadChatListFromServer({ showError: false, preserveSearch: true });
      }
    } catch {}
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

  function audioConstraints() {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };
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
    if (current.minimized) {
      overlay.className = "call-mini";
      overlay.innerHTML = `
        <button class="call-mini-main" onclick="WebCalls.restore()">${Icon("call", 18)}<span>${Utils.escape(current.otherName || "Voice call")} · ${Utils.escape(current.status || "Connected")}</span></button>
        <button class="call-mini-end" onclick="WebCalls.endCurrentCall()" title="End call">${Icon("back", 18)}</button>`;
      return;
    }
    const incoming = current.direction === "incoming" && current.status === "Incoming voice call";
    overlay.className = "call-overlay";
    overlay.innerHTML = `
      <div class="call-panel">
        ${incoming ? "" : `<button class="call-minimize" onclick="WebCalls.minimize()" title="Browse while on call">${Icon("back", 18)}<span>Back to app</span></button>`}
        <div class="call-title">${incoming ? "Incoming Call" : "Voice Call"}</div>
        <div class="call-avatar">${Avatar(current.otherName, current.otherAvatar || 1, 96, current.otherPhoto || "")}</div>
        <div class="call-name">${Utils.escape(current.otherName || "REACH User")}</div>
        <div class="call-vid">${current.otherVid ? `ID ${Utils.escape(current.otherVid)}` : ""}</div>
        <div class="call-status">${Utils.escape(current.status || "")}</div>
        ${current.status === "Connected" && current.connectedAt ? `<div class="call-duration">${formatElapsedDuration(current.connectedAt)}</div>` : ""}
        ${current.status === "Connected" ? `<div class="call-quality ${Utils.escape(current.qualityClass)}"><span></span>Call quality: ${Utils.escape(current.quality)}</div>` : ""}
        ${current.audioBlocked ? `<button class="call-tool active" onclick="WebCalls.enableAudio()">Enable call sound</button>` : ""}
        ${incoming ? `
          <div class="call-actions">
            <button class="call-btn danger" onclick="WebCalls.declineIncoming()">${Icon("back", 20)}<span>Decline</span></button>
            <button class="call-btn accept" onclick="WebCalls.acceptIncoming()">${Icon("call", 20)}<span>Accept</span></button>
          </div>
        ` : `
          <div class="call-actions compact">
            <div class="call-tools-row">
              <button class="call-tool ${current.muted ? "active" : ""}" onclick="WebCalls.toggleMute()">${Icon(current.muted ? "micOff" : "mic", 19)}<span>${current.muted ? "Unmute" : "Mute"}</span></button>
              ${canSwitchAudioOutput()
                ? `<button class="call-tool ${current.speakerOn ? "speaker-on" : "speaker-off"}" onclick="WebCalls.toggleSpeaker()" ${current.outputSwitching ? "disabled" : ""}>${Icon(current.speakerOn ? "speaker" : "speakerOff", 19)}<span>${current.outputSwitching ? "Switching..." : (current.speakerOn ? "Speaker On" : "Use Speaker")}</span></button>`
                : `<button class="call-tool audio-fixed" disabled>${Icon("speaker", 19)}<span>Phone Controls Audio</span></button>`}
            </div>
            ${canSwitchAudioOutput() ? "" : `<div class="call-browser-note">If your screen turns off near your ear, the browser is using phone call audio. Use the Android app for reliable background calls.</div>`}
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
    minimize,
    restore,
    hasActiveCall,
    onVisibilityChanged,
  };
})();

window.WebCalls = WebCalls;
window.addEventListener("beforeunload", () => WebCalls.reset());
