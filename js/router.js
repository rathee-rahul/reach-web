const Screen = window.Screen || (window.Screen = {});
let reachPresenceHeartbeat = null;

function isPreviewMode() {
  return window.location.href.includes("preview=1");
}

function touchWebPresence() {
  if (isPreviewMode() || !Auth.isLoggedIn() || document.visibilityState === "hidden") return;
  Api.touchLastSeen(Auth.getToken()).catch(() => {});
}

function startWebPresenceHeartbeat() {
  if (reachPresenceHeartbeat) return;
  touchWebPresence();
  reachPresenceHeartbeat = setInterval(touchWebPresence, 5000);
}

function stopWebPresenceHeartbeat() {
  if (reachPresenceHeartbeat) {
    clearInterval(reachPresenceHeartbeat);
    reachPresenceHeartbeat = null;
  }
  if (!isPreviewMode() && Auth.isLoggedIn() && !WebCalls?.hasActiveCall?.()) {
    Api.setOffline(Auth.getToken()).catch(() => {});
  }
}

const Router = {
  routes: {
    landing: () => Screen.landing(),
    login: () => Screen.login(),
    create: () => Screen.createAccount(),
    "vid-ready": () => Screen.vidReady(),
    chats: () => Screen.chats(),
    calls: () => Screen.calls(),
    chat: (params) => Screen.chat(params.id, params.name, params.vid),
    requests: () => Screen.requests(),
    contacts: () => Screen.contacts(),
    groups: () => Screen.groups(),
    group: (params) => Screen.group(params.id, params.name),
    profile: () => Screen.profile(),
    settings: () => Screen.settings(),
    blocked: () => Screen.blocked(),
  },

  go(path) {
    window.location.hash = path;
  },

  parse() {
    const hash = window.location.hash.slice(1) || "landing";
    const [route, ...rest] = hash.split("/");
    return {
      route,
      params: {
        id: rest[0] ? decodeURIComponent(rest[0]) : "",
        name: rest[1] ? decodeURIComponent(rest[1]) : "",
        vid: rest[2] ? decodeURIComponent(rest[2]) : "",
      },
    };
  },

  handle() {
    const parsed = Router.parse();
    const preview = isPreviewMode();
    if (!preview && !Auth.isLoggedIn() && !["landing", "login", "create"].includes(parsed.route)) {
      stopWebPresenceHeartbeat();
      Router.go("landing");
      return;
    }
    if ((preview || Auth.isLoggedIn()) && ["landing", "login", "create"].includes(parsed.route)) {
      Router.go("chats");
      return;
    }
    if (!preview && Auth.isLoggedIn()) {
      startWebPresenceHeartbeat();
      WebCalls?.startForegroundMonitor?.();
    } else {
      WebCalls?.stopForegroundMonitor?.();
    }
    const handler = Router.routes[parsed.route] || Router.routes.chats;
    handler(parsed.params);
  },

  init() {
    window.addEventListener("hashchange", Router.handle);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        startWebPresenceHeartbeat();
        touchWebPresence();
        WebCalls?.onVisibilityChanged?.();
      } else {
        stopWebPresenceHeartbeat();
      }
    });
    window.addEventListener("focus", touchWebPresence);
    window.addEventListener("pageshow", touchWebPresence);
    window.addEventListener("pointerdown", touchWebPresence, { passive: true });
    window.addEventListener("touchstart", touchWebPresence, { passive: true });
    window.addEventListener("pointerdown", () => WebCalls?.unlockAudio?.(), { passive: true });
    window.addEventListener("touchstart", () => WebCalls?.unlockAudio?.(), { passive: true });
    window.addEventListener("beforeunload", stopWebPresenceHeartbeat);
    Router.handle();
  },
};

const go = (path) => Router.go(path);
document.addEventListener("DOMContentLoaded", Router.init);
