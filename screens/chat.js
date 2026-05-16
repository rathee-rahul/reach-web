let chatPresenceTimer = null;
let chatTypingTimer = null;
let currentChatMessages = [];

Screen.chat = async function(chatId, contactName, contactVid) {
  stopRealtime();
  clearInterval(chatPresenceTimer);
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="plain-icon-btn" onclick="go('chats')" title="Back">${Icon("back")}</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(contactName || "Chat")}</div>
          <div id="presence-label" style="font-size:12px;color:var(--muted);">ID ${Utils.escape(contactVid || "")}</div>
        </div>
        <button class="plain-icon-btn" onclick="showChatMenu('${chatId}', '${contactVid || ""}')" title="Chat options">${Icon("more")}</button>
      </div>
      <div class="scroll" id="chat-messages" style="background:var(--chat-bg);padding:8px 0;display:flex;flex-direction:column;">
        <div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div>
      </div>
      <div id="typing-label" style="display:none;background:var(--chat-bg);padding:0 14px 6px;color:var(--muted);font-size:12px;">typing...</div>
      <div class="chat-input-bar">
        <input type="text" id="msg-input" placeholder="Message..." oninput="handleTyping('${chatId}')" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg('${chatId}');}">
        <button class="send-btn" onclick="sendMsg('${chatId}')" title="Send">${Icon("send", 18)}</button>
      </div>
    </div>`;

  await loadMessages(chatId, { showCacheFirst: true });
  Api.markSeen(Auth.getToken(), chatId).catch(() => {});
  startPresencePolling(contactVid);
  subscribeToChat(chatId, async () => {
    await loadMessages(chatId);
    Api.markSeen(Auth.getToken(), chatId).catch(() => {});
  });
};

async function loadMessages(chatId, options = {}) {
  const ownerVid = Auth.getVid();
  let renderedCache = false;
  if (options.showCacheFirst) {
    const cachedMessages = await LocalCache.getMessages(ownerVid, chatId);
    if (cachedMessages.length) {
      currentChatMessages = cachedMessages;
      renderMessages(currentChatMessages, ownerVid);
      scrollToBottom();
      renderedCache = true;
    }
  }
  try {
    const data = await Api.listMessages(Auth.getToken(), chatId);
    currentChatMessages = (data.messages || data || []).map(Utils.normalizeMessage);
    await LocalCache.saveMessages(ownerVid, chatId, currentChatMessages);
    renderMessages(currentChatMessages, ownerVid);
    scrollToBottom();
  } catch (error) {
    if (renderedCache) {
      showToast("Showing saved messages");
    } else {
      const cachedMessages = await LocalCache.getMessages(ownerVid, chatId);
      if (cachedMessages.length) {
        currentChatMessages = cachedMessages;
        renderMessages(currentChatMessages, ownerVid);
        scrollToBottom();
        showToast("Showing saved messages");
      } else {
        showToast(error.message || "Failed to load messages");
      }
    }
  }
}

function renderMessages(messages, myVid) {
  const el = document.getElementById("chat-messages");
  if (!el) return;
  if (!messages.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No messages yet</div>';
    return;
  }
  let lastDate = "";
  let html = "";
  messages.forEach((message) => {
    if (message.deletedAt) return;
    const label = Utils.dateLabel(message.sentAt);
    if (label !== lastDate) {
      html += `<div class="date-pill"><span>${label}</span></div>`;
      lastDate = label;
    }
    const isOut = message.senderVid === myVid;
    const meta = `${Utils.formatTime(message.sentAt)} ${isOut ? Utils.statusIcon(message, myVid) : ""}`;
    html += `
      <div class="bubble-wrap ${isOut ? "out" : "in"}" data-id="${Utils.escape(message.id)}">
        <div class="bubble ${isOut ? "out" : "in"}" onclick="showMsgMenu('${Utils.escape(message.id)}')">
          <div>${Utils.escape(message.content)}</div>
          <div class="bubble-meta">${meta}</div>
        </div>
      </div>`;
  });
  el.innerHTML = html;
}

function scrollToBottom() {
  const el = document.getElementById("chat-messages");
  if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function handleTyping(chatId) {
  Api.setTyping(Auth.getToken(), chatId, true).catch(() => {});
  clearTimeout(chatTypingTimer);
  chatTypingTimer = setTimeout(() => Api.setTyping(Auth.getToken(), chatId, false).catch(() => {}), 2500);
}

async function sendMsg(chatId) {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  Api.setTyping(Auth.getToken(), chatId, false).catch(() => {});
  try {
    await Api.sendMessage(Auth.getToken(), chatId, text);
    await loadMessages(chatId);
  } catch (error) {
    showToast(error.message || "Send failed");
    input.value = text;
  }
}

function startPresencePolling(contactVid) {
  clearInterval(chatPresenceTimer);
  const run = async () => {
    if (!contactVid) return;
    try {
      const data = await Api.getContactPresence(Auth.getToken(), contactVid);
      const presence = data.presence || data;
      const label = document.getElementById("presence-label");
      if (!label) return;
      if (presence.online) {
        label.textContent = "Online";
      } else if (presence.last_seen_at || presence.lastSeenAt) {
        const value = presence.last_seen_at || presence.lastSeenAt;
        label.textContent = `Last seen ${Utils.dateLabel(value)} ${Utils.formatTime(value)}`;
      }
    } catch {}
  };
  run();
  chatPresenceTimer = setInterval(run, 5000);
}

function showMsgMenu(messageId) {
  const message = currentChatMessages.find((item) => item.id === messageId);
  if (!message) return;
  const mine = message.senderVid === Auth.getVid();
  const options = mine
    ? [
        ["Copy", () => copyMessage(message.content)],
        ["Info", () => showMessageInfo(message)],
        ["Edit", () => editMsg(message.id, message.content)],
        ["Delete for Everyone", () => deleteMsg(message.id, "everyone")],
        ["Delete for Me", () => deleteMsg(message.id, "me")],
      ]
    : [
        ["Copy", () => copyMessage(message.content)],
        ["Delete for Me", () => deleteMsg(message.id, "me")],
      ];
  showActionSheet("Message options", options);
}

function showActionSheet(title, options) {
  document.getElementById("action-sheet")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "action-sheet";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="action-sheet">
      <div class="action-title">${Utils.escape(title)}</div>
      ${options.map(([label], index) => `<button data-action="${index}">${Utils.escape(label)}</button>`).join("")}
      <button class="cancel" data-cancel="1">Cancel</button>
    </div>`;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.dataset.cancel) overlay.remove();
    const action = event.target.dataset.action;
    if (action != null) {
      overlay.remove();
      options[Number(action)][1]();
    }
  });
  document.body.appendChild(overlay);
}

function copyMessage(content) {
  navigator.clipboard?.writeText(content).then(() => showToast("Message copied")).catch(() => showToast("Copy failed"));
}

function showMessageInfo(message) {
  const rows = [
    ["Sent", message.sentAt ? `${Utils.dateLabel(message.sentAt)} ${Utils.formatTime(message.sentAt)}` : "Not available"],
    ["Delivered", message.deliveredAt ? `${Utils.dateLabel(message.deliveredAt)} ${Utils.formatTime(message.deliveredAt)}` : "Not yet"],
    ["Seen", message.seenAt ? `${Utils.dateLabel(message.seenAt)} ${Utils.formatTime(message.seenAt)}` : "Not yet"],
  ];
  showActionSheet("Message info", rows.map(([label, value]) => [`${label}: ${value}`, () => {}]));
}

async function editMsg(messageId, oldContent) {
  const content = window.prompt("Edit message", oldContent);
  if (!content || content.trim() === oldContent) return;
  try {
    await Api.editMessage(Auth.getToken(), messageId, content.trim());
    await loadMessages(Router.parse().params.id);
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteMsg(messageId, scope) {
  try {
    await Api.deleteMessage(Auth.getToken(), messageId, scope);
    await loadMessages(Router.parse().params.id);
  } catch (error) {
    showToast(error.message);
  }
}

function showChatMenu(chatId, contactVid) {
  showActionSheet("Chat options", [
    ["Block user", () => showBlockOptions(contactVid)],
    ["Report user", () => Api.reportUser(Auth.getToken(), contactVid, "reported via web").then(() => showToast("Reported")).catch((error) => showToast(error.message))],
    ["Android-only features", () => showDownloadModal("Full Chat Tools", "App")],
  ]);
}

function showBlockOptions(contactVid) {
  showActionSheet("Block user", [
    ["Silent block", () => blockContact(contactVid, "silent")],
    ["Delete chat and block", () => blockContact(contactVid, "delete")],
    ["Delete, report and block", () => blockContact(contactVid, "report")],
  ]);
}

function blockContact(contactVid, type) {
  Api.blockUser(Auth.getToken(), contactVid, type)
    .then(() => { showToast("User blocked"); go("chats"); })
    .catch((error) => showToast(error.message));
}
