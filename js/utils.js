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

  normalizeMessage(raw) {
    return {
      id: raw.id || "",
      chatId: raw.chat_id || raw.chatId || "",
      senderVid: raw.sender_vid || raw.senderVid || "",
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
    if (msg.senderVid !== myVid) return "";
    if (msg.seenAt) return '<span class="bubble-ticks seen">✓✓</span>';
    if (msg.deliveredAt) return '<span class="bubble-ticks">✓✓</span>';
    return '<span class="bubble-ticks">✓</span>';
  },
};

window.Screen = window.Screen || {};

function Icon(name, size = 22) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    search: '<circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.9"/><path d="m16 16 3.5 3.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    send: '<path d="M4 12 20 5l-7 16-2-7-7-2Z" fill="currentColor"/>',
    mic: '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    more: '<circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/>',
    back: '<path d="M15 6 9 12l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.7"/>',
    shield: '<path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    mail: '<rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m5 8 7 5 7-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/>',
    block: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="m7 17 10-10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[name] || ""}</svg>`;
}
