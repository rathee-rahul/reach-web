Screen.calls = async function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header">
        <h1>Calls</h1>
        <button class="header-icon-btn primary" onclick="go('contacts')" title="Start call">${Icon("call")}</button>
      </div>
      <div class="scroll" id="call-list"><div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div></div>
      ${BottomNav("calls")}
    </div>`;
  await loadWebCallLogs();
};

async function loadWebCallLogs() {
  const el = document.getElementById("call-list");
  if (!el) return;
  try {
    const rows = await Api.listVoiceCalls(Auth.getToken(), 60);
    renderWebCallLogs(Array.isArray(rows) ? rows : []);
  } catch (error) {
    el.innerHTML = `<div style="text-align:center;padding:40px 22px;color:var(--muted);">${Utils.escape(error.message || "Failed to load calls")}</div>`;
  }
}

function renderWebCallLogs(rows) {
  const el = document.getElementById("call-list");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 22px;color:var(--muted);">No calls yet. Open a chat and tap the call button.</div>';
    return;
  }
  el.innerHTML = rows.map((row) => {
    const name = row.other_name || row.otherName || "REACH User";
    const vid = Utils.normalizeVid(row.other_vid || row.otherVid || "");
    const chatId = row.chat_id || row.chatId || "";
    const direction = String(row.direction || "").toLowerCase();
    const status = String(row.status || "").toLowerCase();
    const started = row.started_at || row.startedAt || "";
    const duration = Number(row.duration_seconds || row.durationSeconds || 0);
    const sub = callLogSubline(direction, status, duration, row.end_reason || row.endReason || "");
    return `
      <div class="row call-log-row">
        <div onclick="go('chat/${encodeURIComponent(chatId)}/${encodeURIComponent(name)}/${encodeURIComponent(vid)}')" style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;cursor:pointer;">
          ${Avatar(name, 1, 48, "")}
          <div style="min-width:0;flex:1;">
            <div class="row-name">${Utils.escape(name)}</div>
            <div class="row-sub">${Utils.escape(sub)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="row-time">${Utils.chatRowTime(started)}</span>
          <button class="plain-icon-btn" onclick="WebCalls.startOutgoing({ chatId: ${Utils.jsString(chatId)}, name: ${Utils.jsString(name)}, vid: ${Utils.jsString(vid)}, avatar: 1, photo: '' })" title="Call">${Icon("call", 20)}</button>
        </div>
      </div>`;
  }).join("");
}

function callLogSubline(direction, status, duration, reason) {
  const dir = direction === "incoming" ? "Incoming" : "Outgoing";
  if (status === "connected" || status === "ended") {
    return `${dir} voice call · ${formatCallDuration(duration)}`;
  }
  if (status === "missed") return "Missed voice call";
  if (status === "declined") return `${dir} declined`;
  if (status === "cancelled") return `${dir} cancelled`;
  if (status === "busy") return `${dir} busy`;
  if (status === "failed") return `${dir} failed${reason ? ` · ${reason}` : ""}`;
  return `${dir} voice call`;
}

function formatCallDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}
