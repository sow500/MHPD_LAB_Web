import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, getDoc, collection, query, getDocs, updateDoc,
  addDoc, serverTimestamp, Timestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ── DOM refs ──────────────────────────────────────────────
const loadingEl    = document.getElementById("loading");
const accessDenied = document.getElementById("access-denied");
const contentEl    = document.getElementById("content");

// ── Nav toggle ────────────────────────────────────────────
const navToggle = document.getElementById("nav-toggle");
const appNav    = document.getElementById("app-nav");
if (navToggle) {
  navToggle.addEventListener("click", () => appNav.classList.toggle("is-open"));
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "auth.html";
});

// ── Tab switching ─────────────────────────────────────────
document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.panel}`).classList.add("active");
  });
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

function showBar(id) {
  document.getElementById(id).style.display = "flex";
}

function resetBar(searchId, sortId, sortDefault) {
  document.getElementById(searchId).value = "";
  document.getElementById(sortId).value   = sortDefault;
}

// ── Data stores ───────────────────────────────────────────
let allUsers     = [];
let pendingUsers = [];
let allBookings  = [];
let allReports   = [];

// ── Auth guard ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    loadingEl.style.display   = "none";
    accessDenied.style.display = "block";
    return;
  }

  document.getElementById("admin-subtitle").textContent =
    `Signed in as ${snap.data().displayName || user.email}`;

  loadingEl.style.display  = "none";
  contentEl.style.display  = "block";

  await Promise.all([loadUsers(), loadBookings(), loadReports()]);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  USERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderPendingUsersTable(users) {
  const wrap    = document.getElementById("users-table-wrap");
  const noMatch = document.getElementById("users-no-match");
  if (users.length === 0) {
    wrap.style.display    = "none";
    noMatch.style.display = "block";
    return;
  }
  noMatch.style.display = "none";
  wrap.style.display    = "block";
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Registered</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${esc(u.displayName)}</td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.phone)}</td>
              <td>${esc(u.company)}</td>
              <td>${formatDate(u.createdAt)}</td>
              <td>
                <div class="btn-group">
                  <button class="btn btn-success btn-sm" onclick="window._approve('${u.id}')">Approve</button>
                  <button class="btn btn-danger btn-sm" onclick="window._reject('${u.id}')">Reject</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

function applyPendingUsersView() {
  const q    = document.getElementById("users-search").value.trim().toLowerCase();
  const sort = document.getElementById("users-sort").value;
  const s    = f => (f || "").toLowerCase();
  const ts   = u => u.createdAt?.toMillis?.() ?? 0;

  let list = pendingUsers.filter(u => !q || (
    s(u.displayName).includes(q) || s(u.email).includes(q) ||
    s(u.company).includes(q)     || s(u.phone).includes(q) ||
    formatDate(u.createdAt).toLowerCase().includes(q)
  ));

  list = [...list].sort((a, b) => {
    if (sort === "date-desc")   return ts(b) - ts(a);
    if (sort === "date-asc")    return ts(a) - ts(b);
    if (sort === "name-asc")    return s(a.displayName).localeCompare(s(b.displayName));
    if (sort === "name-desc")   return s(b.displayName).localeCompare(s(a.displayName));
    if (sort === "company-asc") return s(a.company).localeCompare(s(b.company));
    return 0;
  });

  renderPendingUsersTable(list);
}

function renderAllUsersTable(users) {
  const wrap    = document.getElementById("all-users-table-wrap");
  const noMatch = document.getElementById("all-users-no-match");
  if (users.length === 0) {
    wrap.style.display    = "none";
    noMatch.style.display = "block";
    return;
  }
  noMatch.style.display = "none";
  wrap.style.display    = "block";
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Status</th><th>Registered</th></tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${esc(u.displayName)}</td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.company)}</td>
              <td>${esc(u.role)}</td>
              <td>${badgeHTML(u.status)}</td>
              <td>${formatDate(u.createdAt)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

function applyAllUsersView() {
  const q    = document.getElementById("all-users-search").value.trim().toLowerCase();
  const sort = document.getElementById("all-users-sort").value;
  const s    = f => (f || "").toLowerCase();
  const ts   = u => u.createdAt?.toMillis?.() ?? 0;

  let list = allUsers.filter(u => !q || (
    s(u.displayName).includes(q) || s(u.email).includes(q) ||
    s(u.company).includes(q)     || s(u.role).includes(q)  ||
    s(u.status).includes(q)      || formatDate(u.createdAt).toLowerCase().includes(q)
  ));

  list = [...list].sort((a, b) => {
    if (sort === "date-desc")   return ts(b) - ts(a);
    if (sort === "date-asc")    return ts(a) - ts(b);
    if (sort === "name-asc")    return s(a.displayName).localeCompare(s(b.displayName));
    if (sort === "name-desc")   return s(b.displayName).localeCompare(s(a.displayName));
    if (sort === "company-asc") return s(a.company).localeCompare(s(b.company));
    if (sort === "status-asc")  return s(a.status).localeCompare(s(b.status));
    return 0;
  });

  renderAllUsersTable(list);
}

document.getElementById("users-search").addEventListener("input", applyPendingUsersView);
document.getElementById("users-sort").addEventListener("change", applyPendingUsersView);
document.getElementById("all-users-search").addEventListener("input", applyAllUsersView);
document.getElementById("all-users-sort").addEventListener("change", applyAllUsersView);

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = [];
  snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));

  pendingUsers       = allUsers.filter(u => u.status === "pending");
  const approved     = allUsers.filter(u => u.status === "approved");

  document.getElementById("a-stat-pending").textContent    = pendingUsers.length;
  document.getElementById("a-stat-total-users").textContent = allUsers.length;
  document.getElementById("tab-count-users").textContent    = pendingUsers.length;
  document.getElementById("users-loading").style.display   = "none";

  if (pendingUsers.length === 0) {
    document.getElementById("users-empty").style.display = "block";
  } else {
    document.getElementById("users-empty").style.display = "none";
    showBar("users-search-bar");
    resetBar("users-search", "users-sort", "date-desc");
    renderPendingUsersTable(pendingUsers);
  }

  document.getElementById("all-users-loading").style.display = "none";
  showBar("all-users-search-bar");
  resetBar("all-users-search", "all-users-sort", "date-desc");
  renderAllUsersTable(allUsers);

  // Populate report user datalist
  const rptDatalist = document.getElementById("rpt-user-list");
  rptDatalist.innerHTML = "";
  approved.forEach(u => {
    const opt = document.createElement("option");
    opt.value           = `${u.displayName || u.email} (${u.company || u.email})`;
    opt.dataset.uid     = u.id;
    opt.dataset.email   = u.email;
    opt.dataset.name    = u.displayName || "";
    opt.dataset.company = u.company || "";
    rptDatalist.appendChild(opt);
  });

  document.getElementById("rpt-user-input").addEventListener("input", function () {
    const match = Array.from(rptDatalist.options).find(o => o.value === this.value);
    document.getElementById("rpt-user-id").value    = match ? match.dataset.uid   : "";
    document.getElementById("rpt-user-email").value = match ? match.dataset.email : "";
    if (match) {
      if (!document.getElementById("rpt-client").value)
        document.getElementById("rpt-client").value = match.dataset.name;
      if (!document.getElementById("rpt-company").value)
        document.getElementById("rpt-company").value = match.dataset.company;
    }
  });
}

window._approve = async function (userId) {
  if (!confirm("Approve this user?")) return;
  await updateDoc(doc(db, "users", userId), { status: "approved" });
  await loadUsers();
};

window._reject = async function (userId) {
  if (!confirm("Reject this user?")) return;
  await updateDoc(doc(db, "users", userId), { status: "rejected" });
  await loadUsers();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BOOKINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function paymentBadge(status) {
  return status === "paid"
    ? `<span class="badge badge-completed">Paid</span>`
    : `<span class="badge badge-pending">Unpaid</span>`;
}

const rowChevron = (id) =>
  `<svg id="chev-${id}" style="flex-shrink:0;transition:transform 0.2s;color:#8a9bb0;" width="14" height="14"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
    stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

window.toggleAdminRow = function (id) {
  const detail = document.getElementById(`adr-${id}`);
  const chev   = document.getElementById(`chev-${id}`);
  if (!detail) return;
  const open = detail.style.display !== "none";
  detail.style.display = open ? "none" : "table-row";
  if (chev) chev.style.transform = open ? "" : "rotate(180deg)";
};

function bookingRowHTML(b, showStatus, panelKey = "") {
  const uid = panelKey ? `${panelKey}__${b.id}` : b.id;
  const numCols = showStatus ? 9 : 8;
  const tests = Array.isArray(b.selectedTests) && b.selectedTests.length
    ? b.selectedTests.join(", ") : null;
  return `
    <tr onclick="window.toggleAdminRow('${uid}')" style="cursor:pointer;">
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          ${rowChevron(uid)}
          ${formatDate(b.createdAt)}
        </div>
      </td>
      <td>
        <strong>${esc(b.userName)}</strong><br>
        <small style="color:var(--text-soft)">${esc(b.userCompany || b.userEmail)}</small>
      </td>
      <td>${esc(b.category)}</td>
      <td style="max-width:200px;font-size:13px;">${esc(b.testDescription || "—")}</td>
      <td>${esc(String(b.quantity || 1))}</td>
      <td style="font-size:13px;">${esc(b.deliveryMethod || "—")}</td>
      ${showStatus ? `<td>${badgeHTML(b.status)}</td>` : ""}
      <td onclick="event.stopPropagation()">
        <select class="form-select" style="font-size:13px;padding:6px 10px;min-width:100px;"
          onchange="window._updatePayment('${b.id}', this.value)">
          <option value="unpaid" ${(b.paymentStatus || "unpaid") === "unpaid" ? "selected" : ""}>Unpaid</option>
          <option value="paid"   ${b.paymentStatus === "paid" ? "selected" : ""}>Paid</option>
        </select>
      </td>
      <td onclick="event.stopPropagation()">
        <select class="form-select" style="font-size:13px;padding:6px 10px;min-width:130px;"
          onchange="window._updateBooking('${b.id}', this.value)">
          ${["pending","confirmed","in-progress","completed","cancelled"].map(s =>
            `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`
          ).join("")}
        </select>
      </td>
    </tr>
    <tr id="adr-${uid}" style="display:none;">
      <td colspan="${numCols}" style="padding:0;">
        <div style="padding:12px 20px 14px;background:var(--surface-soft);border-top:1px solid var(--line);">
          <div style="display:flex;flex-wrap:wrap;gap:6px 28px;font-size:13px;color:var(--text-soft);margin-bottom:8px;">
            ${b.projectName    ? `<span><strong style="color:var(--text);">Project:</strong> ${esc(b.projectName)}</span>`    : ""}
            ${b.userEmail      ? `<span><strong style="color:var(--text);">Email:</strong> ${esc(b.userEmail)}</span>`         : ""}
            ${b.userCompany    ? `<span><strong style="color:var(--text);">Company:</strong> ${esc(b.userCompany)}</span>`     : ""}
            ${b.deliveryMethod ? `<span><strong style="color:var(--text);">Delivery:</strong> ${esc(b.deliveryMethod)}</span>` : ""}
          </div>
          ${tests      ? `<p style="font-size:13px;margin-bottom:6px;"><strong>Selected Tests:</strong> ${esc(tests)}</p>`           : ""}
          ${b.notes    ? `<p style="font-size:13px;margin-bottom:6px;color:var(--text-soft);"><strong style="color:var(--text);">Client Notes:</strong> ${esc(b.notes)}</p>` : ""}
          ${b.adminNotes ? `<p style="font-size:13px;color:var(--text-soft);"><strong style="color:var(--text);">Admin Notes:</strong> ${esc(b.adminNotes)}</p>` : ""}
        </div>
      </td>
    </tr>`;
}

function renderBookingTable(bookings, wrapId, noMatchId, showStatus) {
  const wrap    = document.getElementById(wrapId);
  const noMatch = document.getElementById(noMatchId);
  if (bookings.length === 0) {
    wrap.style.display    = "none";
    noMatch.style.display = "block";
    return;
  }
  noMatch.style.display = "none";
  wrap.style.display    = "block";
  const statusTh = showStatus ? "<th>Status</th>" : "";
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Client</th><th>Category</th><th>Tests</th><th>Samples</th><th>Delivery</th>${statusTh}<th>Payment</th><th>Actions</th></tr>
        </thead>
        <tbody>${bookings.map(b => bookingRowHTML(b, showStatus, wrapId)).join("")}</tbody>
      </table>
    </div>`;
}

function filterSortBookings(source, searchId, sortId) {
  const q   = document.getElementById(searchId).value.trim().toLowerCase();
  const sort = document.getElementById(sortId).value;
  const s   = f => (f || "").toLowerCase();
  const ts  = b => b.createdAt?.toMillis?.() ?? 0;

  let list = source.filter(b => !q || (
    s(b.userName).includes(q)        || s(b.userCompany).includes(q) ||
    s(b.category).includes(q)        || s(b.status).includes(q)      ||
    s(b.testDescription).includes(q) || formatDate(b.createdAt).toLowerCase().includes(q)
  ));

  return [...list].sort((a, b) => {
    if (sort === "date-desc")    return ts(b) - ts(a);
    if (sort === "date-asc")     return ts(a) - ts(b);
    if (sort === "client-asc")   return s(a.userName).localeCompare(s(b.userName));
    if (sort === "client-desc")  return s(b.userName).localeCompare(s(a.userName));
    if (sort === "category-asc") return s(a.category).localeCompare(s(b.category));
    if (sort === "status-asc")   return s(a.status).localeCompare(s(b.status));
    return 0;
  });
}

function applyBookingsView() {
  const list = filterSortBookings(allBookings, "bookings-search", "bookings-sort");
  renderBookingTable(list, "bookings-table-wrap", "bookings-no-match", true);
}

function applyPendingBookingsView() {
  const source = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "pending");
  const list   = filterSortBookings(source, "pending-bookings-search", "pending-bookings-sort");
  renderBookingTable(list, "pending-bookings-table-wrap", "pending-bookings-no-match", false);
}

function applyConfirmedView() {
  const source = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "confirmed");
  const list   = filterSortBookings(source, "confirmed-search", "confirmed-sort");
  renderBookingTable(list, "confirmed-table-wrap", "confirmed-no-match", false);
}

function applyInProgressView() {
  const source = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "in-progress");
  const list   = filterSortBookings(source, "inprogress-search", "inprogress-sort");
  renderBookingTable(list, "inprogress-table-wrap", "inprogress-no-match", false);
}

function applyCompletedView() {
  const source = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "completed");
  const list   = filterSortBookings(source, "completed-search", "completed-sort");
  renderBookingTable(list, "completed-table-wrap", "completed-no-match", false);
}

function applyCancelledView() {
  const source = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "cancelled");
  const list   = filterSortBookings(source, "cancelled-search", "cancelled-sort");
  renderBookingTable(list, "cancelled-table-wrap", "cancelled-no-match", false);
}

document.getElementById("bookings-search").addEventListener("input", applyBookingsView);
document.getElementById("bookings-sort").addEventListener("change", applyBookingsView);
document.getElementById("pending-bookings-search").addEventListener("input", applyPendingBookingsView);
document.getElementById("pending-bookings-sort").addEventListener("change", applyPendingBookingsView);
document.getElementById("confirmed-search").addEventListener("input", applyConfirmedView);
document.getElementById("confirmed-sort").addEventListener("change", applyConfirmedView);
document.getElementById("inprogress-search").addEventListener("input", applyInProgressView);
document.getElementById("inprogress-sort").addEventListener("change", applyInProgressView);
document.getElementById("completed-search").addEventListener("input", applyCompletedView);
document.getElementById("completed-sort").addEventListener("change", applyCompletedView);
document.getElementById("cancelled-search").addEventListener("input", applyCancelledView);
document.getElementById("cancelled-sort").addEventListener("change", applyCancelledView);

async function loadBookings() {
  const snap = await getDocs(query(collection(db, "bookings"), orderBy("createdAt", "desc")));
  allBookings = [];
  snap.forEach(d => allBookings.push({ id: d.id, ...d.data() }));

  const active     = allBookings.filter(b => !["completed","cancelled"].includes((b.status || "").trim().toLowerCase()));
  const pending    = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "pending");
  const confirmed  = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "confirmed");
  const inProgress = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "in-progress");
  const completed  = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "completed");
  const cancelled  = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "cancelled");
  const paid       = allBookings.filter(b => b.paymentStatus === "paid");

  document.getElementById("a-stat-bookings").textContent            = active.length;
  document.getElementById("a-stat-results").textContent             = paid.length;
  document.getElementById("tab-count-bookings").textContent         = allBookings.length;
  document.getElementById("tab-count-pending-bookings").textContent = pending.length;
  document.getElementById("tab-count-confirmed").textContent        = confirmed.length;
  document.getElementById("tab-count-inprogress").textContent       = inProgress.length;
  document.getElementById("tab-count-completed").textContent        = completed.length;
  document.getElementById("tab-count-cancelled").textContent        = cancelled.length;
  document.getElementById("bookings-loading").style.display         = "none";

  function populatePanel(list, emptyId, barId, searchId, sortId, wrapId, noMatchId, showStatus) {
    if (list.length === 0) {
      document.getElementById(emptyId).style.display = "block";
    } else {
      document.getElementById(emptyId).style.display = "none";
      showBar(barId);
      resetBar(searchId, sortId, "date-desc");
      renderBookingTable(list, wrapId, noMatchId, showStatus);
    }
  }

  populatePanel(allBookings, "bookings-empty",         "bookings-search-bar",         "bookings-search",         "bookings-sort",         "bookings-table-wrap",         "bookings-no-match",         true);
  populatePanel(pending,     "pending-bookings-empty", "pending-bookings-search-bar", "pending-bookings-search", "pending-bookings-sort", "pending-bookings-table-wrap", "pending-bookings-no-match", false);
  populatePanel(confirmed,   "confirmed-empty",        "confirmed-search-bar",        "confirmed-search",        "confirmed-sort",        "confirmed-table-wrap",        "confirmed-no-match",        false);
  populatePanel(inProgress,  "inprogress-empty",       "inprogress-search-bar",       "inprogress-search",       "inprogress-sort",       "inprogress-table-wrap",       "inprogress-no-match",       false);
  populatePanel(completed,   "completed-empty",        "completed-search-bar",        "completed-search",        "completed-sort",        "completed-table-wrap",        "completed-no-match",        false);
  populatePanel(cancelled,   "cancelled-empty",        "cancelled-search-bar",        "cancelled-search",        "cancelled-sort",        "cancelled-table-wrap",        "cancelled-no-match",        false);
}

window._updateBooking = async function (bookingId, newStatus) {
  try {
    await updateDoc(doc(db, "bookings", bookingId), { status: newStatus });
    await loadBookings();
  } catch (err) {
    alert("Failed to update booking: " + err.message);
    await loadBookings();
  }
};

window._updatePayment = async function (bookingId, paymentStatus) {
  try {
    await updateDoc(doc(db, "bookings", bookingId), { paymentStatus });
    await loadBookings();
  } catch (err) {
    alert("Failed to update payment status: " + err.message);
    await loadBookings();
  }
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderReportsTable(reports) {
  const wrap    = document.getElementById("reports-admin-table-wrap");
  const noMatch = document.getElementById("reports-no-match");
  if (reports.length === 0) {
    wrap.style.display    = "none";
    noMatch.style.display = "block";
    return;
  }
  noMatch.style.display = "none";
  wrap.style.display    = "block";
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Client</th><th>Company</th><th>Project</th><th>Test ID</th><th>Notes</th><th>Report</th></tr>
        </thead>
        <tbody>
          ${reports.map(r => `
            <tr onclick="window.toggleAdminRow('rpt-${r.id}')" style="cursor:pointer;">
              <td>
                <div style="display:flex;align-items:center;gap:6px;">
                  ${rowChevron(`rpt-${r.id}`)}
                  ${formatDate(r.reportDate || r.createdAt)}
                </div>
              </td>
              <td>${esc(r.clientName || r.userEmail || "—")}</td>
              <td style="font-size:13px;">${esc(r.companyName || "—")}</td>
              <td style="font-size:13px;">${esc(r.projectName || "—")}</td>
              <td style="font-size:13px;">${esc(r.testId || "—")}</td>
              <td style="font-size:13px;max-width:180px;">${esc(r.notes || "—")}</td>
              <td onclick="event.stopPropagation()">${r.fileUrl ? `<a href="${esc(r.fileUrl)}" target="_blank" class="btn btn-secondary btn-sm">View</a>` : "—"}</td>
            </tr>
            <tr id="adr-rpt-${r.id}" style="display:none;">
              <td colspan="7" style="padding:0;">
                <div style="padding:12px 20px 14px;background:var(--surface-soft);border-top:1px solid var(--line);">
                  <div style="display:flex;flex-wrap:wrap;gap:6px 28px;font-size:13px;color:var(--text-soft);margin-bottom:8px;">
                    ${r.companyName ? `<span><strong style="color:var(--text);">Company:</strong> ${esc(r.companyName)}</span>` : ""}
                    ${r.projectName ? `<span><strong style="color:var(--text);">Project:</strong> ${esc(r.projectName)}</span>` : ""}
                    ${r.testId      ? `<span><strong style="color:var(--text);">Test ID:</strong> ${esc(r.testId)}</span>`      : ""}
                    <span><strong style="color:var(--text);">Date:</strong> ${formatDate(r.reportDate || r.createdAt)}</span>
                    ${r.userEmail   ? `<span><strong style="color:var(--text);">User:</strong> ${esc(r.userEmail)}</span>`      : ""}
                  </div>
                  ${r.notes ? `<p style="font-size:13px;margin-bottom:12px;">${esc(r.notes)}</p>` : ""}
                  ${r.fileUrl ? `<a href="${esc(r.fileUrl)}" target="_blank" class="btn btn-secondary btn-sm">View Report</a>` : ""}
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

function applyReportsView() {
  const q    = document.getElementById("reports-search").value.trim().toLowerCase();
  const sort = document.getElementById("reports-sort").value;
  const s    = f => (f || "").toLowerCase();
  const ts   = r => (r.reportDate || r.createdAt)?.toMillis?.() ?? 0;

  let list = allReports.filter(r => !q || (
    s(r.testId).includes(q)                          ||
    s(r.companyName).includes(q)                     ||
    s(r.clientName || r.userEmail).includes(q)       ||
    s(r.projectName).includes(q)                     ||
    formatDate(r.reportDate || r.createdAt).toLowerCase().includes(q)
  ));

  list = [...list].sort((a, b) => {
    if (sort === "date-desc")   return ts(b) - ts(a);
    if (sort === "date-asc")    return ts(a) - ts(b);
    if (sort === "client-asc")  return s(a.clientName || a.userEmail).localeCompare(s(b.clientName || b.userEmail));
    if (sort === "client-desc") return s(b.clientName || b.userEmail).localeCompare(s(a.clientName || a.userEmail));
    if (sort === "company-asc") return s(a.companyName).localeCompare(s(b.companyName));
    if (sort === "testid-asc")  return (parseFloat(a.testId) || 0) - (parseFloat(b.testId) || 0);
    if (sort === "testid-desc") return (parseFloat(b.testId) || 0) - (parseFloat(a.testId) || 0);
    return 0;
  });

  renderReportsTable(list);
}

document.getElementById("reports-search").addEventListener("input", applyReportsView);
document.getElementById("reports-sort").addEventListener("change", applyReportsView);

async function loadReports() {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
  document.getElementById("reports-admin-loading").style.display = "none";

  if (snap.empty) {
    document.getElementById("reports-admin-empty").style.display = "block";
    return;
  }

  allReports = [];
  snap.forEach(d => allReports.push({ id: d.id, ...d.data() }));

  showBar("reports-search-bar");
  resetBar("reports-search", "reports-sort", "date-desc");
  renderReportsTable(allReports);
}

const reportForm  = document.getElementById("report-form");
const reportAlert = document.getElementById("report-alert");

reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  reportAlert.className = "alert";

  const userId      = document.getElementById("rpt-user-id").value;
  const userEmail   = document.getElementById("rpt-user-email").value;
  const userInput   = document.getElementById("rpt-user-input").value.trim();
  const testId      = document.getElementById("rpt-test-id").value.trim();
  const companyName = document.getElementById("rpt-company").value.trim();
  const clientName  = document.getElementById("rpt-client").value.trim();
  const projectName = document.getElementById("rpt-project").value.trim();
  const notes       = document.getElementById("rpt-notes").value.trim();
  const fileUrl     = document.getElementById("rpt-url").value.trim();
  const dateVal     = document.getElementById("rpt-date").value;

  if (!fileUrl) {
    reportAlert.textContent = "Report URL is required.";
    reportAlert.className   = "alert alert-danger show";
    return;
  }

  const submitBtn = document.getElementById("report-submit-btn");
  submitBtn.disabled    = true;
  submitBtn.textContent = "Uploading…";

  try {
    await addDoc(collection(db, "reports"), {
      userId: userId || "", userEmail: userEmail || userInput,
      testId, companyName, clientName, projectName, notes, fileUrl,
      reportDate: dateVal ? Timestamp.fromDate(new Date(dateVal)) : null,
      createdAt: serverTimestamp()
    });

    reportAlert.textContent = "Report uploaded successfully!";
    reportAlert.className   = "alert alert-success show";
    reportForm.reset();
    await loadReports();
  } catch (err) {
    console.error("Report upload error:", err);
    reportAlert.textContent = "Failed to upload report: " + err.message;
    reportAlert.className   = "alert alert-danger show";
  }

  submitBtn.disabled    = false;
  submitBtn.textContent = "Upload Report";
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GOOGLE DRIVE AUTO-FILL (Test ID → Report URL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxs2dYtmU6XLMERDduOMQKH84RzBL7IKz4Yl4M31lMy6dgb1xx1TdLRNtt9HFKVZBja/exec";

const testIdInput    = document.getElementById("rpt-test-id");
const reportUrlInput = document.getElementById("rpt-url");
const driveStatus    = document.createElement("p");
driveStatus.style.cssText = "font-size:12px;margin-top:4px;min-height:16px;";
testIdInput.parentElement.appendChild(driveStatus);

function driveJsonp(term) {
  return new Promise((resolve, reject) => {
    const cbName = "driveCallback_" + Date.now();
    const script = document.createElement("script");
    script.src = `${DRIVE_SCRIPT_URL}?q=${encodeURIComponent(term)}&callback=${cbName}`;
    window[cbName] = (data) => {
      delete window[cbName];
      document.head.removeChild(script);
      resolve(data);
    };
    script.onerror = () => {
      delete window[cbName];
      document.head.removeChild(script);
      reject(new Error("Script load failed"));
    };
    document.head.appendChild(script);
  });
}

let driveTimer;
testIdInput.addEventListener("input", function () {
  clearTimeout(driveTimer);
  const term = this.value.trim();
  driveStatus.textContent = "";
  driveStatus.style.color = "var(--text-soft)";
  if (term.length < 3) return;

  driveStatus.textContent = "Searching Drive…";
  driveTimer = setTimeout(async () => {
    try {
      const data = await driveJsonp(term);
      if (!data.files || data.files.length === 0) {
        driveStatus.textContent = "No file or folder found.";
        driveStatus.style.color = "var(--warning)";
        return;
      }
      const FOLDER_MIME = "application/vnd.google-apps.folder";
      const match = data.files.find(f => f.type === FOLDER_MIME) || data.files[0];
      if (match.type === FOLDER_MIME) {
        reportUrlInput.value    = `https://drive.google.com/drive/folders/${match.id}?usp=sharing`;
        driveStatus.textContent = `✓ Folder: ${match.name}`;
      } else {
        reportUrlInput.value    = `https://drive.google.com/file/d/${match.id}/view?usp=sharing`;
        driveStatus.textContent = `✓ File: ${match.name}`;
      }
      driveStatus.style.color = "var(--success)";
    } catch (err) {
      driveStatus.textContent = "Search failed: " + err.message;
      driveStatus.style.color = "var(--danger)";
    }
  }, 600);
});
