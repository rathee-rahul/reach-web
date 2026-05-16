Screen.landing = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen auth-screen">
      <div class="auth-landing">
        <div class="reach-logo reach-logo-large">R</div>
        <div class="reach-title">REACH</div>
        <div class="reach-subtitle">Don't share your number.<br>Share your REACH ID.</div>
        <div class="auth-actions">
          <button class="reach-primary pill" onclick="go('create')">Create Account</button>
          <button class="google-btn" onclick="startGoogleSignup()">${GoogleMark()}<span>Continue with Google</span></button>
          <button class="reach-secondary pill" onclick="go('login')">Sign In</button>
        </div>
        <div class="auth-note">You can return with your REACH ID and password after reinstalling.</div>
      </div>
    </div>`;
};

Screen.createAccount = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen auth-screen">
      <div class="scroll auth-scroll">
        <div class="auth-card">
          ${authBrandRow("landing")}
          <h1 class="auth-heading">Create your <span>REACH ID</span></h1>
          <p class="auth-copy">Your ID is how people find you - no phone number needed.</p>
          <button class="google-btn compact" onclick="startGoogleSignup()">${GoogleMark()}<span>Continue with Google</span></button>
          <div class="or-divider"><span></span><em>or fill manually</em><span></span></div>

          <label class="field-label">Full Name</label>
          <div class="icon-field"><span>User</span><input id="create-name" placeholder="Your name"></div>

          <label class="field-label">Date of Birth</label>
          <div class="dob-row">
            <select id="dob-month">${monthOptions()}</select>
            <select id="dob-day">${numberOptions("Day", 1, 31)}</select>
            <select id="dob-year">${yearOptions()}</select>
          </div>

          <label class="field-label">Gender</label>
          <div class="gender-row">
            <button type="button" onclick="selectGender(this,'male')">Male</button>
            <button type="button" onclick="selectGender(this,'female')">Female</button>
            <button type="button" onclick="selectGender(this,'prefer_not_to_say')">Prefer not to say</button>
          </div>
          <input id="create-gender" type="hidden">

          <label class="field-label">Password (minimum 8 characters)</label>
          <div class="icon-field"><span>Lock</span><input id="create-password" type="password" placeholder="Choose a password" oninput="updateWebPasswordStrength()"></div>
          <div class="password-bar"><i id="password-fill"></i></div>
          <p class="small-muted">Do not use your REACH ID as your password.</p>

          <label class="field-label">Add Recovery Mail (optional)</label>
          <div class="icon-field"><span>Mail</span><input id="create-email" type="email" placeholder="yourname@gmail.com"></div>

          <div class="warn-box">Keep your REACH ID and password safe. Verify recovery mail from Profile to recover your VID or reset password later.</div>
          <div class="id-teaser"><b>Your 8-digit REACH ID</b><small>Generated the moment you create your account</small></div>

          <button class="reach-primary" id="create-btn" onclick="doCreateAccount()">Create My REACH ID</button>
          <p class="terms">By joining you agree to our Terms and Privacy Policy. We never sell your data.</p>
          <button class="link-btn" onclick="go('login')">Already on REACH? Sign in</button>
          <button class="link-btn small" onclick="showDownloadModal('Account Recovery','Mail')">Forgot VID / Password?</button>
        </div>
      </div>
    </div>`;
};

Screen.login = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen auth-screen">
      <div class="auth-login">
        ${authBrandRow("landing")}
        <div class="login-card">
          <h1 class="login-title">Welcome back</h1>
          <p class="auth-copy">Sign in with your REACH ID.</p>
          <label class="field-label">REACH ID</label>
          <input id="login-vid" type="text" inputmode="numeric" maxlength="8" placeholder="8-digit REACH ID">
          <label class="field-label">Password</label>
          <input id="login-password" type="password" placeholder="Password">
          <button class="reach-primary" id="login-btn" onclick="doLogin()">Sign In</button>
          <button class="link-btn align-right" onclick="showDownloadModal('Account Recovery','Mail')">Forgot VID / Password?</button>
        </div>
      </div>
    </div>`;
};

Screen.vidReady = function() {
  document.getElementById("app").innerHTML = `
    <div class="screen auth-screen">
      <div class="vid-ready">
        <div class="id-pill">Your REACH ID</div>
        <h1>Your unique ID is ready!</h1>
        <p>This is your permanent identity on REACH.</p>
        <div class="big-vid">${formatVid(Auth.getVid())}</div>
        <div class="warn-box centered">Write this down or save it. You need this REACH ID plus your password to sign in again. Gmail recovery is advised in case either one is lost.</div>
        <div class="two-actions">
          <button class="reach-secondary" onclick="copyVid()">Copy</button>
          <button class="reach-secondary" onclick="shareVid()">Share</button>
        </div>
        <button class="reach-primary" onclick="go('chats')">Start Chatting</button>
      </div>
    </div>`;
};

function authBrandRow(backRoute) {
  return `
    <div class="auth-brand-row">
      <button class="back-square" onclick="go('${backRoute}')">‹</button>
      <div class="brand-mini"><span>R</span><b>REACH</b></div>
    </div>`;
}

function GoogleMark() {
  return `<svg class="google-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.94a5.08 5.08 0 0 1-2.2 3.33v2.72h3.56c2.08-1.92 3.3-4.75 3.3-8.04Z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.72c-.98.66-2.23 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.8A11 11 0 0 0 12 23Z"/>
    <path fill="#FBBC05" d="M5.84 14.14A6.61 6.61 0 0 1 5.49 12c0-.74.13-1.46.35-2.14v-2.8H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.8Z"/>
    <path fill="#EA4335" d="M12 5.33c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.05 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.8C6.71 7.26 9.14 5.33 12 5.33Z"/>
  </svg>`;
}

function monthOptions() {
  const months = ["Month", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months.map((month, index) => `<option value="${index || ""}">${month}</option>`).join("");
}

function numberOptions(label, start, end) {
  let html = `<option value="">${label}</option>`;
  for (let value = start; value <= end; value += 1) html += `<option value="${value}">${value}</option>`;
  return html;
}

function yearOptions() {
  const current = new Date().getFullYear();
  let html = '<option value="">Year</option>';
  for (let value = current - 13; value >= current - 100; value -= 1) html += `<option value="${value}">${value}</option>`;
  return html;
}

function selectGender(button, value) {
  document.getElementById("create-gender").value = value;
  document.querySelectorAll(".gender-row button").forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
}

function selectedDob() {
  const month = document.getElementById("dob-month").value;
  const day = document.getElementById("dob-day").value;
  const year = document.getElementById("dob-year").value;
  if (!month || !day || !year) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function updateWebPasswordStrength() {
  const password = document.getElementById("create-password").value;
  const fill = document.getElementById("password-fill");
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  fill.style.width = password ? `${Math.max(22, score * 25)}%` : "0";
  fill.style.background = score <= 1 ? "#F87171" : score <= 3 ? "#FBBF24" : "var(--green)";
}

function startGoogleSignup() {
  showToast("Google sign-in is coming soon to REACH Web.");
}

async function doLogin() {
  const vid = document.getElementById("login-vid").value.replace(/\D/g, "");
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("login-btn");
  if (vid.length !== 8) return showToast("Enter your 8-digit REACH ID");
  if (!password) return showToast("Enter password");
  btn.disabled = true;
  btn.textContent = "Checking...";
  try {
    const data = await Api.login(vid, password);
    Auth.saveAccount(data.account || data);
    showToast("Logged in");
    go("chats");
  } catch (error) {
    showToast(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

async function doCreateAccount() {
  const name = document.getElementById("create-name").value.trim();
  const password = document.getElementById("create-password").value;
  const email = document.getElementById("create-email").value.trim();
  const gender = document.getElementById("create-gender").value;
  const dob = selectedDob();
  const btn = document.getElementById("create-btn");
  if (!name) return showToast("Enter your name");
  if (!dob) return showToast("Select a valid date of birth");
  if (!gender) return showToast("Choose gender or Prefer not to say");
  if (password.length < 8) return showToast("Password must be at least 8 characters");
  btn.disabled = true;
  btn.textContent = "Creating...";
  try {
    const data = await Api.generateVid(name, password, 1, email, "", dob, gender);
    Auth.saveAccount(data.account || data);
    showToast("REACH ID created");
    window.location.hash = "vid-ready";
    Router.handle();
  } catch (error) {
    showToast(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create My REACH ID";
  }
}

function formatVid(vid) {
  const clean = String(vid || "").replace(/\D/g, "");
  return clean.length === 8 ? `${clean.slice(0, 4)} ${clean.slice(4)}` : clean;
}

function shareVid() {
  const text = `My REACH ID is ${Auth.getVid()}`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => showToast("Copied")).catch(() => showToast(text));
  }
}
