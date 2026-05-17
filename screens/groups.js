Screen.groups = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="header-title">Groups</span>
        <button class="header-icon-btn" onclick="showDownloadModal('Create Group','G')" title="New group">${Icon("plus")}</button>
      </div>
      <div class="dl-banner">
        <div class="dl-banner-text">Create and manage groups in the Android app.</div>
        <button class="dl-banner-btn" onclick="openApkLink()">Download</button>
      </div>
      <div class="scroll" id="groups-list">
        <div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div>
      </div>
      ${BottomNav("groups")}
    </div>`;
  try {
    const data = await Api.listGroups(Auth.getToken());
    const groups = data.groups || data || [];
    const el = document.getElementById("groups-list");
    if (!el) return;
    if (!groups.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px 22px;color:var(--muted);">No groups yet.<br>Create one in the Android app.</div>';
      return;
    }
    el.innerHTML = groups.map((group) => {
      const name = group.name || group.group_name || "Group";
      const id = group.id || group.group_id || "";
      const memberCount = Number(group.member_count || group.memberCount || 0);
      return `
        <div class="row" onclick="go('group/${encodeURIComponent(id)}/${encodeURIComponent(name)}')">
          <div class="group-avatar">G</div>
          <div class="row-info">
            <div class="row-name">${Utils.escape(name)}</div>
            <div class="row-sub">${memberCount} member${memberCount === 1 ? "" : "s"}</div>
          </div>
          <span class="row-chevron">&rsaquo;</span>
        </div>`;
    }).join("");
  } catch (error) {
    showToast(error.message || "Failed to load groups");
  }
};

Screen.group = async function(groupId, groupName) {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="plain-icon-btn" onclick="go('groups')" title="Back">${Icon("back")}</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(groupName || "Group")}</div>
        </div>
        <button class="plain-icon-btn" onclick="showDownloadModal('Group Tools','G')" title="Group tools">${Icon("more")}</button>
      </div>
      <div class="dl-banner">
        <div class="dl-banner-text">Group messaging is read-only on web for now.</div>
        <button class="dl-banner-btn" onclick="openApkLink()">Download</button>
      </div>
      <div class="scroll" id="group-messages" style="background:var(--chat-bg);padding:8px 0;display:flex;flex-direction:column;">
        <div style="text-align:center;padding:40px;color:var(--muted);">Loading group...</div>
      </div>
      <div class="chat-input-bar" style="opacity:0.5;pointer-events:none;">
        <input type="text" placeholder="Group messaging is in the Android app" disabled>
        <button class="send-btn" disabled>${Icon("send", 18)}</button>
      </div>
    </div>`;
  try {
    const [data, contactData] = await Promise.all([
      Api.listGroupMessages(Auth.getToken(), groupId),
      Api.listContacts(Auth.getToken()).catch(() => ({ contacts: [] })),
    ]);
    const nameMap = {};
    (contactData.contacts || contactData || []).forEach((contact) => {
      const vid = Utils.normalizeVid(contact.vid || contact.contact_vid || contact.contactVid || "");
      if (vid) nameMap[vid] = contact.display_name || contact.displayName || "";
    });
    const messages = (data.messages || data || []).map(Utils.normalizeMessage);
    const myVid = Auth.getVid();
    const el = document.getElementById("group-messages");
    if (!el) return;
    if (!messages.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No messages yet</div>';
      return;
    }
    let html = "";
    messages.forEach((message) => {
      if (message.deletedAt) return;
      const isOut = Utils.isOwnMessage(message, myVid);
      html += `
        <div class="bubble-wrap ${isOut ? "out" : "in"}">
          <div class="bubble ${isOut ? "out" : "in"}">
            ${!isOut ? `<div class="group-sender">${Utils.escape(message.senderName || nameMap[Utils.normalizeVid(message.senderVid)] || message.senderVid)}</div>` : ""}
            <div>${Utils.escape(message.content)}</div>
            <div class="bubble-meta">${Utils.formatTime(message.sentAt)}</div>
          </div>
        </div>`;
    });
    el.innerHTML = html;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  } catch (error) {
    showToast(error.message || "Failed to load group");
  }
};
