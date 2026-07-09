"use strict";

// ─── Auth config ──────────────────────────────────────────────────────────────
const AUTH_SESSION_KEY = "financeTrackerAuth";

const USERS = [
  { username: "admin",  password: "admin123",  role: "admin"  },
  { username: "farmer", password: "farmer123", role: "farmer" },
];

// If already logged in, skip straight to the app
(function checkExistingSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY));
    if (session && session.role) {
      window.location.replace("index.html");
    }
  } catch (_) { /* ignore */ }
})();

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const form       = document.getElementById("loginForm");
const usernameEl = document.getElementById("loginUsername");
const passwordEl = document.getElementById("loginPassword");
const toggleBtn  = document.getElementById("loginPwToggle");
const iconEye    = document.getElementById("iconEye");
const iconEyeOff = document.getElementById("iconEyeOff");
const errorEl    = document.getElementById("loginError");
const submitBtn  = document.getElementById("loginSubmitBtn");
const btnText    = document.getElementById("loginBtnText");

// ─── Password visibility toggle ───────────────────────────────────────────────
toggleBtn.addEventListener("click", () => {
  const show = passwordEl.type === "password";
  passwordEl.type    = show ? "text" : "password";
  iconEye.hidden     = show;
  iconEyeOff.hidden  = !show;
  toggleBtn.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

// ─── Enter on username → focus password ───────────────────────────────────────
usernameEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); passwordEl.focus(); }
});

// ─── Login submit ─────────────────────────────────────────────────────────────
form.addEventListener("submit", (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const username = usernameEl.value.trim().toLowerCase();
  const password = passwordEl.value;

  if (!username || !password) {
    showError("Please enter both username and password.");
    return;
  }

  // Loading state
  submitBtn.disabled = true;
  btnText.textContent = "Signing in…";

  // Small delay so the loading state is visible
  setTimeout(() => {
    const user = USERS.find((u) => u.username === username && u.password === password);

    if (!user) {
      showError("Invalid username or password. Please try again.");
      passwordEl.value = "";
      passwordEl.focus();
      submitBtn.disabled = false;
      btnText.textContent = "Sign In";
      return;
    }

    // Persist session and navigate
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      username: user.username,
      role: user.role,
    }));

    window.location.href = "index.html";
  }, 400);
});

function showError(msg) {
  errorEl.textContent = msg;
  // Shake the form
  form.classList.add("lp-form--shake");
  setTimeout(() => form.classList.remove("lp-form--shake"), 500);
}

// Auto-focus username on load
usernameEl.focus();
