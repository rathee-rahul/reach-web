function BottomNav(active) {
  const tabs = [
    { id: "chats", label: "Chats", icon: navChatIcon },
    { id: "requests", label: "Requests", icon: navBellIcon },
    { id: "contacts", label: "Contacts", icon: navPeopleIcon },
    { id: "profile", label: "Profile", icon: navUserIcon },
  ];
  return `<nav style="background:var(--surface);border-top:0.5px solid var(--line);display:flex;flex-shrink:0;padding-bottom:env(safe-area-inset-bottom);">
    ${tabs.map((tab) => `
      <button onclick="go('${tab.id}')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px 6px;border:none;background:transparent;cursor:pointer;color:${active === tab.id ? "var(--green)" : "var(--muted)"};font-size:12px;font-weight:${active === tab.id ? "700" : "400"};">
        ${tab.icon(active === tab.id)}
        <span>${tab.label}</span>
      </button>`).join("")}
  </nav>`;
}

function navSvg(active, body) {
  const color = active ? "var(--green)" : "var(--muted)";
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;color:${color};">${body}</svg>`;
}

function navChatIcon(active) {
  return navSvg(active, `<path d="M5 6.5C5 5.12 6.12 4 7.5 4h9C17.88 4 19 5.12 19 6.5v6C19 13.88 17.88 15 16.5 15H10l-4.2 3.15c-.33.25-.8.01-.8-.4V6.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8h8M8 11h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
}

function navBellIcon(active) {
  return navSvg(active, `<path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 5.5-2 6.7 0 .7.55 1.3 1.25 1.3h13.5c.7 0 1.25-.6 1.25-1.3 0-1.2-2-1.7-2-6.7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 20a2.8 2.8 0 0 0 5 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
}

function navPeopleIcon(active) {
  return navSvg(active, `<path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20c.7-3.3 2.7-5.2 6-5.2s5.3 1.9 6 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 10.5a3 3 0 0 0 0-6M16.8 14.5c2.1.5 3.4 2.3 3.9 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
}

function navUserIcon(active) {
  return navSvg(active, `<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c.8-4 3.1-6.1 7-6.1s6.2 2.1 7 6.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
}
