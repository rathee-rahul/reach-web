const ANDROID_ONLY_MESSAGE = "This can be changed using REACH Android app. Not available for iOS at present.";

Screen.profile = async function() {
  await syncProfileFromServer();
  const vid = Auth.getVid();
  const name = Auth.getName();
  const avatar = Auth.getAvatar();
  const photo = Auth.getPhoto();
  const recoveryEmail = localStorage.getItem(Auth.RECOVERY_EMAIL_KEY) || "";
  const recoveryVerified = localStorage.getItem(Auth.RECOVERY_VERIFIED_KEY) === "1";
  const recoveryText = recoveryEmail ? `${recoveryEmail}${recoveryVerified ? "" : " (not verified)"}` : "Tap to verify email for account recovery";
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><span class="header-title">Profile</span></div>
      <div class="scroll">
        <div class="profile-hero">
          <button class="profile-avatar-button" onclick="chooseProfilePhoto()" title="Change profile photo">
            ${Avatar(name, avatar, 76, photo)}
            <span class="profile-avatar-edit">${Icon("camera", 15)}</span>
          </button>
          <div class="profile-name-row">
            <div class="profile-name">${Utils.escape(name)}</div>
            <button class="mini-icon-btn" onclick="editProfileName()" title="Edit name">${Icon("edit", 16)}</button>
          </div>
          <div class="profile-id">
            <span>ID ${Utils.escape(vid)}</span>
            <button class="mini-icon-btn" onclick="copyVid()" title="Copy REACH ID">${Icon("copy", 17)}</button>
          </div>
          <input id="profile-photo-input" type="file" accept="image/*" onchange="uploadProfilePhoto(this)" hidden>
        </div>
        <div class="profile-section">
          ${profileRow("mail", "Add Recovery Mail", recoveryText, "showAddRecoveryMailDialog()")}
          ${profileRow("shield", "Privacy & Security", "Read receipts, last seen and direct messages", "go('settings')")}
          ${profileRow("block", "Blocked Users", "Block and unblock REACH IDs", "go('blocked')")}
          ${profileRow("lock", "App Lock", "On", "showAndroidOnlySettingsToast()", "Locked")}
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
    ${badge ? `<span class="locked-badge">${Utils.escape(badge)}</span>` : `<span class="row-chevron">&rsaquo;</span>`}
  </div>`;
}

async function syncProfileFromServer() {
  if (!Auth.getToken() && !window.PREVIEW_MODE) return;
  try {
    const data = await Api.getProfile(Auth.getToken());
    const user = data.user || data;
    if (user.display_name || user.displayName) {
      localStorage.setItem(Auth.NAME_KEY, user.display_name || user.displayName);
    }
    if (user.avatar_id || user.avatarId) {
      localStorage.setItem(Auth.AVATAR_KEY, String(user.avatar_id || user.avatarId));
    }
    if (user.profile_photo || user.profilePhoto) {
      localStorage.setItem(Auth.PHOTO_KEY, user.profile_photo || user.profilePhoto);
    }
    Auth.saveRecoveryEmail(user.recovery_email || user.recoveryEmail || "", user.recovery_email_verified ?? user.recoveryEmailVerified ?? false);
  } catch {}
}

function doLogout() {
  if (!confirm("Sign out of REACH?")) return;
  resetRealtime();
  Auth.logout();
  go("landing");
}

function showAndroidOnlySettingsToast() {
  showToast(ANDROID_ONLY_MESSAGE);
}

function chooseProfilePhoto() {
  document.getElementById("profile-photo-input")?.click();
}

function uploadProfilePhoto(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Choose an image file");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const photo = await prepareProfilePhoto(String(reader.result || ""));
      const data = await Api.updateProfilePhoto(Auth.getToken(), photo);
      const savedPhoto = data.user?.profile_photo || data.profile_photo || photo;
      localStorage.setItem(Auth.PHOTO_KEY, savedPhoto);
      showToast("Profile photo updated");
      Screen.profile();
    } catch (error) {
      showToast(error.message || "Photo update failed");
    } finally {
      input.value = "";
    }
  };
  reader.readAsDataURL(file);
}

function prepareProfilePhoto(dataUrl) {
  return new Promise((resolve, reject) => {
    if (dataUrl.length <= 170000) {
      resolve(stripProfilePhotoDataUrl(dataUrl));
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 384;
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Photo resize failed"));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let output = canvas.toDataURL("image/jpeg", quality);
      while (output.length > 170000 && quality > 0.42) {
        quality -= 0.1;
        output = canvas.toDataURL("image/jpeg", quality);
      }
      if (output.length > 170000) {
        reject(new Error("Choose a smaller photo"));
        return;
      }
      resolve(stripProfilePhotoDataUrl(output));
    };
    image.onerror = () => reject(new Error("Could not read photo"));
    image.src = dataUrl;
  });
}

function stripProfilePhotoDataUrl(value) {
  return String(value || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

async function editProfileName() {
  const current = Auth.getName();
  showInputSheet("Edit Name", "Your name", current, async (name) => {
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (!cleanName) throw new Error("Name cannot be empty");
    if (cleanName.length > 40) throw new Error("Name is too long");
    if (cleanName === current) return;
    const data = await Api.updateProfileName(Auth.getToken(), cleanName);
    const savedName = data.user?.display_name || data.display_name || cleanName;
    localStorage.setItem(Auth.NAME_KEY, savedName);
    showToast("Name updated");
    Screen.profile();
  });
}

function showAddRecoveryMailDialog() {
  showInputSheet("Add Recovery Email", "you@example.com", localStorage.getItem(Auth.RECOVERY_EMAIL_KEY) || "", async (email) => {
    if (!email) throw new Error("Enter recovery email");
    await Api.requestEmailVerification(Auth.getToken(), email);
    showToast("Verification code sent");
    setTimeout(() => showRecoveryCodeSheet(email), 0);
  }, { inputMode: "email", confirmLabel: "Send Code" });
}

function showRecoveryCodeSheet(email) {
  showInputSheet("Verify Email", "6-digit code", "", async (code) => {
    if (!code) throw new Error("Enter verification code");
    const data = await Api.verifyRecoveryEmail(Auth.getToken(), email, code);
    Auth.saveRecoveryEmail(data.recovery_email || email, data.recovery_email_verified ?? true);
    showToast("Recovery mail verified");
    Screen.profile();
  }, { inputMode: "numeric", confirmLabel: "Verify" });
}

Screen.settings = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><button class="plain-icon-btn" onclick="go('profile')" title="Back">${Icon("back")}</button><span class="header-title">Privacy & Security</span></div>
      <div class="scroll" id="settings-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
    </div>`;
  try {
    const data = await Api.getPrivacySettings(Auth.getToken());
    renderPrivacySettings(data.settings || data || {});
  } catch (error) {
    document.getElementById("settings-list").innerHTML = '<div class="empty-card" style="padding:40px 20px;"><b>Privacy settings unavailable</b><span>Try again in a moment.</span></div>';
    showToast(error.message || "Failed to load settings");
  }
};

function renderPrivacySettings(settings) {
  window._privacySettings = {
    message_permission: settings.message_permission || settings.messagePermission || "request",
    last_seen_enabled: settings.last_seen_enabled ?? settings.lastSeenEnabled ?? true,
    read_receipts_enabled: settings.read_receipts_enabled ?? settings.readReceiptsEnabled ?? true,
    app_lock_enabled: settings.app_lock_enabled ?? settings.appLockEnabled ?? false,
    notify_direct_messages: settings.notify_direct_messages ?? settings.notifyDirectMessages ?? true,
    notify_group_messages: settings.notify_group_messages ?? settings.notifyGroupMessages ?? true,
    notify_contact_requests: settings.notify_contact_requests ?? settings.notifyContactRequests ?? true,
    notify_show_preview: settings.notify_show_preview ?? settings.notifyShowPreview ?? true,
  };
  const s = window._privacySettings;
  document.getElementById("settings-list").innerHTML = `
    <div class="profile-section">
      ${settingToggleRow("Read Receipts", "Show blue seen ticks when you read messages", "read_receipts_enabled", s.read_receipts_enabled)}
      ${settingToggleRow("Last Seen", "Show online and last seen status", "last_seen_enabled", s.last_seen_enabled)}
      ${settingToggleRow("Direct Messages", "Allow contacts to message you directly", "message_permission", s.message_permission === "direct")}
      ${settingToggleRow("Message Preview", "Show message text in notifications", "notify_show_preview", s.notify_show_preview)}
      ${lockedSettingRow("App Lock", "Use Android app to change app lock", s.app_lock_enabled ? "On" : "Off")}
    </div>`;
}

function settingToggleRow(label, sub, key, enabled) {
  return `<div class="row">
    <div class="row-info"><div class="row-name">${Utils.escape(label)}</div><div class="row-sub">${Utils.escape(sub)}</div></div>
    <button class="setting-toggle ${enabled ? "on" : ""}" onclick="togglePrivacySetting(${Utils.jsString(key)})">${enabled ? "On" : "Off"}</button>
  </div>`;
}

async function togglePrivacySetting(key) {
  const s = { ...(window._privacySettings || {}) };
  if (key === "message_permission") {
    s.message_permission = s.message_permission === "direct" ? "request" : "direct";
  } else {
    s[key] = !s[key];
  }
  try {
    const data = await Api.updatePrivacySettings(Auth.getToken(), s);
    renderPrivacySettings(data.settings || s);
    showToast("Setting updated");
  } catch (error) {
    showToast(error.message || "Update failed");
  }
}

function lockedSettingRow(label, sub, value) {
  return `<div class="row" onclick="showAndroidOnlySettingsToast()">
    <div class="row-info"><div class="row-name">${Utils.escape(label)}</div><div class="row-sub">${Utils.escape(sub)}</div></div>
    <span class="setting-value">${Utils.escape(value)}</span>
    <span class="locked-badge">Locked</span>
  </div>`;
}

Screen.blocked = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><button class="plain-icon-btn" onclick="go('profile')" title="Back">${Icon("back")}</button><span class="header-title">Blocked Users</span></div>
      <div class="scroll" id="blocked-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
    </div>`;
  try {
    const data = await Api.listBlockedUsers(Auth.getToken());
    const users = data.blocked_users || data.blocked || data.users || data || [];
    const el = document.getElementById("blocked-list");
    if (!users.length) {
      el.innerHTML = `${blockUserPanel()}<div class="empty-card" style="padding:40px 20px;"><b>No blocked users</b><span>Block a REACH ID from here or from a chat menu.</span></div>`;
      return;
    }
    el.innerHTML = `
      ${blockUserPanel()}
      <div class="profile-section">
        ${users.map((user) => {
          const name = user.display_name || user.displayName || "REACH User";
          const vid = user.vid || user.target_vid || user.targetVid || "";
          return `<div class="row">
            ${Avatar(name, user.avatar_id || user.avatarId || 1, 44, user.profile_photo || user.profilePhoto || "")}
            <div class="row-info"><div class="row-name">${Utils.escape(name)}</div><div class="row-sub">ID ${Utils.escape(vid)}</div></div>
            <button class="locked-action" onclick="unblockWebUser(${Utils.jsString(vid)})">Unblock</button>
          </div>`;
        }).join("")}
      </div>`;
  } catch (error) {
    document.getElementById("blocked-list").innerHTML = '<div class="empty-card" style="padding:40px 20px;"><b>Blocked Users</b><span>Try again in a moment.</span></div>';
    showToast(error.message || "Failed to load blocked users");
  }
};

function blockUserPanel() {
  return `<div class="profile-section block-user-panel">
    <div class="row">
      <div class="row-info">
        <div class="row-name">Block REACH ID</div>
        <div class="row-sub">Blocked users cannot message you.</div>
      </div>
    </div>
    <div class="block-input-row">
      <input id="block-vid-input" type="text" inputmode="numeric" maxlength="8" placeholder="8-digit REACH ID">
      <button class="send-btn wide labeled" onclick="blockVidFromProfile()" title="Block user">${Icon("block", 17)}<span>Block</span></button>
    </div>
  </div>`;
}

async function blockVidFromProfile() {
  const input = document.getElementById("block-vid-input");
  const vid = Utils.normalizeVid(input?.value || "");
  if (vid.length !== 8) return showToast("Enter 8 digit REACH ID");
  try {
    await Api.blockUser(Auth.getToken(), vid, "silent");
    showToast("User blocked");
    Screen.blocked();
  } catch (error) {
    showToast(error.message || "Block failed");
  }
}

async function unblockWebUser(vid) {
  try {
    await Api.unblockUser(Auth.getToken(), vid);
    showToast("User unblocked");
    Screen.blocked();
  } catch (error) {
    showToast(error.message || "Unblock failed");
  }
}
