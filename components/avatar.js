function Avatar(name, avatarId, size = 40, photoBase64 = "") {
  const safeName = Utils.escape(name || "REACH User");
  if (photoBase64 && photoBase64.length > 10) {
    const photo = String(photoBase64);
    const src = photo.startsWith("data:image/") ? photo : `data:image/jpeg;base64,${photo}`;
    return `<img src="${Utils.escape(src)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="${safeName}">`;
  }
  const initials = (name || "?").substring(0, 2).toUpperCase();
  const bg = Utils.avatarColor(avatarId);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size * 0.38)}px;font-weight:700;flex-shrink:0;">${Utils.escape(initials)}</div>`;
}

function showAvatarZoom(name, vid, avatarId = 1, photoBase64 = "") {
  document.getElementById("avatar-zoom")?.remove();
  const safeName = name || "REACH User";
  const safeVid = Utils.normalizeVid(vid);
  const overlay = document.createElement("div");
  overlay.id = "avatar-zoom";
  overlay.className = "avatar-zoom-overlay";
  overlay.innerHTML = `
    <button class="avatar-zoom-close" title="Close">${Icon("back", 22)}</button>
    <div class="avatar-zoom-body">
      ${Avatar(safeName, avatarId, 180, photoBase64)}
      <div class="avatar-zoom-name">${Utils.escape(safeName)}</div>
      <div class="avatar-zoom-vid">${safeVid ? `REACH ID ${Utils.escape(safeVid.replace(/(.{4})/, "$1 "))}` : "REACH ID unavailable"}</div>
    </div>`;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".avatar-zoom-close")) overlay.remove();
  });
  document.body.appendChild(overlay);
}
