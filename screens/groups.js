let groupRefreshTimer = null;
let groupTypingStopTimer = null;
let groupTypingPollTimer = null;
let currentGroupMessages = [];
let currentGroupId = "";
let currentGroupNameMap = {};

window.addEventListener("hashchange", () => {
  clearInterval(groupRefreshTimer);
  clearTimeout(groupTypingStopTimer);
  clearInterval(groupTypingPollTimer);
  if (currentGroupId) Api.setGroupTyping(Auth.getToken(), currentGroupId, false).catch(() => {});
  groupRefreshTimer = null;
  groupTypingStopTimer = null;
  groupTypingPollTimer = null;
  currentGroupId = "";
});

Screen.groups = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="header-title">Groups</span>
        <button class="header-icon-btn primary" onclick="Screen.createGroup()" title="New group">${Icon("plus")}</button>
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
      el.innerHTML = `
        <div class="empty-card chat-empty-action">
          <b>No groups yet</b>
          <span>Create a group from your contacts.</span>
          <button class="reach-primary add-contact-cta" onclick="Screen.createGroup()">${Icon("plus", 18)}<span>Create Group</span></button>
        </div>`;
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
  clearTimeout(groupTypingStopTimer);
  clearInterval(groupTypingPollTimer);
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="plain-icon-btn" onclick="go('groups')" title="Back">${Icon("back")}</button>
        <div style="flex:1;min-width:0;" onclick="showGroupInfo(${groupArg})">
          <div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(groupName || "Group")}</div>
        </div>
        <button class="plain-icon-btn" onclick="showGroupInfo(${groupArg})" title="Group tools">${Icon("more")}</button>
      </div>
      <div class="scroll chat-message-list" id="group-messages">
        <div style="text-align:center;padding:40px;color:var(--muted);">Loading group...</div>
      </div>
      <div id="group-typing-label">typing...</div>
      <div class="chat-input-bar">
        <input type="text" id="group-msg-input" maxlength="4000" placeholder="Message..." oninput="handleGroupTyping(${groupArg})" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendGroupMsg(${groupArg});}">
        <button class="send-btn" onclick="sendGroupMsg(${groupArg})" title="Send">${Icon("send", 18)}</button>
      </div>
    </div>`;
  await loadGroupThread(groupId);
  startGroupTypingPolling(groupId);
  groupRefreshTimer = setInterval(() => {
    if (currentGroupId === groupId) loadGroupThread(groupId, { scroll: false, silent: true });
  }, 2000);
};

Screen.createGroup = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="plain-icon-btn" onclick="go('chats')" title="Back">${Icon("back")}</button>
        <span class="header-title">Create Group</span>
      </div>
      <div class="scroll group-create-screen" id="create-group-body">
        <input id="group-name-input" class="group-name-input" maxlength="80" placeholder="Group name">
        <div class="section-title">Members</div>
        <div id="group-contact-picker"><div style="text-align:center;padding:32px;color:var(--muted);">Loading contacts...</div></div>
      </div>
      <div class="group-create-footer">
        <button class="send-btn wide labeled" onclick="createWebGroup()">${Icon("plus", 18)}<span>Create Group</span></button>
      </div>
    </div>`;
  try {
    const data = await Api.listContacts(Auth.getToken());
    const contacts = data.contacts || data || [];
    window._createGroupContacts = contacts;
    const picker = document.getElementById("group-contact-picker");
    if (!picker) return;
    if (!contacts.length) {
      picker.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);">Add contacts before creating a group.</div>';
      return;
    }
    picker.innerHTML = contacts.map((contact) => {
      const name = contact.display_name || contact.displayName || "REACH User";
      const vid = contact.vid || contact.contact_vid || contact.contactVid || "";
      const avatar = contact.avatar_id || contact.avatarId || 1;
      const photo = contact.profile_photo || contact.profilePhoto || "";
      return `
        <label class="group-member-row">
          ${Avatar(name, avatar, 42, photo)}
          <span class="group-member-copy">
            <b>${Utils.escape(name)}</b>
            <small>ID ${Utils.escape(vid)}</small>
          </span>
          <input type="checkbox" class="group-member-check" value="${Utils.escape(vid)}">
        </label>`;
    }).join("");
  } catch (error) {
    showToast(error.message || "Failed to load contacts");
  }
};

async function createWebGroup() {
  const name = document.getElementById("group-name-input")?.value.trim() || "";
  const members = Array.from(document.querySelectorAll(".group-member-check:checked")).map((input) => Utils.normalizeVid(input.value)).filter(Boolean);
  if (!name) return showToast("Enter a group name");
  if (!members.length) return showToast("Select at least one member");
  try {
    const data = await Api.createGroup(Auth.getToken(), name, members);
    const group = data.group || data.groups?.[0] || {};
    const id = group.id || group.group_id || "";
    const groupName = group.name || group.group_name || name;
    showToast("Group created");
    go(id ? `group/${encodeURIComponent(id)}/${encodeURIComponent(groupName)}` : "chats");
  } catch (error) {
    showToast(error.message || "Could not create group");
  }
}

async function showGroupInfo(groupId) {
  try {
    const info = await Api.getGroupInfo(Auth.getToken(), groupId);
    window._currentGroupInfo = info;
    renderGroupInfoSheet(info);
  } catch (error) {
    showToast(error.message || "Could not load group info");
  }
}

function normalizeGroupMember(member) {
  return {
    vid: Utils.normalizeVid(member.member_vid || member.vid || member.memberVid || ""),
    name: member.display_name || member.displayName || "REACH User",
    avatar: member.avatar_id || member.avatarId || 1,
    photo: member.profile_photo || member.profilePhoto || "",
    role: member.role || "member",
    adminRank: Number.isFinite(Number(member.admin_rank ?? member.adminRank)) ? Number(member.admin_rank ?? member.adminRank) : null,
  };
}

function currentGroupSelf(info) {
  const myVid = Utils.normalizeVid(Auth.getVid());
  return (info.members || []).map(normalizeGroupMember).find((member) => member.vid === myVid) || null;
}

function isGroupAdmin(info) {
  return currentGroupSelf(info)?.role === "admin";
}

function isAdminZero(info) {
  const self = currentGroupSelf(info);
  return self?.role === "admin" && Number(self.adminRank || 0) === 0;
}

function canRemoveGroupMember(info, member) {
  const self = currentGroupSelf(info);
  if (!self || self.role !== "admin" || self.vid === member.vid) return false;
  if (member.role !== "admin") return true;
  const selfRank = self.adminRank == null ? 999999 : self.adminRank;
  const targetRank = member.adminRank == null ? 999999 : member.adminRank;
  return targetRank > 0 && selfRank < targetRank;
}

function renderGroupInfoSheet(info) {
  document.getElementById("group-info-sheet")?.remove();
  const members = (info.members || []).map(normalizeGroupMember);
  const name = info.name || info.group_name || "Group";
  const groupId = info.group_id || info.groupId || currentGroupId;
  const admin = isGroupAdmin(info);
  const ownerAdmin = isAdminZero(info);
  const overlay = document.createElement("div");
  overlay.id = "group-info-sheet";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="action-sheet group-info-sheet">
      <div class="action-title">${Utils.escape(name)}</div>
      <div class="group-info-meta">Group · ${members.length} member${members.length === 1 ? "" : "s"}</div>
      <div class="group-info-actions">
        ${admin ? `<button onclick="editWebGroupName(${Utils.jsString(groupId)}, ${Utils.jsString(name)})">Edit Name</button>` : ""}
        ${admin ? `<button onclick="showAddGroupMemberSheet(${Utils.jsString(groupId)})">Add Member</button>` : ""}
        ${ownerAdmin ? `<button class="danger" onclick="deleteWebGroup(${Utils.jsString(groupId)})">Delete Group</button>` : ""}
        <button class="danger" onclick="leaveWebGroup(${Utils.jsString(groupId)})">Leave Group</button>
      </div>
      <div class="section-title">Members</div>
      <div class="group-info-members">
        ${members.map((member) => {
          const self = member.vid === Utils.normalizeVid(Auth.getVid());
          const adminLabel = member.role === "admin" ? `Admin ${Math.max(0, member.adminRank ?? 0)}` : "Member";
          return `
            <div class="group-member-row">
              ${Avatar(member.name, member.avatar, 42, member.photo)}
              <span class="group-member-copy">
                <b>${Utils.escape(member.name)}${self ? " (You)" : ""}</b>
                <small>VID ${Utils.escape(member.vid)} · ${Utils.escape(adminLabel)}</small>
              </span>
              ${admin && !self ? `<button class="mini-action" onclick="showMemberAdminActions(${Utils.jsString(groupId)}, ${Utils.jsString(member.vid)})">${Icon("more", 18)}</button>` : ""}
            </div>`;
        }).join("")}
      </div>
      <button class="cancel" data-cancel="1">Close</button>
    </div>`;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.dataset.cancel) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function showMemberAdminActions(groupId, memberVid) {
  const info = window._currentGroupInfo || {};
  const member = (info.members || []).map(normalizeGroupMember).find((item) => item.vid === Utils.normalizeVid(memberVid));
  if (!member) return;
  const options = [];
  if (member.role !== "admin") options.push(["Make Admin", () => makeWebGroupAdmin(groupId, member.vid)]);
  if (canRemoveGroupMember(info, member)) options.push(["Remove", () => removeWebGroupMember(groupId, member.vid)]);
  if (!options.length) return showToast("No actions available");
  showActionSheet(member.name, options);
}

function editWebGroupName(groupId, oldName) {
  showInputSheet("Edit Group Name", "Group name", oldName, async (value) => {
    if (!value.trim()) throw new Error("Enter a group name");
    await Api.updateGroupName(Auth.getToken(), groupId, value.trim());
    showToast("Group name updated");
    document.getElementById("group-info-sheet")?.remove();
    go(`group/${encodeURIComponent(groupId)}/${encodeURIComponent(value.trim())}`);
  });
}

async function showAddGroupMemberSheet(groupId) {
  try {
    const [contactData, info] = await Promise.all([
      Api.listContacts(Auth.getToken()),
      Api.getGroupInfo(Auth.getToken(), groupId),
    ]);
    const memberVids = new Set((info.members || []).map((member) => Utils.normalizeVid(member.member_vid || member.vid || member.memberVid || "")));
    const contacts = (contactData.contacts || contactData || []).filter((contact) => !memberVids.has(Utils.normalizeVid(contact.vid || contact.contact_vid || contact.contactVid || "")));
    if (!contacts.length) return showToast("No contacts available");
    showActionSheet("Add Member", contacts.map((contact) => {
      const name = contact.display_name || contact.displayName || "REACH User";
      const vid = contact.vid || contact.contact_vid || contact.contactVid || "";
      return [`${name} · ${vid}`, () => addWebGroupMember(groupId, vid)];
    }));
  } catch (error) {
    showToast(error.message || "Could not load contacts");
  }
}

async function addWebGroupMember(groupId, vid) {
  try {
    await Api.addGroupMember(Auth.getToken(), groupId, vid);
    showToast("Member added");
    showGroupInfo(groupId);
  } catch (error) {
    showToast(error.message || "Could not add member");
  }
}

async function makeWebGroupAdmin(groupId, vid) {
  try {
    await Api.setGroupMemberAdmin(Auth.getToken(), groupId, vid);
    showToast("Member is now an admin");
    showGroupInfo(groupId);
  } catch (error) {
    showToast(error.message || "Could not make admin");
  }
}

async function removeWebGroupMember(groupId, vid) {
  if (!confirm("Remove this member from the group?")) return;
  try {
    await Api.removeGroupMember(Auth.getToken(), groupId, vid);
    showToast("Member removed");
    showGroupInfo(groupId);
  } catch (error) {
    showToast(error.message || "Could not remove member");
  }
}

async function leaveWebGroup(groupId) {
  if (!confirm("Leave this group?")) return;
  try {
    await Api.leaveGroup(Auth.getToken(), groupId);
    showToast("You left the group");
    document.getElementById("group-info-sheet")?.remove();
    go("chats");
  } catch (error) {
    showToast(error.message || "Could not leave group");
  }
}

async function deleteWebGroup(groupId) {
  if (!confirm("Delete this group for everyone?")) return;
  try {
    await Api.deleteGroup(Auth.getToken(), groupId);
    showToast("Group deleted");
    document.getElementById("group-info-sheet")?.remove();
    go("chats");
  } catch (error) {
    showToast(error.message || "Could not delete group");
  }
}

function handleGroupTyping(groupId) {
  const value = document.getElementById("group-msg-input")?.value || "";
  Api.setGroupTyping(Auth.getToken(), groupId, value.trim().length > 0).catch(() => {});
  clearTimeout(groupTypingStopTimer);
  groupTypingStopTimer = setTimeout(() => Api.setGroupTyping(Auth.getToken(), groupId, false).catch(() => {}), 2500);
}

function startGroupTypingPolling(groupId) {
  clearInterval(groupTypingPollTimer);
  const run = async () => {
    try {
      const data = await Api.getGroupTyping(Auth.getToken(), groupId);
      const typing = data.typing === true || data.is_typing === true || data.isTyping === true;
      const name = String(data.typing_name || data.typingName || "Someone");
      const label = document.getElementById("group-typing-label");
      if (!label) return;
      label.textContent = `${name || "Someone"} typing...`;
      label.style.display = typing ? "block" : "none";
    } catch {}
  };
  run();
  groupTypingPollTimer = setInterval(run, 1000);
}

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
  clearTimeout(groupTypingStopTimer);
  Api.setGroupTyping(Auth.getToken(), groupId, false).catch(() => {});
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
