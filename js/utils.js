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

  chatRowTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return Utils.formatTime(ts);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short" });
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

  jsString(value) {
    return Utils.escape(JSON.stringify(String(value ?? "")));
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
      senderName: raw.sender_name || raw.senderName || raw.display_name || raw.displayName || "",
      isMine: raw.is_mine === true || raw.isMine === true || raw.is_outgoing === true || raw.isOutgoing === true || raw.sent_by_me === true || raw.sentByMe === true,
      contentType: raw.content_type || raw.contentType || "text",
      content: raw.content || "",
      sentAt: raw.sent_at || raw.sentAt || "",
      deliveredAt: raw.delivered_at || raw.deliveredAt || "",
      seenAt: raw.seen_at || raw.seenAt || "",
      editedAt: raw.edited_at || raw.editedAt || "",
      deletedAt: raw.deleted_at || raw.deletedAt || "",
      localOnly: raw.local_only === true || raw.localOnly === true,
      failed: raw.failed === true || raw.status === "failed",
    };
  },

  statusIcon(msg, myVid) {
    if (!Utils.isOwnMessage(msg, myVid)) return "";
    if (msg.failed) return '<span class="bubble-ticks failed">&#10003;</span>';
    if (msg.seenAt) return '<span class="bubble-ticks seen">&#10003;&#10003;</span>';
    if (msg.deliveredAt || !msg.localOnly) return '<span class="bubble-ticks">&#10003;&#10003;</span>';
    return '<span class="bubble-ticks">&#10003;</span>';
  },

  isOwnMessage(message, myVid) {
    const senderVid = Utils.normalizeVid(message.senderVid);
    const ownVid = Utils.normalizeVid(myVid);
    return message.isMine === true || (!!senderVid && !!ownVid && senderVid === ownVid);
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
    micOff: '<path d="m4 4 16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 9v2a3 3 0 0 0 4.9 2.3M15 10.1V6a3 3 0 0 0-5.1-2.1M5 11a7 7 0 0 0 9.1 6.7M19 11a7 7 0 0 1-1.8 4.7M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    call: '<path d="M7.2 4.5 9.5 4c.7-.1 1.3.3 1.5 1l.7 2.5c.2.6-.1 1.3-.7 1.6l-1.2.7a10.5 10.5 0 0 0 4.4 4.4l.7-1.2c.3-.6 1-.9 1.6-.7l2.5.7c.7.2 1.1.8 1 1.5l-.5 2.3c-.2.9-1 1.5-1.9 1.5A13.8 13.8 0 0 1 5.7 6.4c0-.9.6-1.7 1.5-1.9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    group: '<path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 19c.7-3 2.7-5 5-5s4.3 2 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.8 15c2.3.2 4 1.8 4.7 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    chat: '<path d="M5 6.5C5 5.12 6.12 4 7.5 4h9C17.88 4 19 5.12 19 6.5v6C19 13.88 17.88 15 16.5 15H10l-4.2 3.15c-.33.25-.8.01-.8-.4V6.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8h8M8 11h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 9.5a4 4 0 0 1 0 5M18.8 7a8 8 0 0 1 0 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    speakerOff: '<path d="m4 4 16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 9v6h4l5 4v-6M13 8.5V5L9.7 7.6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    more: '<circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/>',
    back: '<path d="M15 6 9 12l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.7"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m14 8 3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    camera: '<path d="M8 7 9.5 5h5L16 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="1.7"/>',
    shield: '<path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    mail: '<rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m5 8 7 5 7-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>',
    eyeOff: '<path d="m4 4 16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 5.4A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a15 15 0 0 1-3.2 3.8M14.1 14.1A3 3 0 0 1 9.9 9.9M6.3 7.2C3.8 8.8 2.5 12 2.5 12s3.5 7 9.5 7c1 0 1.9-.2 2.8-.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    block: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="m7 17 10-10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function showInputSheet(title, placeholder, defaultValue, onConfirm, options = {}) {
  document.getElementById("input-sheet")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "input-sheet";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="action-sheet input-sheet">
      <div class="action-title">${Utils.escape(title)}</div>
      <input id="input-sheet-field" type="${Utils.escape(options.type || "text")}" inputmode="${Utils.escape(options.inputMode || "text")}"
        placeholder="${Utils.escape(placeholder)}" value="${Utils.escape(defaultValue || "")}" autocomplete="off">
      <button class="confirm" data-confirm="1">${Utils.escape(options.confirmLabel || "Save")}</button>
      <button class="cancel" data-cancel="1">Cancel</button>
    </div>`;
  overlay.addEventListener("click", async (event) => {
    if (event.target === overlay || event.target.dataset.cancel) {
      overlay.remove();
      return;
    }
    if (event.target.dataset.confirm) {
      const button = event.target;
      const field = document.getElementById("input-sheet-field");
      const value = field ? field.value.trim() : "";
      button.disabled = true;
      try {
        await onConfirm(value);
        overlay.remove();
      } catch (error) {
        button.disabled = false;
        showToast(error.message || "Could not save");
      }
    }
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => document.getElementById("input-sheet-field")?.focus());
}
