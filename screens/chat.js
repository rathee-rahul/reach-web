let chatPresenceTimer = null;
let chatStatusTimer = null;
let chatTypingTimer = null;
let typingPollTimer = null;
let currentChatMessages = [];
let currentChatId = "";
const recentSentMessages = [];
const SENT_MARKERS_KEY = "reach_sent_message_markers";

window.addEventListener("hashchange", () => {
  clearInterval(chatPresenceTimer);
  clearInterval(chatStatusTimer);
  clearTimeout(chatTypingTimer);
  clearInterval(typingPollTimer);
  chatPresenceTimer = null;
  chatStatusTimer = null;
  chatTypingTimer = null;
  typingPollTimer = null;
});

Screen.chat = async function(chatId, contactName, contactVid) {
  currentChatId = chatId;
  const chatArg = Utils.jsString(chatId);
  const contactVidArg = Utils.jsString(contactVid || "");
  const contactIdLabel = contactVid ? `ID ${Utils.escape(contactVid)}` : "ID unavailable";
  const contact = await findChatContact(chatId, contactVid);
  const headerName = contact?.display_name || contact?.displayName || contactName || "Chat";
  const headerAvatar = contact?.avatar_id || contact?.avatarId || 1;
  const headerPhoto = contact?.profile_photo || contact?.profilePhoto || "";
  stopRealtime();
  clearInterval(chatPresenceTimer);
  clearInterval(chatStatusTimer);
  clearTimeout(chatTypingTimer);
  clearInterval(typingPollTimer);
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="chat-back-btn" onclick="go('chats')" title="Back">${Icon("back", 28)}</button>
        ${Avatar(headerName, headerAvatar, 36, headerPhoto)}
        <div class="chat-title-area">
          <div class="chat-title-name">${Utils.escape(headerName)}</div>
          <div class="chat-subline">
            <span id="presence-label"></span>
            <button class="chat-contact-id" onclick="copyContactVid(${contactVidArg})" title="Copy REACH ID">${contactIdLabel}</button>
          </div>
        </div>
        <button class="plain-icon-btn" onclick="showChatMenu(${chatArg}, ${contactVidArg})" title="Chat options">${Icon("more")}</button>
      </div>
      <div class="chat-retention-note">
        <span>Messages auto-delete from web after ~12 hours. Download the free app to keep your chat history.</span>
        <button onclick="openApkLink()">Get App</button>
      </div>
      <div class="scroll" id="chat-messages" style="background:var(--chat-bg);padding:8px 0;display:flex;flex-direction:column;">
        <div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div>
      </div>
      <div id="typing-label">typing...</div>
      <div class="chat-input-bar">
        <input type="text" id="msg-input" placeholder="Message..." oninput="handleTyping(${chatArg})" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg(${chatArg});}">
        <button class="send-btn" onclick="sendMsg(${chatArg})" title="Send">${Icon("send", 18)}</button>
      </div>
    </div>`;

  await loadMessages(chatId, { showCacheFirst: true });
  markSeenAndRefresh(chatId);
  startPresencePolling(contactVid);
  startTypingPolling(chatId);
  startChatStatusPolling(chatId);
  subscribeToChat(chatId, async () => {
    await loadMessages(chatId);
    markSeenAndRefresh(chatId);
  });
};

async function findChatContact(chatId, contactVid) {
  const contacts = window._allChatContacts?.length
    ? window._allChatContacts
    : await LocalCache.getChatList(Auth.getVid()).catch(() => []);
  const vid = Utils.normalizeVid(contactVid);
  return contacts.find((contact) => {
    const candidateChatId = contact.chat_id || contact.chatId || "";
    const candidateVid = Utils.normalizeVid(contact.vid || contact.contact_vid || contact.contactVid || "");
    return (chatId && candidateChatId === chatId) || (vid && candidateVid === vid);
  });
}

async function loadMessages(chatId, options = {}) {
  let ownerVid = Auth.getVid();
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
    currentChatMessages = preserveOutgoingMessages((data.messages || data || []).map(Utils.normalizeMessage), currentChatMessages, ownerVid);
    const reconciledVid = reconcileVidFromMessages(currentChatMessages, ownerVid);
    if (reconciledVid && reconciledVid !== ownerVid) ownerVid = reconciledVid;
    await LocalCache.saveMessages(ownerVid, chatId, currentChatMessages);
    renderMessages(currentChatMessages, ownerVid);
    if (options.scroll !== false) scrollToBottom();
  } catch (error) {
    if (renderedCache) {
      if (!options.silent) showToast("Showing saved messages");
    } else {
      const cachedMessages = await LocalCache.getMessages(ownerVid, chatId);
      if (cachedMessages.length) {
        currentChatMessages = cachedMessages;
        renderMessages(currentChatMessages, ownerVid);
        if (options.scroll !== false) scrollToBottom();
        if (!options.silent) showToast("Showing saved messages");
      } else {
        if (!options.silent) showToast(error.message || "Failed to load messages");
      }
    }
  }
}

async function markSeenAndRefresh(chatId) {
  try {
    await Api.markSeen(Auth.getToken(), chatId);
    if (currentChatId === chatId) await loadMessages(chatId, { scroll: false, silent: true });
  } catch {}
}

function startChatStatusPolling(chatId) {
  clearInterval(chatStatusTimer);
  chatStatusTimer = setInterval(() => {
    if (currentChatId === chatId) loadMessages(chatId, { scroll: false, silent: true });
  }, 2500);
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
    const isOut = Utils.isOwnMessage(message, myVid);
    const meta = `${Utils.formatTime(message.sentAt)} ${isOut ? Utils.statusIcon(message, myVid) : ""}`;
    html += `
      <div class="bubble-wrap ${isOut ? "out" : "in"}" data-id="${Utils.escape(message.id)}">
        <div class="bubble ${isOut ? "out" : "in"}" onclick="showMsgMenu(${Utils.jsString(message.id)})">
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

function startTypingPolling(chatId) {
  clearInterval(typingPollTimer);
  const run = async () => {
    try {
      const data = await Api.getTyping(Auth.getToken(), chatId);
      const isTyping = data.typing === true || data.is_typing === true || data.isTyping === true;
      const label = document.getElementById("typing-label");
      if (label) label.style.display = isTyping ? "block" : "none";
    } catch {}
  };
  run();
  typingPollTimer = setInterval(run, 1000);
}

async function sendMsg(chatId) {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  Api.setTyping(Auth.getToken(), chatId, false).catch(() => {});
  const tempId = `temp-${Date.now()}`;
  const tempMessage = Utils.normalizeMessage({
    id: tempId,
    chatId,
    senderVid: Auth.getVid(),
    isMine: true,
    contentType: "text",
    content: text,
    sentAt: new Date().toISOString(),
  });
  currentChatMessages = [...currentChatMessages, tempMessage];
  rememberSentMessage(tempMessage);
  renderMessages(currentChatMessages, Auth.getVid());
  scrollToBottom();
  try {
    const data = await Api.sendMessage(Auth.getToken(), chatId, text);
    const savedMessage = Utils.normalizeMessage(data.message || data.messages?.[0] || data);
    const outgoingMessage = { ...savedMessage, content: savedMessage.content || text, sentAt: savedMessage.sentAt || tempMessage.sentAt, isMine: true };
    if (outgoingMessage.senderVid) Auth.reconcileVid(outgoingMessage.senderVid);
    rememberSentMessage(outgoingMessage);
    await loadMessages(chatId);
  } catch (error) {
    showToast(error.message || "Send failed");
    input.value = text;
    currentChatMessages = currentChatMessages.filter((message) => message.id !== tempId);
    renderMessages(currentChatMessages, Auth.getVid());
  }
}

function rememberSentMessage(message) {
  if (!message.content) return;
  const marker = {
    id: message.id || "",
    chatId: message.chatId || currentChatId,
    content: message.content,
    sentAt: message.sentAt || new Date().toISOString(),
  };
  recentSentMessages.push(marker);
  saveSentMarker(marker);
  while (recentSentMessages.length > 30) recentSentMessages.shift();
}

function preserveOutgoingMessages(freshMessages, previousMessages, myVid) {
  const recentOutgoing = previousMessages
    .filter((message) => Utils.isOwnMessage(message, myVid) && message.content)
    .slice(-20);
  const sentMarkers = loadSentMarkers(currentChatId);
  return freshMessages.map((message) => {
    const ownVid = Utils.normalizeVid(myVid);
    if (message.isMine || (ownVid && Utils.normalizeVid(message.senderVid) === ownVid)) {
      return { ...message, isMine: true };
    }
    const match = [...sentMarkers, ...recentSentMessages, ...recentOutgoing].find((oldMessage) => isSameOutgoingMessage(oldMessage, message));
    return match ? { ...message, senderVid: message.senderVid || Utils.normalizeVid(myVid), isMine: true } : message;
  });
}

function reconcileVidFromMessages(messages, currentVid) {
  const ownMessage = messages.find((message) => message.isMine && message.senderVid);
  const ownVid = ownMessage ? Auth.reconcileVid(ownMessage.senderVid) : "";
  if (!ownVid || ownVid === currentVid) return currentVid;
  currentChatMessages = currentChatMessages.map((message) => (
    message.isMine ? { ...message, senderVid: ownVid } : message
  ));
  return ownVid;
}

function loadSentMarkers(chatId) {
  try {
    const markers = JSON.parse(localStorage.getItem(SENT_MARKERS_KEY) || "[]");
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const freshMarkers = markers.filter((marker) => new Date(marker.sentAt || 0).getTime() > cutoff);
    if (freshMarkers.length !== markers.length) {
      localStorage.setItem(SENT_MARKERS_KEY, JSON.stringify(freshMarkers.slice(-80)));
    }
    return freshMarkers.filter((marker) => marker.chatId === chatId);
  } catch {
    return [];
  }
}

function saveSentMarker(marker) {
  try {
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const markers = JSON.parse(localStorage.getItem(SENT_MARKERS_KEY) || "[]")
      .filter((item) => new Date(item.sentAt || 0).getTime() > cutoff);
    const nextMarkers = [...markers, marker].filter((item, index, list) => {
      if (!item.id) return true;
      return list.findIndex((candidate) => candidate.id === item.id) === index;
    }).slice(-80);
    localStorage.setItem(SENT_MARKERS_KEY, JSON.stringify(nextMarkers));
  } catch {}
}

function isSameOutgoingMessage(oldMessage, freshMessage) {
  if (oldMessage.id && freshMessage.id && oldMessage.id === freshMessage.id) return true;
  if (oldMessage.content !== freshMessage.content) return false;
  const oldTime = new Date(oldMessage.sentAt || 0).getTime();
  const freshTime = new Date(freshMessage.sentAt || 0).getTime();
  if (!Number.isFinite(oldTime) || !Number.isFinite(freshTime)) return true;
  return Math.abs(oldTime - freshTime) < 60000;
}

function startPresencePolling(contactVid) {
  clearInterval(chatPresenceTimer);
  setPresenceText(contactVid, "");
  const run = async () => {
    if (!contactVid) return;
    try {
      Api.touchLastSeen(Auth.getToken()).catch(() => {});
      const data = await Api.getContactPresence(Auth.getToken(), contactVid);
      const presence = data.presence || data;
      if (presence.online) {
        setPresenceText(contactVid, "Online");
      } else if (presence.last_seen_at || presence.lastSeenAt) {
        const value = presence.last_seen_at || presence.lastSeenAt;
        setPresenceText(contactVid, `Last seen ${Utils.dateLabel(value)} ${Utils.formatTime(value)}`);
      } else if (presence.visible === false) {
        setPresenceText(contactVid, "");
      } else {
        setPresenceText(contactVid, "Offline");
      }
    } catch {}
  };
  run();
  chatPresenceTimer = setInterval(run, 5000);
}

function setPresenceText(contactVid, text) {
  const label = document.getElementById("presence-label");
  if (!label) return;
  label.classList.toggle("online", text === "Online");
  label.textContent = contactVid && text ? text : "";
}

function showMsgMenu(messageId) {
  const message = currentChatMessages.find((item) => item.id === messageId);
  if (!message) return;
  const mine = Utils.isOwnMessage(message, Auth.getVid());
  const options = mine
    ? [
        ["Copy", () => copyMessage(message.content)],
        ["Info", () => showMessageInfo(message)],
        ["Edit", () => editMsg(message.id, message.content, currentChatId)],
        ["Delete for Everyone", () => deleteMsg(message.id, "everyone", currentChatId)],
        ["Delete for Me", () => deleteMsg(message.id, "me", currentChatId)],
      ]
    : [
        ["Copy", () => copyMessage(message.content)],
        ["Delete for Me", () => deleteMsg(message.id, "me", currentChatId)],
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

function copyContactVid(contactVid) {
  const vid = Utils.normalizeVid(contactVid);
  if (!vid) return showToast("REACH ID unavailable");
  navigator.clipboard?.writeText(vid).then(() => showToast("REACH ID copied")).catch(() => showToast(vid));
}

function showMessageInfo(message) {
  const rows = [
    ["Sent", message.sentAt ? `${Utils.dateLabel(message.sentAt)} ${Utils.formatTime(message.sentAt)}` : "Not available"],
    ["Delivered", message.deliveredAt ? `${Utils.dateLabel(message.deliveredAt)} ${Utils.formatTime(message.deliveredAt)}` : "Not yet"],
    ["Seen", message.seenAt ? `${Utils.dateLabel(message.seenAt)} ${Utils.formatTime(message.seenAt)}` : "Not yet"],
  ];
  showActionSheet("Message info", rows.map(([label, value]) => [`${label}: ${value}`, () => {}]));
}

async function editMsg(messageId, oldContent, chatId) {
  const content = window.prompt("Edit message", oldContent);
  if (!content || content.trim() === oldContent) return;
  try {
    await Api.editMessage(Auth.getToken(), messageId, content.trim());
    await loadMessages(chatId);
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteMsg(messageId, scope, chatId) {
  try {
    await Api.deleteMessage(Auth.getToken(), messageId, scope);
    await loadMessages(chatId);
  } catch (error) {
    showToast(error.message);
  }
}

function showChatMenu(chatId, contactVid) {
  showActionSheet("Chat options", [
    ["Copy REACH ID", () => copyContactVid(contactVid)],
    ["Report user", () => Api.reportUser(Auth.getToken(), contactVid, "reported via web").then(() => showToast("Reported")).catch((error) => showToast(error.message))],
    ["Block user", () => showBlockSheet(contactVid)],
    ["Full chat tools", () => showDownloadModal("Full Chat Tools", "App")],
  ]);
}

function showBlockSheet(contactVid) {
  showActionSheet("Block user", [
    ["Block silently", () => doBlock(contactVid, "silent")],
    ["Block and delete chat", () => doBlock(contactVid, "delete")],
    ["Block and report", () => doBlock(contactVid, "report")],
  ]);
}

async function doBlock(contactVid, blockType) {
  const vid = Utils.normalizeVid(contactVid);
  if (!vid) return showToast("REACH ID unavailable");
  try {
    await Api.blockUser(Auth.getToken(), vid, blockType);
    showToast("User blocked");
    go("chats");
  } catch (error) {
    showToast(error.message || "Block failed");
  }
}
