Screen.requests = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><span class="header-title">Requests</span></div>
      <div class="scroll request-body" id="req-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
      ${BottomNav("requests")}
    </div>`;
  try {
    const data = await Api.listRequests(Auth.getToken());
    const requests = data.requests || data || [];
    const el = document.getElementById("req-list");
    if (!requests.length) {
      el.innerHTML = `
        <div class="empty-card">
          <b>No pending requests</b>
          <span>New requests will appear here before anyone can message you.</span>
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="section-label">INCOMING</div>
      ${requests.map((request) => {
        const name = request.display_name || request.displayName || "REACH User";
        return `
          <div class="request-card">
            <div class="request-top">
              ${Avatar(name, request.avatar_id || request.avatarId || 1, 46, request.profile_photo || request.profilePhoto || "")}
              <div class="row-info">
                <div class="request-eyebrow">Chat request</div>
                <div class="row-name">${Utils.escape(name)} wants to chat with you</div>
                <div class="row-sub">Tap to accept or decline</div>
              </div>
              <span class="new-pill">NEW</span>
            </div>
            <div class="request-actions">
              <button class="reach-primary" onclick="acceptReq(${Utils.jsString(request.id)})">Accept</button>
              <button class="reach-secondary" onclick="rejectReq(${Utils.jsString(request.id)})">Decline</button>
            </div>
          </div>`;
      }).join("")}`;
  } catch (error) {
    showToast(error.message || "Failed to load requests");
  }
};

async function acceptReq(id) {
  try {
    await Api.respondRequest(Auth.getToken(), id, true);
    showToast("Connected");
    go("chats");
  } catch (error) {
    showToast(error.message);
  }
}

async function rejectReq(id) {
  try {
    await Api.respondRequest(Auth.getToken(), id, false);
    showToast("Request declined");
    Screen.requests();
  } catch (error) {
    showToast(error.message);
  }
}
