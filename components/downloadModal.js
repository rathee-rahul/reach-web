function showDownloadModal(featureName, featureIcon) {
  const existing = document.getElementById("dl-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "dl-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-icon">${featureIcon || "APP"}</div>
      <h3 class="modal-title">${Utils.escape(featureName)}</h3>
      <p class="modal-sub">This feature is available in the full REACH Android app.<br>Download it free to get the complete experience.</p>
      <button class="btn-primary" onclick="openApkLink();document.getElementById('dl-modal').remove();">Download REACH for Android</button>
      <button class="btn-ghost" style="margin-top:10px;" onclick="document.getElementById('dl-modal').remove();">Maybe later</button>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function openApkLink() {
  if (!APK_DRIVE_URL) {
    showToast("APK link not set yet");
    return;
  }
  window.open(APK_DRIVE_URL, "_blank");
}
