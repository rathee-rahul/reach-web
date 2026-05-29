let chatListTimer = null;
let chatListTypingById = {};
let groupListTypingById = {};

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
  if (!contacts.length && !groups.length) {
    el.innerHTML = `
      <div class="empty-card chat-empty-action">
        <b>No chats yet</b>
        <span>Add a REACH ID to start messaging.</span>
        <button class="reach-primary add-contact-cta" onclick="Screen.addContact('chats')">${Icon("plus", 18)}<span>Add Contact</span></button>
      </div>`;
    return;
  }
  const entries = contacts.map((contact) => ({
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
      const latest = typingName !== undefined
        ? `${typingName || "Someone"} typing...`
        : (group.last_message || group.lastMessage || `${memberCount} member${memberCount === 1 ? "" : "s"}`);
      const unread = Number(group.unread_count || group.unreadCount || 0);
      return `
        <div class="row" onclick="go('group/${encodeURIComponent(id)}/${encodeURIComponent(name)}')">
          <div class="group-avatar">G</div>
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
    const latest = typing ? "typing..." : (contact.last_message || contact.lastMessage || "Tap to open chat");
    const time = contact.last_message_at || contact.lastMessageAt || "";
    const unread = Number(contact.unread_count || contact.unreadCount || 0);
    return `
      <div class="row" onclick="go('chat/${encodeURIComponent(chatId)}/${encodeURIComponent(name)}/${encodeURIComponent(vid)}')">
        ${Avatar(name, avatar, 44, photo)}
        <div class="row-info">
          <div class="row-name">${Utils.escape(name)}</div>
          <div class="row-sub ${typing ? "typing" : ""}">${Utils.escape(latest || "Tap to open chat")}</div>
        </div>
        <div class="row-meta">
          <span class="row-time">${Utils.chatRowTime(time)}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
        </div>
      </div>`;
  }).join("");
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
        const latest = String(contact.last_message || contact.lastMessage || "").toLowerCase();
        return name.includes(q) || vid.includes(q) || latest.includes(q);
      })
    : window._allChatContacts;
  const groups = window._allChatGroups || [];
  const filteredGroups = q
    ? groups.filter((group) => {
        const name = String(group.name || group.group_name || "").toLowerCase();
        const latest = String(group.last_message || group.lastMessage || "").toLowerCase();
        return name.includes(q) || latest.includes(q);
      })
    : groups;
  renderChatList(filteredContacts, filteredGroups);
}
