const ANDROID_ONLY_MESSAGE = "This can be changed using REACH Android app. Not available for iOS at present.";

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
          ${profileRow("shield", "Privacy & Security", "Read receipts, last seen and direct messages are on", "go('settings')")}
          ${profileRow("block", "Blocked Users", "Visible here. Changes are Android app only.", "go('blocked')", "Locked")}
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
      const savedPhoto = data.profile_photo || photo;
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
      resolve(dataUrl);
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
      resolve(output);
    };
    image.onerror = () => reject(new Error("Could not read photo"));
    image.src = dataUrl;
  });
}

async function editProfileName() {
  const current = Auth.getName();
  const name = window.prompt("Edit name", current);
  if (name == null) return;
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (!cleanName) {
    showToast("Name cannot be empty");
    return;
  }
  if (cleanName.length > 40) {
    showToast("Name is too long");
    return;
  }
  if (cleanName === current) return;
  try {
    const data = await Api.updateProfileName(Auth.getToken(), cleanName);
    const savedName = data.user?.display_name || data.display_name || cleanName;
    localStorage.setItem(Auth.NAME_KEY, savedName);
    showToast("Name updated");
    Screen.profile();
  } catch (error) {
    showToast(error.message || "Name update failed");
  }
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

Screen.settings = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><button class="plain-icon-btn" onclick="go('profile')" title="Back">${Icon("back")}</button><span class="header-title">Privacy & Security</span></div>
      <div class="scroll">
        <div class="profile-section">
          ${lockedSettingRow("Read Receipts", "Show when you have read messages", "On")}
          ${lockedSettingRow("Last Seen", "Show your last active time", "On")}
          ${lockedSettingRow("Direct Messages", "Allow direct messages and alerts", "On")}
          ${lockedSettingRow("App Lock", "Protect REACH on this device", "On")}
        </div>
      </div>
    </div>`;
};

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
    const users = data.blocked || data.users || data || [];
    const el = document.getElementById("blocked-list");
    if (!users.length) {
      el.innerHTML = '<div class="empty-card" style="padding:40px 20px;"><b>No blocked users</b><span>Blocking and unblocking can be changed using REACH Android app.</span></div>';
      return;
    }
    el.innerHTML = `
      <div class="profile-section">
        ${users.map((user) => {
          const name = user.display_name || user.displayName || "REACH User";
          const vid = user.vid || user.target_vid || user.targetVid || "";
          return `<div class="row">
            ${Avatar(name, user.avatar_id || user.avatarId || 1, 44, user.profile_photo || user.profilePhoto || "")}
            <div class="row-info"><div class="row-name">${Utils.escape(name)}</div><div class="row-sub">ID ${Utils.escape(vid)}</div></div>
            <button class="locked-action" onclick="showAndroidOnlySettingsToast()">Locked</button>
          </div>`;
        }).join("")}
      </div>`;
  } catch (error) {
    document.getElementById("blocked-list").innerHTML = '<div class="empty-card" style="padding:40px 20px;"><b>Blocked Users</b><span>This section is available in REACH Android app.</span></div>';
    showToast(error.message || "Failed to load blocked users");
  }
};
