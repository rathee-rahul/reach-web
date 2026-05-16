Screen.profile = function() {
  const vid = Auth.getVid();
  const name = Auth.getName();
  const avatar = Auth.getAvatar();
  const photo = Auth.getPhoto();
  const recoveryEmail = localStorage.getItem("reach_recovery_email") || "";
  const recoveryText = recoveryEmail ? recoveryEmail : "Tap to verify email for account recovery";
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><span class="header-title">Profile</span></div>
      <div class="scroll">
        <div class="profile-hero">
          ${Avatar(name, avatar, 72, photo)}
          <div class="profile-name">${Utils.escape(name)}</div>
          <div class="profile-id">
            <span>ID ${Utils.escape(vid)}</span>
            <button class="mini-icon-btn" onclick="copyVid()" title="Copy REACH ID">${Icon("copy", 17)}</button>
          </div>
        </div>
        <div class="profile-section">
          ${profileRow("mail", "Add Recovery Mail", recoveryText, "showAddRecoveryMailDialog()")}
          ${profileRow("shield", "Privacy & Security", "", "go('settings')")}
          ${profileRow("block", "Blocked Users", "", "go('blocked')")}
          ${profileRow("lock", "App Lock", "Android app only", "showDownloadModal('App Lock','Lock')", "App only")}
          <div class="row" onclick="doLogout()"><div class="row-info"><div class="row-name" style="color:var(--red);">Sign Out</div></div></div>
        </div>
      </div>
      ${BottomNav("profile")}
    </div>`;
};

function profileRow(icon, title, sub, action, badge = "") {
  return `<div class="row" onclick="${action}">
    <span class="profile-row-icon">${Icon(icon, 19)}</span>
    <div class="row-info"><div class="row-name">${title}</div>${sub ? `<div class="row-sub">${Utils.escape(sub)}</div>` : ""}</div>
    ${badge ? `<span style="font-size:11px;background:var(--warn-soft);color:var(--warn);padding:3px 8px;border-radius:6px;">${badge}</span>` : `<span style="color:var(--muted);">›</span>`}
  </div>`;
}

function copyVid() {
  navigator.clipboard?.writeText(Auth.getVid()).then(() => showToast("REACH ID copied")).catch(() => showToast(Auth.getVid()));
}

function doLogout() {
  if (!confirm("Sign out of REACH?")) return;
  Auth.logout();
  go("landing");
}

function showAddRecoveryMailDialog() {
  const email = window.prompt("Add Recovery Mail", localStorage.getItem("reach_recovery_email") || "");
  if (!email) return;
  Api.requestEmailVerification(Auth.getToken(), email)
    .then(() => {
      const code = window.prompt("Enter the 6-digit code sent to your email");
      if (!code) return;
      return Api.verifyRecoveryEmail(Auth.getToken(), email, code).then((data) => {
        localStorage.setItem("reach_recovery_email", data.recovery_email || email);
        showToast("Recovery mail verified");
        Screen.profile();
      });
    })
    .catch((error) => showToast(error.message));
}

Screen.settings = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><button class="plain-icon-btn" onclick="go('profile')" title="Back">${Icon("back")}</button><span class="header-title">Privacy & Security</span></div>
      <div class="scroll" id="settings-body"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
    </div>`;
  try {
    const data = await Api.getPrivacySettings(Auth.getToken());
    const settings = data.settings || data;
    document.getElementById("settings-body").innerHTML = `
      <div style="background:var(--surface);margin-top:12px;">
        ${settingRow("Read Receipts", "Show when you have read messages", settings.read_receipts_enabled ?? settings.readReceiptsEnabled ?? true, "read_receipts_enabled")}
        ${settingRow("Last Seen", "Show your last active time", settings.last_seen_enabled ?? settings.lastSeenEnabled ?? true, "last_seen_enabled")}
        ${settingRow("Direct Notifications", "Allow direct message notifications", settings.notify_direct_messages ?? settings.notifyDirectMessages ?? true, "notify_direct_messages")}
      </div>`;
  } catch (error) {
    showToast(error.message || "Failed to load settings");
  }
};

function settingRow(label, sub, checked, key) {
  return `<div class="row">
    <div class="row-info"><div class="row-name">${label}</div><div class="row-sub">${sub}</div></div>
    <input type="checkbox" ${checked ? "checked" : ""} onchange="saveSetting('${key}', this.checked)" style="width:22px;">
  </div>`;
}

async function saveSetting(key, value) {
  try {
    await Api.updatePrivacySettings(Auth.getToken(), { [key]: value });
    showToast("Saved");
  } catch (error) {
    showToast(error.message || "Failed to save");
  }
}

Screen.blocked = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><button class="plain-icon-btn" onclick="go('profile')" title="Back">${Icon("back")}</button><span class="header-title">Blocked Users</span></div>
      <div class="scroll" id="blocked-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
    </div>`;
  try {
    const data = await Api.listBlockedUsers(Auth.getToken());
    const users = data.blocked || data.users || data || [];
    const el = document.getElementById("blocked-list");
    if (!users.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No blocked users</div>';
      return;
    }
    el.innerHTML = users.map((user) => {
      const name = user.display_name || user.displayName || "REACH User";
      const vid = user.vid || user.target_vid || user.targetVid || "";
      return `<div class="row">
        ${Avatar(name, user.avatar_id || user.avatarId || 1, 44, user.profile_photo || user.profilePhoto || "")}
        <div class="row-info"><div class="row-name">${Utils.escape(name)}</div><div class="row-sub">ID ${Utils.escape(vid)}</div></div>
        <button onclick="doUnblock('${vid}')" style="background:var(--warn-soft);color:var(--warn);border:none;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer;">Unblock</button>
      </div>`;
    }).join("");
  } catch (error) {
    showToast(error.message || "Failed to load blocked users");
  }
};

async function doUnblock(vid) {
  try {
    await Api.unblockUser(Auth.getToken(), vid);
    showToast("Unblocked");
    Screen.blocked();
  } catch (error) {
    showToast(error.message);
  }
}
