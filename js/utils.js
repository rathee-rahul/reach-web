const Utils = {
  formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  },

  dateLabel(ts) {
    if (!ts) return "Today";
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  },

  avatarColor(avatarId) {
    const colors = ["#1A7A5E", "#2E5EA0", "#7A4EA0", "#A04E4E", "#4E7A9E", "#6B7A4E"];
    return colors[(avatarId || 1) % colors.length];
  },

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  normalizeVid(value) {
    return String(value ?? "").replace(/[^0-9]/g, "").slice(0, 8);
  },

  normalizeMessage(raw) {
    const senderVid = Utils.normalizeVid(
      raw.sender_vid
      || raw.senderVid
      || raw.sender
      || raw.from_vid
      || raw.fromVid
      || raw.from
      || raw.sender_id
      || raw.senderId
      || raw.sender_reach_id
      || raw.senderReachId
      || raw.vid
      || ""
    );
    return {
      id: raw.id || "",
      chatId: raw.chat_id || raw.chatId || "",
      senderVid,
      isMine: raw.is_mine === true || raw.isMine === true || raw.is_outgoing === true || raw.isOutgoing === true || raw.sent_by_me === true || raw.sentByMe === true,
      contentType: raw.content_type || raw.contentType || "text",
      content: raw.content || "",
      sentAt: raw.sent_at || raw.sentAt || "",
      deliveredAt: raw.delivered_at || raw.deliveredAt || "",
      seenAt: raw.seen_at || raw.seenAt || "",
      editedAt: raw.edited_at || raw.editedAt || "",
      deletedAt: raw.deleted_at || raw.deletedAt || "",
    };
  },

  statusIcon(msg, myVid) {
    if (!Utils.isOwnMessage(msg, myVid)) return "";
    if (msg.seenAt) return '<span class="bubble-ticks seen">✓✓</span>';
    if (msg.deliveredAt) return '<span class="bubble-ticks">✓✓</span>';
    return '<span class="bubble-ticks">✓</span>';
  },

  isOwnMessage(message, myVid) {
    return message.isMine === true || Utils.normalizeVid(message.senderVid) === Utils.normalizeVid(myVid);
  },
};

window.Screen = window.Screen || {};

function copyVid() {
  const vid = Auth.getVid();
  navigator.clipboard?.writeText(vid)
    .then(() => showToast("REACH ID copied"))
    .catch(() => showToast(vid));
}

function Icon(name, size = 22) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    search: '<circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.9"/><path d="m16 16 3.5 3.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    send: '<path d="M4 12 20 5l-7 16-2-7-7-2Z" fill="currentColor"/>',
    mic: '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    more: '<circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/>',
    back: '<path d="M15 6 9 12l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.7"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m14 8 3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    camera: '<path d="M8 7 9.5 5h5L16 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="1.7"/>',
    shield: '<path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    mail: '<rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m5 8 7 5 7-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/>',
    block: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="m7 17 10-10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[name] || ""}</svg>`;
}
