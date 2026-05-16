Screen.chats = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="header-title">Chats</span>
        <button class="header-icon-btn" onclick="go('contacts')" title="New chat">${Icon("plus")}</button>
      </div>
      <div class="dl-banner">
        <div class="dl-banner-text">Use the Android app for app lock, notification badges, voice notes and full device features.</div>
        <button class="dl-banner-btn" onclick="openApkLink()">Download</button>
      </div>
      <div class="scroll" id="chat-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
      ${BottomNav("chats")}
    </div>`;
  try {
    const data = await Api.listContacts(Auth.getToken());
    const contacts = data.contacts || data || [];
    const el = document.getElementById("chat-list");
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
  } catch (error) {
    showToast(error.message || "Failed to load chats");
  }
};
