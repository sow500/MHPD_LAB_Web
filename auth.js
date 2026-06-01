import { auth, db, googleProvider } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ── DOM refs ──────────────────────────────────────────────
const tabs       = document.querySelectorAll(".auth-tab");
const loginForm  = document.getElementById("login-form");
const regForm    = document.getElementById("register-form");
const alertBox   = document.getElementById("auth-alert");

// ── Tab switching ─────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    loginForm.classList.toggle("active", tab.dataset.tab === "login");
    regForm.classList.toggle("active",  tab.dataset.tab === "register");
    hideAlert();
  });
});

// ── Helpers ───────────────────────────────────────────────
function showAlert(msg, type = "danger") {
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type} show`;
}

function hideAlert() {
  alertBox.className = "alert";
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait…" : btn.dataset.label;
}

// store default labels
document.getElementById("login-btn").dataset.label    = "Sign In";
document.getElementById("register-btn").dataset.label  = "Create Account";

// ── Create / get user profile in Firestore ────────────────
async function ensureUserProfile(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email:       user.email,
      displayName: extra.displayName || user.displayName || "",
      phone:       extra.phone || "",
      company:     extra.company || "",
      role:        "user",
      status:      "pending",
      createdAt:   serverTimestamp()
    });
    return "pending";
  }
  return snap.data().status;
}

// ── Redirect based on status ──────────────────────────────
function redirectUser(status, role) {
  if (role === "admin") {
    window.location.href = "admin.html";
  } else if (status === "approved") {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "dashboard.html";
  }
}

// ── Already logged in? Redirect ───────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      redirectUser(data.status, data.role);
    }
  }
});

// ── Email / password login ────────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();
  const btn   = document.getElementById("login-btn");
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-password").value;

  setLoading(btn, true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) {
      showAlert("Account not found. Please register first.", "warning");
      setLoading(btn, false);
      return;
    }
    redirectUser(snap.data().status, snap.data().role);
  } catch (err) {
    const msg = err.code === "auth/invalid-credential"
      ? "Invalid email or password."
      : err.code === "auth/user-not-found"
      ? "No account with this email."
      : err.code === "auth/too-many-requests"
      ? "Too many attempts. Please try again later."
      : "Login failed. Please try again.";
    showAlert(msg);
    setLoading(btn, false);
  }
});

// ── Email / password registration ─────────────────────────
regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();
  const btn     = document.getElementById("register-btn");
  const name    = document.getElementById("reg-name").value.trim();
  const phone   = document.getElementById("reg-phone").value.trim();
  const company = document.getElementById("reg-company").value.trim();
  const email   = document.getElementById("reg-email").value.trim();
  const pass    = document.getElementById("reg-password").value;
  const confirm = document.getElementById("reg-confirm").value;

  if (pass !== confirm) {
    showAlert("Passwords do not match.");
    return;
  }

  setLoading(btn, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await ensureUserProfile(cred.user, { displayName: name, phone, company });
    showAlert(
      "Account created! Your account is pending admin approval. You will be notified once approved.",
      "success"
    );
    setLoading(btn, false);
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
  } catch (err) {
    const msg = err.code === "auth/email-already-in-use"
      ? "An account with this email already exists. Try signing in."
      : err.code === "auth/weak-password"
      ? "Password must be at least 6 characters."
      : "Registration failed. Please try again.";
    showAlert(msg);
    setLoading(btn, false);
  }
});

// ── Handle redirect result on page load ───────────────────
getRedirectResult(auth).then(async (result) => {
  if (!result) return;
  const user = result.user;
  await ensureUserProfile(user, { displayName: user.displayName });
  const snap = await getDoc(doc(db, "users", user.uid));
  redirectUser(snap.data().status, snap.data().role);
}).catch((err) => {
  if (err.code && err.code !== "auth/cancelled-popup-request") {
    showAlert(`Google sign-in failed (${err.code}). Please try again.`);
  }
});

// ── Google sign-in — redirect (avoids popup/cookie issues) ─
function handleGoogle() {
  hideAlert();
  signInWithRedirect(auth, googleProvider).catch((err) => {
    showAlert(`Google sign-in failed (${err.code || "unknown"}). Please try again.`);
  });
}

document.getElementById("google-login-btn").addEventListener("click", handleGoogle);
document.getElementById("google-register-btn").addEventListener("click", handleGoogle);
