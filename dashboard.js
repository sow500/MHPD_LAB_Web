import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, getDoc, collection, query, where, getDocs
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
  const s = (status || "pending").trim().toLowerCase();
  const cls = {
    pending: "badge-pending", approved: "badge-approved",
    rejected: "badge-rejected", confirmed: "badge-confirmed",
    "in-progress": "badge-in-progress", completed: "badge-completed",
    cancelled: "badge-cancelled"
  }[s] || "badge-pending";
  return `<span class="badge ${cls}">${esc(s)}</span>`;
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

    if (profile.role === "admin") {
      document.getElementById("admin-nav-link").style.display = "";
    }

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
      loadAllResults(user.uid)
    ]);
  } catch (err) {
    console.error("Dashboard load error:", err);
    content.style.display = "block";
    loading.style.display = "none";
    bookingsList.innerHTML = `<p style="color:var(--danger);padding:16px;">Error loading dashboard: ${err.message}</p>`;
  }
});

// ── Load bookings ─────────────────────────────────────────
async function loadBookings(uid) {
  let snap;
  try {
    snap = await getDocs(query(collection(db, "bookings"), where("userId", "==", uid)));
  } catch (err) {
    console.error("Bookings query error:", err);
    bookingsList.innerHTML = `<p style="color:var(--danger);padding:16px;">Could not load bookings: ${err.message}</p>`;
    return;
  }

  if (snap.empty) {
    bookingsEmpty.style.display = "block";
    document.getElementById("stat-bookings").textContent = 0;
    document.getElementById("stat-active").textContent = 0;
    document.getElementById("stat-completed").textContent = 0;
    return;
  }

  const bookings = [];
  snap.forEach(d => {
    const data = d.data();
    bookings.push({ id: d.id, ...data, status: (data.status || "pending").trim().toLowerCase() });
  });
  bookings.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  document.getElementById("stat-bookings").textContent = bookings.length;
  document.getElementById("stat-active").textContent =
    bookings.filter(b => ["confirmed", "in-progress"].includes((b.status || "").toLowerCase())).length;
  document.getElementById("stat-completed").textContent =
    bookings.filter(b => (b.status || "").toLowerCase() === "completed").length;

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

// ── Load all results & reports (combined) ─────────────────
let allResultItems = [];

async function loadAllResults(uid) {
  let resultsSnap, reportsSnap;
  try {
    [resultsSnap, reportsSnap] = await Promise.all([
      getDocs(query(collection(db, "results"), where("userId", "==", uid))),
      getDocs(query(collection(db, "reports"),  where("userId", "==", uid)))
    ]);
  } catch (err) {
    console.error("Results query error:", err);
    resultsList.innerHTML = `<p style="color:var(--danger);padding:16px;">Could not load results: ${err.message}</p>`;
    return;
  }

  allResultItems = [];
  resultsSnap.forEach(d => allResultItems.push({ id: d.id, _type: "result", ...d.data() }));
  reportsSnap.forEach(d => allResultItems.push({ id: d.id, _type: "report", ...d.data() }));
  allResultItems.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  document.getElementById("stat-results").textContent = resultsSnap.size;

  renderResultItems(allResultItems);

  // Wire up search and filter
  document.getElementById("results-search").addEventListener("input", applyResultsFilter);
  document.getElementById("results-type-filter").addEventListener("change", applyResultsFilter);
}

function applyResultsFilter() {
  const term  = document.getElementById("results-search").value.trim().toLowerCase();
  const type  = document.getElementById("results-type-filter").value;

  const filtered = allResultItems.filter(item => {
    if (type !== "all" && item._type !== type) return false;
    if (!term) return true;
    const haystack = [
      item.testName, item.sampleType, item.summary, item.category,
      item.clientName, item.companyName, item.projectName, item.testId,
      item.notes, item.userCompany, item.userName, item.bookingId, item.id,
      formatDate(item.testedDate || item.reportDate || item.createdAt)
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(term);
  });

  renderResultItems(filtered);
}

function renderResultItems(items) {
  if (items.length === 0) {
    resultsList.innerHTML = "";
    resultsEmpty.style.display = "block";
    return;
  }
  resultsEmpty.style.display = "none";

  resultsList.innerHTML = items.map(item => {
    if (item._type === "result") {
      let detailsHTML = "";
      if (item.resultData && typeof item.resultData === "object") {
        detailsHTML = `<div class="result-details">
          ${Object.entries(item.resultData).map(([k, v]) => `
            <div class="result-field"><label>${esc(k)}</label><span>${esc(String(v))}</span></div>
          `).join("")}
        </div>`;
      }
      return `
        <div class="result-card">
          <div class="result-header">
            <h4>${esc(item.testName || item.category || "Test Result")}</h4>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="font-size:11px;background:var(--info-bg);color:var(--info);padding:2px 8px;border-radius:10px;font-weight:600;">Result</span>
              ${badgeHTML(item.status || "completed")}
            </div>
          </div>
          <div class="booking-meta">
            <span>Sample: ${esc(item.sampleType || "—")}</span>
            <span>Tested: ${formatDate(item.testedDate)}</span>
            ${item.id ? `<span>ID: ${esc(item.id.slice(0,8))}</span>` : ""}
          </div>
          ${item.summary ? `<p style="margin-top:12px;font-size:14px;">${esc(item.summary)}</p>` : ""}
          ${detailsHTML}
          ${item.reportUrl ? `<a href="${esc(item.reportUrl)}" target="_blank" class="btn btn-secondary btn-sm" style="margin-top:12px;">Download Report</a>` : ""}
        </div>`;
    } else {
      return `
        <div class="result-card">
          <div class="result-header">
            <h4>${esc(item.clientName || item.companyName || "Report")}</h4>
            <span style="font-size:11px;background:var(--success-bg);color:var(--success);padding:2px 8px;border-radius:10px;font-weight:600;">Report</span>
          </div>
          <div class="booking-meta">
            ${item.companyName ? `<span>Company: ${esc(item.companyName)}</span>` : ""}
            ${item.projectName ? `<span>Project: ${esc(item.projectName)}</span>` : ""}
            ${item.testId      ? `<span>Test ID: ${esc(item.testId)}</span>`      : ""}
            <span>Date: ${formatDate(item.reportDate || item.createdAt)}</span>
          </div>
          ${item.notes ? `<p style="margin-top:12px;font-size:14px;">${esc(item.notes)}</p>` : ""}
          ${item.fileUrl ? `<a href="${esc(item.fileUrl)}" target="_blank" class="btn btn-secondary btn-sm" style="margin-top:12px;">View Report</a>` : ""}
        </div>`;
    }
  }).join("");
}
