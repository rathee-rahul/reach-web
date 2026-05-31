let chatListTimer = null;
let chatListTypingById = {};
let groupListTypingById = {};
let chatRowLongPressTimer = null;

window.addEventListener("hashchange", () => {
  clearInterval(chatListTimer);
  chatListTimer = null;
});

Screen.chats = async function() {
  const vid = Auth.getVid();
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <div class="app-brand"><b>REACH</b><span>Chats</span></div>
        <button class="vid-chip" onclick="copyVid()" title="Copy REACH ID">#${Utils.escape(vid)}</button>
        <button class="header-icon-btn" onclick="Screen.createGroup()" title="Create group">${Icon("group", 21)}</button>
        <button class="header-icon-btn primary" onclick="Screen.addContact('chats')" title="Add REACH ID">${Icon("plus")}</button>
      </div>
      <div class="dl-banner">
        <div class="dl-banner-text">Use the Android app for app lock, notification badges, voice notes and full device features.</div>
        <button class="dl-banner-btn" onclick="openApkLink()">Download</button>
      </div>
      <div class="search-bar">
        <input type="text" placeholder="Search chats..." id="chat-search" oninput="filterChats(this.value)">
      </div>
      <div class="scroll" id="chat-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
      ${BottomNav("chats")}
    </div>`;

  const ownerVid = Auth.getVid();
  LocalCache.cleanOldChats().catch(() => {});
  if (!window._offlineListenerAdded) {
    window._offlineListenerAdded = true;
    window.addEventListener("beforeunload", () => Api.setOffline(Auth.getToken()).catch(() => {}));
  }
  const cachedContacts = await LocalCache.getChatList(ownerVid);
  if (cachedContacts.length) {
    window._allChatContacts = cachedContacts;
    renderChatList(cachedContacts, window._allChatGroups || []);
  }

  await loadChatListFromServer({ showError: !cachedContacts.length });
  clearInterval(chatListTimer);
  chatListTimer = setInterval(() => {
    if (location.hash.slice(1).split("/")[0] === "chats" || !location.hash.slice(1)) {
      loadChatListFromServer({ showError: false, preserveSearch: true });
    }
  }, 2500);
};

async function loadChatListFromServer(options = {}) {
  const ownerVid = Auth.getVid();
  Api.touchLastSeen(Auth.getToken()).catch(() => {});
  try {
    const [contactData, groupData] = await Promise.all([
      Api.listContacts(Auth.getToken()),
      Api.listGroups(Auth.getToken()),
    ]);
    const contacts = contactData.contacts || contactData || [];
    const groups = groupData.groups || groupData || [];
    window._allChatContacts = contacts;
    window._allChatGroups = groups;
    await LocalCache.saveChatList(ownerVid, contacts);
    loadChatListTypingStatuses(contacts, groups);
    if (options.preserveSearch) {
      filterChats(document.getElementById("chat-search")?.value || "");
    } else {
      renderChatList(contacts, groups);
    }
  } catch (error) {
    if (window._allChatContacts?.length) {
      showToast("Showing saved chats");
    } else if (options.showError) {
      showToast(error.message || "Failed to load chats");
    }
  }
}

function renderChatList(contacts, groups = []) {
  const el = document.getElementById("chat-list");
  if (!el) return;
  const visibleContacts = (contacts || []).filter((contact) => !isWebChatHidden(contact.chat_id || contact.chatId || ""));
  if (!visibleContacts.length && !groups.length) {
    el.innerHTML = `
      <div class="empty-card chat-empty-action">
        <b>No chats yet</b>
        <span>Add a REACH ID to start messaging.</span>
        <button class="reach-primary add-contact-cta" onclick="Screen.addContact('chats')">${Icon("plus", 18)}<span>Add Contact</span></button>
      </div>`;
    return;
  }
  const entries = visibleContacts.map((contact) => ({
    type: "contact",
    value: contact,
    time: contact.last_message_at || contact.lastMessageAt || "",
  })).concat(groups.map((group) => ({
    type: "group",
    value: group,
    time: group.last_message_at || group.lastMessageAt || group.created_at || group.createdAt || "",
  })));
  entries.sort((left, right) => new Date(right.time || 0) - new Date(left.time || 0));
  el.innerHTML = entries.map((entry) => {
    if (entry.type === "group") {
      const group = entry.value;
      const name = group.name || group.group_name || "Group";
      const id = group.id || group.group_id || "";
      const memberCount = Number(group.member_count || group.memberCount || 0);
      const typingName = groupListTypingById[id];
      const rawLatest = group.last_message || group.lastMessage || `${memberCount} member${memberCount === 1 ? "" : "s"}`;
      const latest = typingName !== undefined
        ? `${typingName || "Someone"} typing...`
        : chatListVisibleMessage(rawLatest);
      const unread = Number(group.unread_count || group.unreadCount || 0);
      return `
        <div class="row" onclick="go('group/${encodeURIComponent(id)}/${encodeURIComponent(name)}')">
          <div class="group-avatar">${Icon("group", 22)}</div>
          <div class="row-info">
            <div class="row-name">${Utils.escape(name)}</div>
            <div class="row-sub ${typingName !== undefined ? "typing" : ""}">${Utils.escape(latest)}</div>
          </div>
          <div class="row-meta">
            <span class="row-time">${Utils.chatRowTime(entry.time)}</span>
            ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
          </div>
        </div>`;
    }
    const contact = entry.value;
    const name = contact.display_name || contact.displayName || "REACH User";
    const vid = contact.vid || contact.contact_vid || contact.contactVid || "";
    const chatId = contact.chat_id || contact.chatId || "";
    const avatar = contact.avatar_id || contact.avatarId || 1;
    const photo = contact.profile_photo || contact.profilePhoto || "";
    const typing = chatListTypingById[chatId] === true;
    const latest = typing ? "typing..." : chatListVisibleMessage(contact.last_message || contact.lastMessage || "Tap to open chat");
    const time = contact.last_message_at || contact.lastMessageAt || "";
    const unread = Number(contact.unread_count || contact.unreadCount || 0);
    const preview = chatPreviewAfterClear(chatId, latest, time);
    const openTarget = `chat/${encodeURIComponent(chatId)}/${encodeURIComponent(name)}/${encodeURIComponent(vid)}`;
    return `
      <div class="row" data-contact-chat-id="${Utils.escape(chatId)}" data-contact-vid="${Utils.escape(vid)}" onclick="openChatRow('${Utils.escape(openTarget)}')">
        <button class="chat-row-avatar" onclick="event.stopPropagation(); showAvatarZoom(${Utils.jsString(name)}, ${Utils.jsString(vid)}, ${Number(avatar) || 1}, ${Utils.jsString(photo)})" title="View profile photo">
          ${Avatar(name, avatar, 44, photo)}
        </button>
        <div class="row-info">
          <div class="row-name">${Utils.escape(name)}</div>
          <div class="row-sub ${typing ? "typing" : ""}">${Utils.escape(preview || "Connected on REACH")}</div>
        </div>
        <div class="row-meta">
          <span class="row-time">${Utils.chatRowTime(time)}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
        </div>
      </div>`;
  }).join("");
  attachChatRowMenus();
}

function openChatRow(target) {
  if (window._chatRowMenuJustOpened) return;
  go(target);
}

function attachChatRowMenus() {
  clearTimeout(chatRowLongPressTimer);
  document.querySelectorAll("[data-contact-chat-id]").forEach((row) => {
    row.oncontextmenu = (event) => {
      event.preventDefault();
      showContactChatActionsFromRow(row);
    };
    row.onpointerdown = (event) => {
      if (event.target.closest(".chat-row-avatar")) return;
      clearTimeout(chatRowLongPressTimer);
      chatRowLongPressTimer = setTimeout(() => showContactChatActionsFromRow(row), 620);
    };
    row.onpointermove = () => clearTimeout(chatRowLongPressTimer);
    row.onpointerup = () => clearTimeout(chatRowLongPressTimer);
    row.onpointercancel = () => clearTimeout(chatRowLongPressTimer);
  });
}

function showContactChatActionsFromRow(row) {
  const chatId = row.dataset.contactChatId || "";
  const contact = (window._allChatContacts || []).find((item) => (item.chat_id || item.chatId || "") === chatId);
  if (!contact) return;
  window._chatRowMenuJustOpened = true;
  setTimeout(() => { window._chatRowMenuJustOpened = false; }, 700);
  showContactChatActions(contact);
}

function showContactChatActions(contact) {
  const chatId = contact.chat_id || contact.chatId || "";
  const vid = contact.vid || contact.contact_vid || contact.contactVid || "";
  const name = contact.display_name || contact.displayName || "REACH User";
  showActionSheet(name, [
    ["Clear chat", () => clearWebChat(chatId)],
    ["Delete", () => deleteWebChat(chatId)],
    ["Block", () => blockWebChat(chatId, vid)],
  ]);
}

async function clearWebChat(chatId) {
  if (!chatId) return;
  setWebChatClearedAt(chatId, Date.now());
  await LocalCache.clearMessages(Auth.getVid(), chatId).catch(() => {});
  if (currentChatId === chatId && Array.isArray(currentChatMessages)) {
    currentChatMessages = [];
    if (typeof renderMessages === "function") renderMessages([], Auth.getVid());
  }
  showToast("Chat cleared");
  filterChats(document.getElementById("chat-search")?.value || "");
}

async function deleteWebChat(chatId) {
  if (!chatId) return;
  await clearWebChat(chatId);
  setWebChatHidden(chatId, true);
  showToast("Chat deleted");
  filterChats(document.getElementById("chat-search")?.value || "");
}

async function blockWebChat(chatId, vid) {
  const targetVid = Utils.normalizeVid(vid);
  if (!targetVid) return showToast("REACH ID unavailable");
  try {
    await Api.blockUser(Auth.getToken(), targetVid, "silent");
    setWebChatHidden(chatId, true);
    showToast("User blocked");
    filterChats(document.getElementById("chat-search")?.value || "");
  } catch (error) {
    showToast(error.message || "Block failed");
  }
}

function webChatStateKey(name) {
  return `reach_web_${name}_${Auth.getVid() || "anon"}`;
}

function readWebChatJson(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(webChatStateKey(name)) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeWebChatJson(name, value) {
  localStorage.setItem(webChatStateKey(name), JSON.stringify(value));
}

function getWebChatClearedAt(chatId) {
  return Number(readWebChatJson("cleared_chats", {})[chatId] || 0);
}

function setWebChatClearedAt(chatId, value) {
  const cleared = readWebChatJson("cleared_chats", {});
  cleared[chatId] = value;
  writeWebChatJson("cleared_chats", cleared);
}

function isWebChatHidden(chatId) {
  return readWebChatJson("hidden_chats", []).includes(chatId);
}

function setWebChatHidden(chatId, hidden) {
  const current = new Set(readWebChatJson("hidden_chats", []));
  if (hidden) current.add(chatId);
  else current.delete(chatId);
  writeWebChatJson("hidden_chats", Array.from(current));
}

function isAfterWebChatClear(chatId, timestamp) {
  const clearAt = getWebChatClearedAt(chatId);
  if (!clearAt) return true;
  const sentAt = new Date(timestamp || 0).getTime();
  return Number.isFinite(sentAt) && sentAt > clearAt;
}

function chatPreviewAfterClear(chatId, latest, timestamp) {
  if (getWebChatClearedAt(chatId) && !isAfterWebChatClear(chatId, timestamp)) return "Chat cleared";
  return latest || "Connected on REACH";
}

function chatListVisibleMessage(value) {
  if (typeof displayMessageContent === "function") {
    return displayMessageContent(value);
  }
  return String(value || "").replace(/^\[\[REACH_REPLY_V1\]\][^\n]*\n/, "");
}

function visibleWebChatMessages(chatId, messages) {
  return (messages || []).filter((message) => isAfterWebChatClear(chatId, message.sentAt));
}

async function loadChatListTypingStatuses(contacts, groups) {
  let changed = false;
  await Promise.all(contacts.map(async (contact) => {
    const chatId = contact.chat_id || contact.chatId || "";
    if (!chatId) return;
    try {
      const data = await Api.getTyping(Auth.getToken(), chatId);
      const typing = data.typing === true || data.is_typing === true || data.isTyping === true;
      if (chatListTypingById[chatId] !== typing) {
        chatListTypingById[chatId] = typing;
        changed = true;
      }
    } catch {}
  }));
  await Promise.all(groups.map(async (group) => {
    const id = group.id || group.group_id || "";
    if (!id) return;
    try {
      const data = await Api.getGroupTyping(Auth.getToken(), id);
      const typing = data.typing === true || data.is_typing === true || data.isTyping === true;
      const name = String(data.typing_name || data.typingName || "");
      const value = typing ? name : undefined;
      if (groupListTypingById[id] !== value) {
        if (value === undefined) delete groupListTypingById[id];
        else groupListTypingById[id] = value;
        changed = true;
      }
    } catch {}
  }));
  if (changed && (location.hash.slice(1).split("/")[0] === "chats" || !location.hash.slice(1))) {
    filterChats(document.getElementById("chat-search")?.value || "");
  }
}

function filterChats(query) {
  if (!window._allChatContacts) return;
  const q = query.toLowerCase().trim();
  const filteredContacts = q
    ? window._allChatContacts.filter((contact) => {
        const name = (contact.display_name || contact.displayName || "").toLowerCase();
        const vid = String(contact.vid || contact.contact_vid || contact.contactVid || "");
        const latest = chatListVisibleMessage(contact.last_message || contact.lastMessage || "").toLowerCase();
        return name.includes(q) || vid.includes(q) || latest.includes(q);
      })
    : window._allChatContacts;
  const groups = window._allChatGroups || [];
  const filteredGroups = q
    ? groups.filter((group) => {
        const name = String(group.name || group.group_name || "").toLowerCase();
        const latest = chatListVisibleMessage(group.last_message || group.lastMessage || "").toLowerCase();
        return name.includes(q) || latest.includes(q);
      })
    : groups;
  renderChatList(filteredContacts, filteredGroups);
}
