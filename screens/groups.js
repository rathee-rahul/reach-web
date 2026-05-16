Screen.groups = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen">
      <div class="header"><span class="header-title">Groups</span></div>
      <div class="locked-overlay">
        <div class="lock-icon-wrap">G</div>
        <h3>Groups are app-only for now</h3>
        <p>Use the Android app for complete group chat controls and member tools.</p>
        <button class="btn-primary" onclick="openApkLink()">Download Android App</button>
      </div>
      ${BottomNav("groups")}
    </div>`;
};

Screen.group = Screen.groups;
