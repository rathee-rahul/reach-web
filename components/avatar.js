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
