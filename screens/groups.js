let groupRefreshTimer = null;
let currentGroupMessages = [];
let currentGroupId = "";
let currentGroupNameMap = {};

window.addEventListener("hashchange", () => {
  clearInterval(groupRefreshTimer);
  groupRefreshTimer = null;
});

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
      const latest = group.last_message || group.lastMessage || `${memberCount} member${memberCount === 1 ? "" : "s"}`;
      return `
        <div class="row" onclick="go('group/${encodeURIComponent(id)}/${encodeURIComponent(name)}')">
          <div class="group-avatar">G</div>
          <div class="row-info">
            <div class="row-name">${Utils.escape(name)}</div>
            <div class="row-sub">${Utils.escape(latest)}</div>
          </div>
          <span class="row-chevron">&rsaquo;</span>
        </div>`;
    }).join("");
  } catch (error) {
    showToast(error.message || "Failed to load groups");
  }
};

Screen.group = async function(groupId, groupName) {
  currentGroupId = groupId;
  const groupArg = Utils.jsString(groupId);
  clearInterval(groupRefreshTimer);
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="plain-icon-btn" onclick="go('groups')" title="Back">${Icon("back")}</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(groupName || "Group")}</div>
        </div>
        <button class="plain-icon-btn" onclick="showDownloadModal('Group Tools','G')" title="Group tools">${Icon("more")}</button>
      </div>
      <div class="scroll chat-message-list" id="group-messages">
        <div style="text-align:center;padding:40px;color:var(--muted);">Loading group...</div>
      </div>
      <div class="chat-input-bar">
        <input type="text" id="group-msg-input" maxlength="4000" placeholder="Message..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendGroupMsg(${groupArg});}">
        <button class="send-btn" onclick="sendGroupMsg(${groupArg})" title="Send">${Icon("send", 18)}</button>
      </div>
    </div>`;
  await loadGroupThread(groupId);
  groupRefreshTimer = setInterval(() => {
    if (currentGroupId === groupId) loadGroupThread(groupId, { scroll: false, silent: true });
  }, 2000);
};

async function loadGroupThread(groupId, options = {}) {
  try {
    const [data, contactData] = await Promise.all([
      Api.listGroupMessages(Auth.getToken(), groupId),
      Api.listContacts(Auth.getToken()).catch(() => ({ contacts: [] })),
    ]);
    currentGroupNameMap = {};
    (contactData.contacts || contactData || []).forEach((contact) => {
      const vid = Utils.normalizeVid(contact.vid || contact.contact_vid || contact.contactVid || "");
      if (vid) currentGroupNameMap[vid] = contact.display_name || contact.displayName || "";
    });
    const serverMessages = (data.messages || data || []).map(Utils.normalizeMessage);
    const merged = preservePendingGroupMessages(serverMessages, currentGroupMessages);
    const changed = groupMessagesSnapshot(merged) !== groupMessagesSnapshot(currentGroupMessages);
    currentGroupMessages = merged;
    renderGroupMessages(currentGroupMessages);
    if (options.scroll !== false || changed) scrollGroupToBottom();
    return changed;
  } catch (error) {
    if (!options.silent) showToast(error.message || "Failed to load group");
    return false;
  }
}

function preservePendingGroupMessages(serverMessages, previousMessages) {
  const pending = previousMessages.filter((message) => message.localOnly || message.failed);
  const serverById = new Set(serverMessages.map((message) => message.id));
  const merged = [
    ...pending.filter((message) => !serverById.has(message.id)),
    ...serverMessages,
  ];
  return merged.sort((a, b) => String(a.sentAt || "").localeCompare(String(b.sentAt || "")));
}

function renderGroupMessages(messages) {
  const el = document.getElementById("group-messages");
  if (!el) return;
  if (!messages.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No messages yet</div>';
    return;
  }
  const myVid = Auth.getVid();
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
    const sender = message.senderName || currentGroupNameMap[Utils.normalizeVid(message.senderVid)] || message.senderVid;
    const reply = typeof parseReplyPayload === "function" ? parseReplyPayload(message.content) : { hasReply: false };
    const body = typeof displayMessageContent === "function" ? displayMessageContent(message.content) : message.content;
    html += `
      <div class="bubble-wrap ${isOut ? "out" : "in"}">
        <div class="bubble ${isOut ? "out" : "in"}">
          ${!isOut ? `<div class="group-sender">${Utils.escape(sender)}</div>` : ""}
          ${reply.hasReply ? `
            <div class="reply-quote ${isOut ? "out" : "in"}">
              <b>${Utils.escape(reply.name || "Message")}</b>
              <span>${Utils.escape(reply.preview || "Message")}</span>
            </div>` : ""}
          <div class="bubble-text">${Utils.escape(body)}</div>
          <div class="bubble-meta">${Utils.formatTime(message.sentAt)} ${isOut ? Utils.statusIcon(message, myVid) : ""}</div>
        </div>
      </div>`;
  });
  el.innerHTML = html;
}

async function sendGroupMsg(groupId) {
  const input = document.getElementById("group-msg-input");
  const text = input?.value.trim() || "";
  if (!text) return;
  if (text.length > MAX_TEXT_MESSAGE_LENGTH) return showToast("Message is too long");
  input.value = "";
  const tempId = `temp-group-${Date.now()}`;
  const tempMessage = Utils.normalizeMessage({
    id: tempId,
    groupId,
    senderVid: Auth.getVid(),
    isMine: true,
    contentType: "text",
    content: text,
    sentAt: new Date().toISOString(),
    localOnly: true,
  });
  currentGroupMessages = [...currentGroupMessages, tempMessage];
  renderGroupMessages(currentGroupMessages);
  scrollGroupToBottom();
  try {
    const data = await Api.sendGroupMessage(Auth.getToken(), groupId, text);
    const savedMessage = Utils.normalizeMessage(data.message || data.messages?.[0] || data);
    if (savedMessage.senderVid) Auth.reconcileVid(savedMessage.senderVid);
    currentGroupMessages = currentGroupMessages.filter((message) => message.id !== tempId);
    await loadGroupThread(groupId);
  } catch (error) {
    showToast(error.message || "Send failed");
    currentGroupMessages = currentGroupMessages.map((message) => (
      message.id === tempId ? { ...message, failed: true, localOnly: true } : message
    ));
    renderGroupMessages(currentGroupMessages);
    scrollGroupToBottom();
  }
}

function scrollGroupToBottom() {
  const el = document.getElementById("group-messages");
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  });
}

function groupMessagesSnapshot(messages) {
  return messages.map((message) => [
    message.id,
    message.senderVid,
    message.content,
    message.sentAt,
    message.deliveredAt,
    message.seenAt,
    message.localOnly,
    message.failed,
  ].join(":")).join("|");
}
