function showDownloadModal(featureName, featureIcon) {
  const existing = document.getElementById("dl-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "dl-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-icon">${Utils.escape(featureIcon || "APP")}</div>
      <h3 class="modal-title">${Utils.escape(featureName)}</h3>
      <p class="modal-sub">This feature is available in the full REACH Android app.<br>Download it free to get the complete experience.</p>
      <button class="btn-primary" onclick="openApkLink()">Download REACH for Android</button>
      <button class="btn-ghost" style="margin-top:10px;" onclick="document.getElementById('dl-modal')?.remove();">Maybe later</button>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function openApkLink() {
  showApkDownloadWarning();
}

function showApkDownloadWarning() {
  const existing = document.getElementById("apk-warning-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "apk-warning-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-sheet apk-warning-sheet">
      <button class="modal-close" onclick="document.getElementById('apk-warning-modal')?.remove()" aria-label="Close">x</button>
      <div class="modal-icon">APK</div>
      <h3 class="modal-title">Before You Download</h3>
      <p class="modal-sub">
        Android or Chrome may show a warning like <b>"file might be harmful"</b> because this app is being installed from our website instead of the Play Store.
        This is a normal Android safety warning for APK files.
      </p>
      <div class="apk-steps">
        <b>If Android asks for permission:</b>
        <span>1. Tap <b>Settings</b> on the install warning.</span>
        <span>2. Turn on <b>Allow from this source</b> for Chrome or your browser.</span>
        <span>3. Go back and tap <b>Install</b>.</span>
      </div>
      <button class="btn-primary" onclick="downloadApkNow()">Continue Download</button>
      <button class="btn-ghost" style="margin-top:10px;" onclick="document.getElementById('apk-warning-modal')?.remove();">Close</button>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function downloadApkNow() {
  if (!APK_DRIVE_URL) {
    showToast("Download link coming soon");
    return;
  }
  document.getElementById("dl-modal")?.remove();
  document.getElementById("apk-warning-modal")?.remove();
  window.open(APK_DRIVE_URL, "_blank");
}
