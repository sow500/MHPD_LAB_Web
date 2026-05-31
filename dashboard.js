import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, getDoc, collection, query, where, getDocs, orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ── DOM refs ──────────────────────────────────────────────
const loading         = document.getElementById("loading");
const content         = document.getElementById("content");
const pendingBanner   = document.getElementById("pending-banner");
const rejectedBanner  = document.getElementById("rejected-banner");
const welcomeName     = document.getElementById("welcome-name");
const welcomeInfo     = document.getElementById("welcome-info");
const statsSection    = document.getElementById("stats-section");
const bookingsSection = document.getElementById("bookings-section");
const bookingsList    = document.getElementById("bookings-list");
const bookingsEmpty   = document.getElementById("bookings-empty");
const resultsSection  = document.getElementById("results-section");
const resultsList     = document.getElementById("results-list");
const resultsEmpty    = document.getElementById("results-empty");

// ── Nav toggle (mobile) ───────────────────────────────────
const navToggle = document.getElementById("nav-toggle");
const appNav    = document.getElementById("app-nav");
if (navToggle) {
  navToggle.addEventListener("click", () => {
    appNav.classList.toggle("is-open");
  });
}

// ── Logout ────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "auth.html";
});

// ── Helpers ───────────────────────────────────────────────
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function badgeHTML(status) {
  const cls = {
    pending: "badge-pending", approved: "badge-approved",
    rejected: "badge-rejected", confirmed: "badge-confirmed",
    "in-progress": "badge-in-progress", completed: "badge-completed",
    cancelled: "badge-cancelled"
  }[status] || "badge-pending";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

// ── Auth guard ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      window.location.href = "auth.html";
      return;
    }

    const profile = userDoc.data();
    const name = profile.displayName || user.displayName || "User";
    welcomeName.textContent = `Welcome, ${name}`;
    welcomeInfo.textContent = `${profile.company || ""} · ${profile.email || user.email}`;

    loading.style.display = "none";
    content.style.display = "block";

    if (profile.status === "pending") {
      pendingBanner.style.display = "block";
      return;
    }

    if (profile.status === "rejected") {
      rejectedBanner.style.display = "block";
      return;
    }

    // Approved — show full dashboard
    statsSection.style.display = "";
    bookingsSection.style.display = "";
    resultsSection.style.display = "";

    await Promise.all([
      loadBookings(user.uid),
      loadResults(user.uid)
    ]);
  } catch (err) {
    console.error("Dashboard load error:", err);
    loading.innerHTML = '<p style="text-align:center;color:var(--danger);">Failed to load dashboard. Please refresh the page.</p>';
  }
});

// ── Load bookings ─────────────────────────────────────────
async function loadBookings(uid) {
  const q = query(
    collection(db, "bookings"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    bookingsEmpty.style.display = "block";
    document.getElementById("stat-bookings").textContent = 0;
    document.getElementById("stat-active").textContent = 0;
    document.getElementById("stat-completed").textContent = 0;
    return;
  }

  const bookings = [];
  snap.forEach(d => bookings.push({ id: d.id, ...d.data() }));

  document.getElementById("stat-bookings").textContent = bookings.length;
  document.getElementById("stat-active").textContent =
    bookings.filter(b => b.status === "confirmed" || b.status === "in-progress").length;
  document.getElementById("stat-completed").textContent =
    bookings.filter(b => b.status === "completed").length;

  bookingsList.innerHTML = bookings.map(b => `
    <div class="booking-card">
      <div class="booking-info">
        <h4>${esc(b.category)} — ${esc(b.testDescription)}</h4>
        <div class="booking-meta">
          <span>Samples: ${esc(String(b.quantity || 1))}</span>
          <span>Preferred date: ${formatDate(b.preferredDate)}</span>
          <span>Booked: ${formatDate(b.createdAt)}</span>
        </div>
        ${b.adminNotes ? `<p style="font-size:13px;color:var(--text-soft);margin-top:8px;">Note: ${esc(b.adminNotes)}</p>` : ""}
      </div>
      <div>${badgeHTML(b.status)}</div>
    </div>
  `).join("");
}

// ── Load results ──────────────────────────────────────────
async function loadResults(uid) {
  const q = query(
    collection(db, "results"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  document.getElementById("stat-results").textContent = snap.size;

  if (snap.empty) {
    resultsEmpty.style.display = "block";
    return;
  }

  const results = [];
  snap.forEach(d => results.push({ id: d.id, ...d.data() }));

  resultsList.innerHTML = results.map(r => {
    let detailsHTML = "";
    if (r.resultData && typeof r.resultData === "object") {
      detailsHTML = `<div class="result-details">
        ${Object.entries(r.resultData).map(([k, v]) => `
          <div class="result-field">
            <label>${esc(k)}</label>
            <span>${esc(String(v))}</span>
          </div>
        `).join("")}
      </div>`;
    }

    return `
      <div class="result-card">
        <div class="result-header">
          <h4>${esc(r.testName || r.category || "Test Result")}</h4>
          ${badgeHTML(r.status || "completed")}
        </div>
        <div class="booking-meta">
          <span>Sample: ${esc(r.sampleType || "—")}</span>
          <span>Tested: ${formatDate(r.testedDate)}</span>
        </div>
        ${r.summary ? `<p style="margin-top:12px;font-size:14px;">${esc(r.summary)}</p>` : ""}
        ${detailsHTML}
        ${r.reportUrl ? `<a href="${esc(r.reportUrl)}" target="_blank" class="btn btn-secondary btn-sm" style="margin-top:12px;">Download Report</a>` : ""}
      </div>
    `;
  }).join("");
}
