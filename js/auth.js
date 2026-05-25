const Auth = {
  TOKEN_KEY: "reach_session_token",
  VID_KEY: "reach_vid",
  NAME_KEY: "reach_display_name",
  AVATAR_KEY: "reach_avatar_id",
  PHOTO_KEY: "reach_profile_photo",
  RECOVERY_EMAIL_KEY: "reach_recovery_email",
  RECOVERY_VERIFIED_KEY: "reach_recovery_email_verified",
  SESSION_REPLACED_MESSAGE: "You were signed out because your account was signed in on another device.",

  getToken: () => localStorage.getItem(Auth.TOKEN_KEY),
  getVid: () => window.PREVIEW_MODE ? "12345678" : Utils.normalizeVid(localStorage.getItem(Auth.VID_KEY)),
  getName: () => window.PREVIEW_MODE ? "Rahul" : localStorage.getItem(Auth.NAME_KEY),
  getAvatar: () => window.PREVIEW_MODE ? 1 : parseInt(localStorage.getItem(Auth.AVATAR_KEY) || "1", 10),
  getPhoto: () => localStorage.getItem(Auth.PHOTO_KEY) || "",
  isLoggedIn: () => window.PREVIEW_MODE || !!Auth.getToken(),

  reconcileVid(vid) {
    const cleanVid = Utils.normalizeVid(vid);
    if (cleanVid && !window.PREVIEW_MODE) {
      localStorage.setItem(Auth.VID_KEY, cleanVid);
    }
    return cleanVid;
  },

  saveRecoveryEmail(email, verified = true) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (cleanEmail) {
      localStorage.setItem(Auth.RECOVERY_EMAIL_KEY, cleanEmail);
      localStorage.setItem(Auth.RECOVERY_VERIFIED_KEY, verified ? "1" : "0");
    } else {
      localStorage.removeItem(Auth.RECOVERY_EMAIL_KEY);
      localStorage.removeItem(Auth.RECOVERY_VERIFIED_KEY);
    }
  },

  saveAccount(account) {
    const user = account.user || account.account || account;
    const token = account.session_token || account.sessionToken || user.session_token || user.sessionToken || "";
    const vid = Utils.normalizeVid(user.vid || account.vid || "");
    localStorage.setItem(Auth.TOKEN_KEY, token);
    localStorage.setItem(Auth.VID_KEY, vid);
    localStorage.setItem(Auth.NAME_KEY, user.display_name || user.displayName || account.display_name || account.displayName || "REACH User");
    localStorage.setItem(Auth.AVATAR_KEY, String(user.avatar_id ?? user.avatarId ?? account.avatar_id ?? account.avatarId ?? 1));
    if (user.profile_photo || user.profilePhoto || account.profile_photo || account.profilePhoto) {
      localStorage.setItem(Auth.PHOTO_KEY, user.profile_photo || user.profilePhoto || account.profile_photo || account.profilePhoto);
    }
    const recoveryEmail = user.recovery_email || user.recoveryEmail || account.recovery_email || account.recoveryEmail || "";
    if (recoveryEmail) {
      Auth.saveRecoveryEmail(recoveryEmail, user.recovery_email_verified ?? user.recoveryEmailVerified ?? account.recovery_email_verified ?? account.recoveryEmailVerified ?? true);
    }
  },

  logout(options = {}) {
    const token = Auth.getToken();
    if (token && options.notifyServer !== false) Api.setOffline(token).catch(() => {});
    window.WebCalls?.reset?.();
    localStorage.removeItem(Auth.TOKEN_KEY);
    localStorage.removeItem(Auth.VID_KEY);
    localStorage.removeItem(Auth.NAME_KEY);
    localStorage.removeItem(Auth.AVATAR_KEY);
    localStorage.removeItem(Auth.PHOTO_KEY);
    localStorage.removeItem(Auth.RECOVERY_EMAIL_KEY);
    localStorage.removeItem(Auth.RECOVERY_VERIFIED_KEY);
  },

  handleSessionInvalid() {
    Auth.logout({ notifyServer: false });
    window.location.hash = "landing";
    showToast(Auth.SESSION_REPLACED_MESSAGE);
  },
};
