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
const reportsSection  = document.getElementById("reports-section");
const reportsList     = document.getElementById("reports-list");
const reportsEmpty    = document.getElementById("reports-empty");

// ── Nav toggle (mobile) ───────────────────────────────────
const navToggle = document.getElementById("nav-toggle");
const appNav    = document.getElementById("app-nav");
if (navToggle) {
  navToggle.addEventListener("click", () => appNav.classList.toggle("is-open"));
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

function paymentBadgeHTML(paymentStatus) {
  return paymentStatus === "paid"
    ? `<span class="badge badge-completed">Paid</span>`
    : `<span class="badge badge-pending">Unpaid</span>`;
}

const chevronSVG = `<svg class="expand-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none"
  stroke="#8a9bb0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

// ── Expand / collapse ─────────────────────────────────────
window.toggleExpand = function (el) {
  el.classList.toggle("is-open");
};

// ── Auth guard ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) { window.location.href = "auth.html"; return; }

    const profile = userDoc.data();
    welcomeName.textContent = `Welcome, ${profile.displayName || user.displayName || "User"}`;
    welcomeInfo.textContent = `${profile.company || ""} · ${profile.email || user.email}`;

    if (profile.role === "admin") {
      document.getElementById("admin-nav-link").style.display = "";
    }

    loading.style.display = "none";
    content.style.display = "block";

    if (profile.status === "pending") { pendingBanner.style.display = "block"; return; }
    if (profile.status === "rejected") { rejectedBanner.style.display = "block"; return; }

    statsSection.style.display    = "";
    bookingsSection.style.display = "";
    reportsSection.style.display  = "";

    await Promise.all([loadBookings(user.uid), loadReports(user.uid)]);
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
    bookingsList.innerHTML = `<p style="color:var(--danger);padding:16px;">Could not load bookings: ${err.message}</p>`;
    return;
  }

  if (snap.empty) {
    bookingsEmpty.style.display = "block";
    ["stat-bookings","stat-active","stat-completed"].forEach(id => document.getElementById(id).textContent = 0);
    return;
  }

  const bookings = [];
  snap.forEach(d => {
    const data = d.data();
    bookings.push({ id: d.id, ...data, status: (data.status || "pending").trim().toLowerCase() });
  });
  bookings.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  document.getElementById("stat-bookings").textContent  = bookings.length;
  document.getElementById("stat-active").textContent    =
    bookings.filter(b => ["confirmed","in-progress"].includes(b.status)).length;
  document.getElementById("stat-completed").textContent =
    bookings.filter(b => b.status === "completed").length;

  bookingsList.innerHTML = bookings.map(b => {
    const tests = Array.isArray(b.selectedTests) && b.selectedTests.length
      ? b.selectedTests.join(", ")
      : null;

    return `
    <div class="booking-card expandable" onclick="toggleExpand(this)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div class="booking-info" style="flex:1;">
          <h4>${esc(b.category)} — ${esc(b.testDescription)}</h4>
          <div class="booking-meta">
            <span>Samples: ${esc(String(b.quantity || 1))}</span>
            <span>Preferred date: ${formatDate(b.preferredDate)}</span>
            <span>Booked: ${formatDate(b.createdAt)}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            ${badgeHTML(b.status)}
            ${paymentBadgeHTML(b.paymentStatus)}
          </div>
          ${chevronSVG}
        </div>
      </div>
      <div class="card-details">
        <div class="detail-grid">
          ${b.deliveryMethod ? `<span><strong>Delivery:</strong> ${esc(b.deliveryMethod)}</span>` : ""}
          ${b.userCompany    ? `<span><strong>Company:</strong> ${esc(b.userCompany)}</span>`    : ""}
          ${b.projectName    ? `<span><strong>Project:</strong> ${esc(b.projectName)}</span>`    : ""}
          ${b.quantity       ? `<span><strong>Samples:</strong> ${esc(String(b.quantity))}</span>` : ""}
        </div>
        ${tests ? `<p style="font-size:13px;margin-bottom:8px;"><strong>Selected Tests:</strong> ${esc(tests)}</p>` : ""}
        ${b.notes      ? `<p style="font-size:13px;margin-bottom:6px;color:var(--text-soft);"><strong style="color:var(--text);">Notes:</strong> ${esc(b.notes)}</p>` : ""}
        ${b.adminNotes ? `<p style="font-size:13px;color:var(--text-soft);"><strong style="color:var(--text);">Admin note:</strong> ${esc(b.adminNotes)}</p>` : ""}
      </div>
    </div>`;
  }).join("");
}

// ── Load reports ──────────────────────────────────────────
async function loadReports(uid) {
  let snap;
  try {
    snap = await getDocs(query(collection(db, "reports"), where("userId", "==", uid)));
  } catch (err) {
    reportsList.innerHTML = `<p style="color:var(--danger);padding:16px;">Could not load reports: ${err.message}</p>`;
    return;
  }

  document.getElementById("stat-results").textContent = snap.size;

  if (snap.empty) { reportsEmpty.style.display = "block"; return; }

  const reports = [];
  snap.forEach(d => reports.push({ id: d.id, ...d.data() }));
  reports.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  reportsList.innerHTML = reports.map(r => `
    <div class="result-card expandable" onclick="toggleExpand(this)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div style="flex:1;">
          <h4>${esc(r.clientName || r.companyName || "Report")}</h4>
          <div class="booking-meta">
            ${r.testId ? `<span>Test ID: ${esc(r.testId)}</span>` : ""}
            <span>Date: ${formatDate(r.reportDate || r.createdAt)}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <span style="font-size:11px;background:var(--success-bg);color:var(--success);padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;">Report</span>
          ${chevronSVG}
        </div>
      </div>
      <div class="card-details">
        <div class="detail-grid">
          ${r.companyName ? `<span><strong>Company:</strong> ${esc(r.companyName)}</span>` : ""}
          ${r.projectName ? `<span><strong>Project:</strong> ${esc(r.projectName)}</span>` : ""}
          ${r.testId      ? `<span><strong>Test ID:</strong> ${esc(r.testId)}</span>`      : ""}
          <span><strong>Date:</strong> ${formatDate(r.reportDate || r.createdAt)}</span>
        </div>
        ${r.notes ? `<p style="font-size:13px;margin-bottom:12px;">${esc(r.notes)}</p>` : ""}
        ${r.fileUrl
          ? `<a href="${esc(r.fileUrl)}" target="_blank" class="btn btn-secondary btn-sm"
               onclick="event.stopPropagation()">View Report</a>`
          : ""}
      </div>
    </div>
  `).join("");
}
