Screen.contacts = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="header-title">Contacts</span>
        <button class="header-icon-btn primary" onclick="Screen.addContact()" title="Add contact">${Icon("plus")}</button>
      </div>
      <div class="search-bar">
        <input type="text" placeholder="Search contacts..." oninput="filterContacts(this.value)">
      </div>
      <div class="scroll" id="contacts-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
      ${BottomNav("contacts")}
    </div>`;
  try {
    const data = await Api.listContacts(Auth.getToken());
    const contacts = data.contacts || data || [];
    window._allContacts = contacts;
    renderContactList(contacts);
  } catch (error) {
    showToast(error.message || "Failed to load contacts");
  }
};

function renderContactList(contacts) {
  const el = document.getElementById("contacts-list");
  if (!el) return;
  if (!contacts.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No contacts yet</div>';
    return;
  }
  el.innerHTML = contacts.map((contact) => {
    const name = contact.display_name || contact.displayName || "REACH User";
    const vid = contact.vid || contact.contact_vid || contact.contactVid || "";
    const chatId = contact.chat_id || contact.chatId || "";
    const avatar = contact.avatar_id || contact.avatarId || 1;
    const photo = contact.profile_photo || contact.profilePhoto || "";
    const chatUrl = `chat/${encodeURIComponent(chatId)}/${encodeURIComponent(name)}/${encodeURIComponent(vid)}`;
    const callPayload = `{ chatId: ${Utils.jsString(chatId)}, name: ${Utils.jsString(name)}, vid: ${Utils.jsString(vid)}, avatar: ${Number(avatar) || 1}, photo: ${Utils.jsString(photo)} }`;
    return `
      <div class="row contact-action-row" onclick="go('${chatUrl}')">
        ${Avatar(name, avatar, 44, photo)}
        <div class="row-info">
          <div class="row-name">${Utils.escape(name)}</div>
          <div class="row-sub">ID ${Utils.escape(vid)}</div>
        </div>
        <div class="row-actions">
          <button class="plain-icon-btn action-circle" onclick="event.stopPropagation();go('${chatUrl}')" title="Message">${Icon("chat", 20)}</button>
          <button class="plain-icon-btn action-circle" onclick="event.stopPropagation();WebCalls.startOutgoing(${callPayload})" title="Call">${Icon("call", 20)}</button>
        </div>
      </div>`;
  }).join("");
}

function filterContacts(query) {
  if (!window._allContacts) return;
  const q = query.toLowerCase().trim();
  const filtered = q
    ? window._allContacts.filter((contact) => {
        const name = (contact.display_name || contact.displayName || "").toLowerCase();
        const vid = String(contact.vid || contact.contact_vid || contact.contactVid || "");
        return name.includes(q) || vid.includes(q);
      })
    : window._allContacts;
  renderContactList(filtered);
}

Screen.addContact = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="plain-icon-btn" onclick="go('contacts')" title="Back">${Icon("back")}</button>
        <span class="header-title">Add Contact</span>
      </div>
      <div class="scroll" style="padding:24px 20px;display:flex;flex-direction:column;gap:14px;">
        <input id="search-vid" type="text" inputmode="numeric" placeholder="Enter REACH ID (8 digits)" maxlength="8">
        <button class="send-btn wide labeled" id="search-btn" onclick="searchVid()" title="Find contact">${Icon("search", 18)}<span>Find</span></button>
        <div id="search-result"></div>
      </div>
      ${BottomNav("contacts")}
    </div>`;
};

async function searchVid() {
  const vid = document.getElementById("search-vid").value.replace(/\D/g, "");
  const btn = document.getElementById("search-btn");
  const result = document.getElementById("search-result");
  if (vid.length !== 8) return showToast("Enter 8 digit REACH ID");
  btn.disabled = true;
  try {
    const data = await Api.findContact(Auth.getToken(), vid);
    const contact = data.contact || data;
    const name = contact.display_name || contact.displayName || "REACH User";
    result.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;background:var(--surface);border:0.5px solid var(--line);border-radius:12px;padding:14px;">
        ${Avatar(name, contact.avatar_id || contact.avatarId || 1, 48, contact.profile_photo || contact.profilePhoto || "")}
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:700;">${Utils.escape(name)}</div>
          <div style="font-size:12px;color:var(--muted);">ID ${Utils.escape(contact.vid || vid)}</div>
        </div>
        <button onclick="sendReq(${Utils.jsString(contact.vid || vid)})" class="header-icon-btn primary" title="Send request">${Icon("plus")}</button>
      </div>`;
  } catch (error) {
    result.innerHTML = `<div style="color:var(--red);font-size:13px;">${Utils.escape(error.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

async function sendReq(vid) {
  try {
    await Api.sendRequest(Auth.getToken(), vid);
    showToast("Request sent");
    go("contacts");
  } catch (error) {
    showToast(error.message);
  }
}
