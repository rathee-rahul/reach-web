const REACH_CONFIG = window.REACH_CONFIG || {};
const SUPABASE_URL = REACH_CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = REACH_CONFIG.SUPABASE_ANON_KEY || "";
const APK_DRIVE_URL = REACH_CONFIG.APK_DRIVE_URL || "";
const MAX_TEXT_MESSAGE_LENGTH = 4000;
const LOCAL_PREVIEW_HOSTS = ["127.0.0.1", "localhost"];
const PREVIEW_MODE = LOCAL_PREVIEW_HOSTS.includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get("preview") === "1";
window.PREVIEW_MODE = PREVIEW_MODE;

function getWebFingerprint() {
  let fp = localStorage.getItem("reach_web_fp");
  if (!fp) {
    fp = "web_" + Math.random().toString(36).substring(2, 18)
       + "_" + Date.now().toString(36);
    localStorage.setItem("reach_web_fp", fp);
  }
  return fp;
}

const PreviewData = {
  contacts: [
    { vid: "87654321", displayName: "Rahul", avatarId: 1, chatId: "preview-chat-1", lastMessage: "Okay, testing REACH web", lastMessageAt: new Date().toISOString(), unreadCount: 2 },
    { vid: "45671234", displayName: "Ankit", avatarId: 3, chatId: "preview-chat-2", lastMessage: "See you later", lastMessageAt: new Date(Date.now() - 3600000).toISOString(), unreadCount: 0 },
  ],
  requests: [
    { id: "req-1", vid: "11223344", displayName: "New Contact", avatarId: 4 },
  ],
  messages: [
    { id: "m1", chatId: "preview-chat-1", senderVid: "87654321", contentType: "text", content: "Hey, can you see this?", sentAt: new Date(Date.now() - 900000).toISOString() },
    { id: "m2", chatId: "preview-chat-1", senderVid: "12345678", contentType: "text", content: "Yes, web preview is open.", sentAt: new Date(Date.now() - 780000).toISOString(), deliveredAt: new Date(Date.now() - 760000).toISOString(), seenAt: new Date(Date.now() - 700000).toISOString() },
    { id: "m3", chatId: "preview-chat-1", senderVid: "87654321", contentType: "text", content: "Good. Make it exactly like app.", sentAt: new Date(Date.now() - 300000).toISOString() },
  ],
};

async function callFunction(name, body) {
  if (PREVIEW_MODE) return previewFunction(name, body || {});
  requireSupabaseConfig();
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  if (shouldSendBearerKey()) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

async function callRpc(name, body, options = {}) {
  if (PREVIEW_MODE) return previewRpc(name, body || {});
  requireSupabaseConfig();
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  if (shouldSendBearerKey()) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  if (options.minimal) headers.Prefer = "return=minimal";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) throw new Error(data.error || data.message || data.hint || "Request failed");
  return data;
}

function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("REACH web configuration is missing");
  }
}

function shouldSendBearerKey() {
  return String(SUPABASE_ANON_KEY || "").trim().startsWith("eyJ");
}

async function previewFunction(name, body) {
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (name === "login" || name === "generate-vid") {
    return { account: { vid: "12345678", displayName: "Rahul", display_name: "Rahul", avatarId: 1, avatar_id: 1, sessionToken: "preview-token", session_token: "preview-token" } };
  }
  if (name === "list-contacts") return { contacts: PreviewData.contacts };
  if (name === "list-requests") return { requests: PreviewData.requests };
  if (name === "list-messages") return { messages: PreviewData.messages };
  if (name === "send-message") {
    PreviewData.messages.push({
      id: `preview-${Date.now()}`,
      chatId: body.chat_id,
      senderVid: "12345678",
      contentType: "text",
      content: body.content,
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
    });
    return { ok: true };
  }
  if (name === "get-contact-presence") return { online: true, visible: true, lastSeenAt: new Date().toISOString() };
  if (name === "get-chat-typing") return { typing: true, typing_vid: "87654321" };
  if (name === "touch-last-seen" || name === "set-offline" || name === "set-chat-typing" || name === "mark-seen") return { ok: true };
  if (name === "list-groups") return { groups: [{ id: "preview-group-1", name: "REACH Team", memberCount: 3 }] };
  if (name === "list-group-messages") return { messages: [
    { id: "gm1", groupId: body.group_id, senderVid: "87654321", content: "Group messages are visible here.", sentAt: new Date(Date.now() - 600000).toISOString() },
    { id: "gm2", groupId: body.group_id, senderVid: "12345678", content: "Management stays in the Android app.", sentAt: new Date(Date.now() - 300000).toISOString() },
  ] };
  if (name === "get-privacy-settings") return { settings: { read_receipts_enabled: true, last_seen_enabled: true, notify_direct_messages: true } };
  if (name === "list-blocked-users") return { blocked: [{ vid: "99887766", displayName: "Blocked User", avatarId: 5 }] };
  if (name === "update-profile") return { user: { display_name: body.display_name } };
  if (name === "get-profile") return { user: { vid: "12345678", displayName: "Rahul", display_name: "Rahul", avatarId: 1, avatar_id: 1, recovery_email: "rahul@example.com", recovery_email_verified: true } };
  if (name === "update-profile-photo") return { profile_photo: body.profile_photo };
  if (name === "request-email-verification") return { ok: true };
  if (name === "verify-recovery-email") return { recovery_email: body.email, recovery_email_verified: true };
  return {};
}

async function previewRpc(name, body) {
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (name === "start_voice_call") {
    return [{
      call_id: `preview-call-${Date.now()}`,
      chat_id: body.p_chat_id,
      caller_vid: "12345678",
      callee_vid: "87654321",
      status: "ringing",
      started_at: new Date().toISOString(),
    }];
  }
  if (name === "update_voice_call_status") {
    return [{
      call_id: body.p_call_id,
      chat_id: "preview-chat-1",
      caller_vid: "12345678",
      callee_vid: "87654321",
      status: body.p_status || "ended",
      started_at: new Date().toISOString(),
      connected_at: body.p_status === "connected" ? new Date().toISOString() : null,
      ended_at: ["ended", "declined", "missed", "failed", "cancelled", "busy"].includes(body.p_status) ? new Date().toISOString() : null,
      end_reason: body.p_end_reason || "",
    }];
  }
  if (name === "send_call_signal") return {};
  if (name === "list_call_signals") return [];
  if (name === "list_voice_calls") return [];
  return {};
}

function firstRpcRow(data) {
  if (Array.isArray(data)) return data[0] || {};
  if (Array.isArray(data?.result)) return data.result[0] || {};
  return data || {};
}

const Api = {
  generateVid: (displayName, password, avatarId, recoveryEmail = "", googleIdToken = "", dateOfBirth = "", gender = "") =>
    callFunction("generate-vid", {
      display_name: displayName,
      password,
      avatar_id: avatarId,
      device_fp: getWebFingerprint(),
      recovery_email: recoveryEmail,
      google_id_token: googleIdToken,
      date_of_birth: dateOfBirth,
      gender,
      fcm_token: null,
    }),

  login: (vid, password) => callFunction("login", {
    vid,
    password,
    device_fp: getWebFingerprint(),
  }),

  deleteAccount: (sessionToken) => callFunction("delete-account", { session_token: sessionToken }),

  findContact: (sessionToken, vid) => callFunction("find-contact", { session_token: sessionToken, vid }),
  sendRequest: (sessionToken, receiverVid) => callFunction("send-request", { session_token: sessionToken, receiver_vid: receiverVid }),
  listContacts: (sessionToken) => callFunction("list-contacts", { session_token: sessionToken }),
  setContactName: (sessionToken, contactVid, name) => callFunction("set-contact-name", { session_token: sessionToken, contact_vid: contactVid, name }),

  listRequests: (sessionToken) => callFunction("list-requests", { session_token: sessionToken }),
  respondRequest: (sessionToken, requestId, accept) => callFunction("respond-request", { session_token: sessionToken, request_id: requestId, accept }),

  listMessages: (sessionToken, chatId) => callFunction("list-messages", { session_token: sessionToken, chat_id: chatId }),
  sendMessage: (sessionToken, chatId, content) => {
    if (String(content || "").length > MAX_TEXT_MESSAGE_LENGTH) throw new Error("Message is too long");
    return callFunction("send-message", { session_token: sessionToken, chat_id: chatId, content_type: "text", content });
  },
  markSeen: (sessionToken, chatId) => callFunction("mark-seen", { session_token: sessionToken, chat_id: chatId }),
  editMessage: (sessionToken, messageId, content) => {
    if (String(content || "").length > MAX_TEXT_MESSAGE_LENGTH) throw new Error("Message is too long");
    return callFunction("edit-message", { session_token: sessionToken, message_id: messageId, content });
  },
  deleteMessage: (sessionToken, messageId, scope = "me") => callFunction("delete-message", { session_token: sessionToken, message_id: messageId, scope }),

  listGroups: (sessionToken) => callFunction("list-groups", { session_token: sessionToken }),
  listGroupMessages: (sessionToken, groupId) => callFunction("list-group-messages", { session_token: sessionToken, group_id: groupId }),
  sendGroupMessage: (sessionToken, groupId, content) => {
    if (String(content || "").length > MAX_TEXT_MESSAGE_LENGTH) throw new Error("Message is too long");
    return callFunction("send-group-message", { session_token: sessionToken, group_id: groupId, content_type: "text", content });
  },
  getGroupInfo: (sessionToken, groupId) => callFunction("get-group-info", { session_token: sessionToken, group_id: groupId }),

  getContactPresence: (sessionToken, contactVid) => callFunction("get-contact-presence", { session_token: sessionToken, target_vid: contactVid, contact_vid: contactVid }),
  touchLastSeen: (sessionToken) => callFunction("touch-last-seen", { session_token: sessionToken }),
  setOffline: (sessionToken) => callFunction("set-offline", { session_token: sessionToken }),
  setTyping: (sessionToken, chatId, isTyping) => callFunction("set-chat-typing", { session_token: sessionToken, chat_id: chatId, is_typing: isTyping }),
  getTyping: (sessionToken, chatId) => callFunction("get-chat-typing", { session_token: sessionToken, chat_id: chatId }),

  getPrivacySettings: (sessionToken) => callFunction("get-privacy-settings", { session_token: sessionToken }),
  updatePrivacySettings: (sessionToken, settings) => callFunction("update-privacy-settings", { session_token: sessionToken, ...settings }),
  requestEmailVerification: (sessionToken, email) => callFunction("request-email-verification", { session_token: sessionToken, email }),
  verifyRecoveryEmail: (sessionToken, email, code) => callFunction("verify-recovery-email", { session_token: sessionToken, email, code }),

  blockUser: (sessionToken, targetVid, blockType) => callFunction("block-user", { session_token: sessionToken, target_vid: targetVid, block_type: blockType }),
  reportUser: (sessionToken, targetVid, reason) => callFunction("report-user", { session_token: sessionToken, target_vid: targetVid, reason }),
  listBlockedUsers: (sessionToken) => callFunction("list-blocked-users", { session_token: sessionToken }),
  unblockUser: (sessionToken, targetVid) => callFunction("unblock-user", { session_token: sessionToken, target_vid: targetVid }),

  updateProfileName: (sessionToken, displayName) => callFunction("update-profile", { session_token: sessionToken, display_name: displayName }),
  getProfile: (sessionToken) => callFunction("get-profile", { session_token: sessionToken }),
  updateProfilePhoto: (sessionToken, profilePhoto) => callFunction("update-profile-photo", { session_token: sessionToken, profile_photo: profilePhoto }),

  startVoiceCall: async (sessionToken, chatId) => firstRpcRow(await callRpc("start_voice_call", {
    p_session_token: sessionToken,
    p_chat_id: chatId,
  })),
  updateVoiceCallStatus: async (sessionToken, callId, status, endReason = "") => firstRpcRow(await callRpc("update_voice_call_status", {
    p_session_token: sessionToken,
    p_call_id: callId,
    p_status: status,
    p_end_reason: endReason,
  })),
  sendCallSignal: (sessionToken, callId, signalType, payload = {}) => callRpc("send_call_signal", {
    p_session_token: sessionToken,
    p_call_id: callId,
    p_signal_type: signalType,
    p_payload: payload || {},
  }, { minimal: true }),
  listCallSignals: (sessionToken, callId) => callRpc("list_call_signals", {
    p_session_token: sessionToken,
    p_call_id: callId,
  }),
  listPendingCallOffers: (sessionToken) => callRpc("list_pending_call_offers", {
    p_session_token: sessionToken,
  }),
  listVoiceCalls: (sessionToken, limit = 50) => callRpc("list_voice_calls", {
    p_session_token: sessionToken,
    p_limit: limit,
  }),
  sendCallPush: (sessionToken, chatId, callId, callerName, callerVid) => callFunction("send-push", {
    session_token: sessionToken,
    scope: "call",
    scope_id: chatId,
    call_id: callId,
    caller_name: callerName || "REACH",
    caller_vid: callerVid || "",
    content_type: "call",
    content: "Incoming voice call",
  }),
};
