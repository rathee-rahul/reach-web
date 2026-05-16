const Screen = window.Screen || (window.Screen = {});

const Router = {
  routes: {
    landing: () => Screen.landing(),
    login: () => Screen.login(),
    create: () => Screen.createAccount(),
    "vid-ready": () => Screen.vidReady(),
    chats: () => Screen.chats(),
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
    const preview = window.location.href.includes("preview=1");
    if (!preview && !Auth.isLoggedIn() && !["landing", "login", "create"].includes(parsed.route)) {
      Router.go("landing");
      return;
    }
    if ((preview || Auth.isLoggedIn()) && ["landing", "login", "create"].includes(parsed.route)) {
      Router.go("chats");
      return;
    }
    const handler = Router.routes[parsed.route] || Router.routes.chats;
    handler(parsed.params);
  },

  init() {
    window.addEventListener("hashchange", Router.handle);
    Router.handle();
  },
};

const go = (path) => Router.go(path);
document.addEventListener("DOMContentLoaded", Router.init);
