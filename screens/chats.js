Screen.chats = async function() {
  const vid = Auth.getVid();
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="header-title">Chats</span>
        <button class="vid-chip" onclick="copyVid()" title="Copy REACH ID">#${Utils.escape(vid)}</button>
        <button class="header-icon-btn" onclick="go('contacts')" title="New chat">${Icon("plus")}</button>
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
  Api.touchLastSeen(Auth.getToken()).catch(() => {});
  if (!window._offlineListenerAdded) {
    window._offlineListenerAdded = true;
    window.addEventListener("beforeunload", () => Api.setOffline(Auth.getToken()).catch(() => {}));
  }
  const cachedContacts = await LocalCache.getChatList(ownerVid);
  if (cachedContacts.length) {
    window._allChatContacts = cachedContacts;
    renderChatList(cachedContacts);
  }

  try {
    const data = await Api.listContacts(Auth.getToken());
    const contacts = data.contacts || data || [];
    window._allChatContacts = contacts;
    await LocalCache.saveChatList(ownerVid, contacts);
    renderChatList(contacts);
  } catch (error) {
    if (cachedContacts.length) {
      showToast("Showing saved chats");
    } else {
      showToast(error.message || "Failed to load chats");
    }
  }
};

function renderChatList(contacts) {
  const el = document.getElementById("chat-list");
  if (!el) return;
  if (!contacts.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 22px;color:var(--muted);">No chats yet. Add a contact to start messaging.</div>';
    return;
  }
  el.innerHTML = contacts.map((contact) => {
    const name = contact.display_name || contact.displayName || "REACH User";
    const vid = contact.vid || contact.contact_vid || contact.contactVid || "";
    const chatId = contact.chat_id || contact.chatId || "";
    const avatar = contact.avatar_id || contact.avatarId || 1;
    const photo = contact.profile_photo || contact.profilePhoto || "";
    const latest = contact.last_message || contact.lastMessage || "Tap to open chat";
    const time = contact.last_message_at || contact.lastMessageAt || "";
    const unread = Number(contact.unread_count || contact.unreadCount || 0);
    return `
      <div class="row" onclick="go('chat/${encodeURIComponent(chatId)}/${encodeURIComponent(name)}/${encodeURIComponent(vid)}')">
        ${Avatar(name, avatar, 44, photo)}
        <div class="row-info">
          <div class="row-name">${Utils.escape(name)}</div>
          <div class="row-sub">${Utils.escape(latest || "Tap to open chat")}</div>
        </div>
        <div class="row-meta">
          <span class="row-time">${Utils.formatTime(time)}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
        </div>
      </div>`;
  }).join("");
}

function filterChats(query) {
  if (!window._allChatContacts) return;
  const q = query.toLowerCase().trim();
  const filtered = q
    ? window._allChatContacts.filter((contact) => {
        const name = (contact.display_name || contact.displayName || "").toLowerCase();
        const vid = String(contact.vid || contact.contact_vid || contact.contactVid || "");
        return name.includes(q) || vid.includes(q);
      })
    : window._allChatContacts;
  renderChatList(filtered);
}
