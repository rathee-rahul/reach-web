const Auth = {
  TOKEN_KEY: "reach_session_token",
  VID_KEY: "reach_vid",
  NAME_KEY: "reach_display_name",
  AVATAR_KEY: "reach_avatar_id",
  PHOTO_KEY: "reach_profile_photo",

  getToken: () => localStorage.getItem(Auth.TOKEN_KEY),
  getVid: () => window.PREVIEW_MODE ? "12345678" : localStorage.getItem(Auth.VID_KEY),
  getName: () => window.PREVIEW_MODE ? "Rahul" : localStorage.getItem(Auth.NAME_KEY),
  getAvatar: () => window.PREVIEW_MODE ? 1 : parseInt(localStorage.getItem(Auth.AVATAR_KEY) || "1", 10),
  getPhoto: () => localStorage.getItem(Auth.PHOTO_KEY) || "",
  isLoggedIn: () => window.PREVIEW_MODE || !!Auth.getToken(),

  saveAccount(account) {
    localStorage.setItem(Auth.TOKEN_KEY, account.session_token || account.sessionToken || "");
    localStorage.setItem(Auth.VID_KEY, account.vid || "");
    localStorage.setItem(Auth.NAME_KEY, account.display_name || account.displayName || "REACH User");
    localStorage.setItem(Auth.AVATAR_KEY, String(account.avatar_id ?? account.avatarId ?? 1));
    if (account.profile_photo || account.profilePhoto) {
      localStorage.setItem(Auth.PHOTO_KEY, account.profile_photo || account.profilePhoto);
    }
  },

  logout() {
    const token = Auth.getToken();
    if (token) Api.setOffline(token).catch(() => {});
    localStorage.removeItem(Auth.TOKEN_KEY);
    localStorage.removeItem(Auth.VID_KEY);
    localStorage.removeItem(Auth.NAME_KEY);
    localStorage.removeItem(Auth.AVATAR_KEY);
    localStorage.removeItem(Auth.PHOTO_KEY);
  },
};
