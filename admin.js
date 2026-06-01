import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, getDoc, collection, query, where, getDocs, updateDoc,
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

// ── Auth guard (admin only) ───────────────────────────────
let allUsers = [];
let allBookings = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    loadingEl.style.display = "none";
    accessDenied.style.display = "block";
    return;
  }

  document.getElementById("admin-subtitle").textContent =
    `Signed in as ${snap.data().displayName || user.email}`;

  loadingEl.style.display = "none";
  contentEl.style.display = "block";

  await Promise.all([
    loadUsers(),
    loadBookings(),
    loadResults(),
    loadReports()
  ]);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  USERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = [];
  snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));

  const pending  = allUsers.filter(u => u.status === "pending");
  const approved = allUsers.filter(u => u.status === "approved");

  document.getElementById("a-stat-pending").textContent     = pending.length;
  document.getElementById("a-stat-total-users").textContent  = allUsers.length;
  document.getElementById("tab-count-users").textContent     = pending.length;

  // Pending users table
  document.getElementById("users-loading").style.display = "none";
  if (pending.length === 0) {
    document.getElementById("users-empty").style.display = "block";
  } else {
    document.getElementById("users-table-wrap").style.display = "block";
    document.getElementById("users-table-wrap").innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Registered</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pending.map(u => `
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

  // All users table
  document.getElementById("all-users-loading").style.display = "none";
  document.getElementById("all-users-table-wrap").style.display = "block";
  document.getElementById("all-users-table-wrap").innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Status</th><th>Registered</th>
          </tr>
        </thead>
        <tbody>
          ${allUsers.map(u => `
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

  // Populate user dropdowns in results and reports forms
  const userSelect = document.getElementById("res-user");
  userSelect.innerHTML = '<option value="">Select user…</option>';
  approved.forEach(u => {
    userSelect.innerHTML += `<option value="${esc(u.id)}" data-email="${esc(u.email)}">${esc(u.displayName || u.email)} (${esc(u.company || "—")})</option>`;
  });

  const rptDatalist = document.getElementById("rpt-user-list");
  rptDatalist.innerHTML = "";
  approved.forEach(u => {
    const opt = document.createElement("option");
    opt.value = `${u.displayName || u.email} (${u.company || u.email})`;
    opt.dataset.uid   = u.id;
    opt.dataset.email = u.email;
    opt.dataset.name  = u.displayName || "";
    opt.dataset.company = u.company || "";
    rptDatalist.appendChild(opt);
  });

  document.getElementById("rpt-user-input").addEventListener("input", function() {
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

window._approve = async function(userId) {
  if (!confirm("Approve this user?")) return;
  await updateDoc(doc(db, "users", userId), { status: "approved" });
  await loadUsers();
};

window._reject = async function(userId) {
  if (!confirm("Reject this user?")) return;
  await updateDoc(doc(db, "users", userId), { status: "rejected" });
  await loadUsers();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BOOKINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadBookings() {
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  allBookings = [];
  snap.forEach(d => allBookings.push({ id: d.id, ...d.data() }));

  const active = allBookings.filter(b => !["completed", "cancelled"].includes((b.status || "").trim().toLowerCase()));
  document.getElementById("a-stat-bookings").textContent     = active.length;
  document.getElementById("tab-count-bookings").textContent  = allBookings.length;

  document.getElementById("bookings-loading").style.display = "none";

  if (allBookings.length === 0) {
    document.getElementById("bookings-empty").style.display = "block";
    return;
  }

  document.getElementById("bookings-table-wrap").style.display = "block";
  document.getElementById("bookings-table-wrap").innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th><th>Client</th><th>Category</th><th>Tests</th>
            <th>Samples</th><th>Delivery</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${allBookings.map(b => `
            <tr>
              <td>${formatDate(b.createdAt)}</td>
              <td>
                <strong>${esc(b.userName)}</strong><br>
                <small style="color:var(--text-soft)">${esc(b.userCompany || b.userEmail)}</small>
              </td>
              <td>${esc(b.category)}</td>
              <td style="max-width:200px;font-size:13px;">${esc(b.testDescription || "—")}</td>
              <td>${esc(String(b.quantity || 1))}</td>
              <td style="font-size:13px;">${esc(b.deliveryMethod || "—")}</td>
              <td>${badgeHTML(b.status)}</td>
              <td>
                <select class="form-select" style="font-size:13px;padding:6px 10px;min-width:130px;"
                  onchange="window._updateBooking('${b.id}', this.value)">
                  ${["pending","confirmed","in-progress","completed","cancelled"].map(s =>
                    `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`
                  ).join("")}
                </select>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;

  // Populate booking dropdown in results form
  const bookingSel = document.getElementById("res-booking");
  bookingSel.innerHTML = '<option value="">No linked booking</option>';
  allBookings.forEach(b => {
    bookingSel.innerHTML += `<option value="${b.id}">${esc(b.userName)} — ${esc(b.category)} (${formatDate(b.createdAt)})</option>`;
  });

  // ── Completed panel ────────────────────────────────────
  const completed = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "completed");
  document.getElementById("tab-count-completed").textContent = completed.length;

  if (completed.length === 0) {
    document.getElementById("completed-empty").style.display = "block";
  } else {
    document.getElementById("completed-table-wrap").style.display = "block";
    document.getElementById("completed-table-wrap").innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Client</th><th>Category</th><th>Tests</th>
              <th>Samples</th><th>Delivery</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${completed.map(b => `
              <tr>
                <td>${formatDate(b.createdAt)}</td>
                <td>
                  <strong>${esc(b.userName)}</strong><br>
                  <small style="color:var(--text-soft)">${esc(b.userCompany || b.userEmail)}</small>
                </td>
                <td>${esc(b.category)}</td>
                <td style="max-width:200px;font-size:13px;">${esc(b.testDescription || "—")}</td>
                <td>${esc(String(b.quantity || 1))}</td>
                <td style="font-size:13px;">${esc(b.deliveryMethod || "—")}</td>
                <td>
                  <select class="form-select" style="font-size:13px;padding:6px 10px;min-width:130px;"
                    onchange="window._updateBooking('${b.id}', this.value)">
                    ${["pending","confirmed","in-progress","completed","cancelled"].map(s =>
                      `<option value="${s}" ${s === "completed" ? "selected" : ""}>${s}</option>`
                    ).join("")}
                  </select>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  // ── In-Progress panel ──────────────────────────────────
  const inProgress = allBookings.filter(b => (b.status || "").trim().toLowerCase() === "in-progress");
  document.getElementById("tab-count-inprogress").textContent = inProgress.length;

  if (inProgress.length === 0) {
    document.getElementById("inprogress-empty").style.display = "block";
  } else {
    document.getElementById("inprogress-table-wrap").style.display = "block";
    document.getElementById("inprogress-table-wrap").innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Client</th><th>Category</th><th>Tests</th>
              <th>Samples</th><th>Delivery</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${inProgress.map(b => `
              <tr>
                <td>${formatDate(b.createdAt)}</td>
                <td>
                  <strong>${esc(b.userName)}</strong><br>
                  <small style="color:var(--text-soft)">${esc(b.userCompany || b.userEmail)}</small>
                </td>
                <td>${esc(b.category)}</td>
                <td style="max-width:200px;font-size:13px;">${esc(b.testDescription || "—")}</td>
                <td>${esc(String(b.quantity || 1))}</td>
                <td style="font-size:13px;">${esc(b.deliveryMethod || "—")}</td>
                <td>
                  <select class="form-select" style="font-size:13px;padding:6px 10px;min-width:130px;"
                    onchange="window._updateBooking('${b.id}', this.value)">
                    ${["pending","confirmed","in-progress","completed","cancelled"].map(s =>
                      `<option value="${s}" ${s === "in-progress" ? "selected" : ""}>${s}</option>`
                    ).join("")}
                  </select>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }
}

window._updateBooking = async function(bookingId, newStatus) {
  try {
    await updateDoc(doc(db, "bookings", bookingId), { status: newStatus });
    await loadBookings();
  } catch (err) {
    alert("Failed to update booking: " + err.message);
    await loadBookings();
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RESULTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadResults() {
  const q = query(collection(db, "results"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  document.getElementById("a-stat-results").textContent = snap.size;
  document.getElementById("results-loading").style.display = "none";

  if (snap.empty) {
    document.getElementById("results-empty").style.display = "block";
    return;
  }

  const results = [];
  snap.forEach(d => results.push({ id: d.id, ...d.data() }));

  document.getElementById("results-table-wrap").style.display = "block";
  document.getElementById("results-table-wrap").innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th><th>User</th><th>Test Name</th><th>Sample</th><th>Summary</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td>${formatDate(r.createdAt)}</td>
              <td>${esc(r.userEmail)}</td>
              <td>${esc(r.testName)}</td>
              <td>${esc(r.sampleType || "—")}</td>
              <td style="max-width:250px;font-size:13px;">${esc(r.summary || "—")}</td>
              <td>${badgeHTML(r.status || "completed")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Add result-data field rows ────────────────────────────
document.getElementById("add-field-btn").addEventListener("click", () => {
  const container = document.getElementById("result-fields");
  const row = document.createElement("div");
  row.className = "form-row";
  row.style.marginBottom = "8px";
  row.innerHTML = `
    <input class="form-input" type="text" placeholder="Parameter name" data-role="key">
    <input class="form-input" type="text" placeholder="Value" data-role="value">
  `;
  container.appendChild(row);
});

// ── Submit result ─────────────────────────────────────────
const resultForm = document.getElementById("result-form");
const resultAlert = document.getElementById("result-alert");

resultForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  resultAlert.className = "alert";

  const userSelect  = document.getElementById("res-user");
  const userId      = userSelect.value;
  const userEmail   = userSelect.selectedOptions[0]?.dataset?.email || "";
  const bookingId   = document.getElementById("res-booking").value;
  const testName    = document.getElementById("res-test-name").value.trim();
  const sampleType  = document.getElementById("res-sample-type").value.trim();
  const summary     = document.getElementById("res-summary").value.trim();
  const testedDate  = document.getElementById("res-tested-date").value;
  const reportUrl   = document.getElementById("res-report-url").value.trim();

  if (!userId || !testName || !summary) {
    resultAlert.textContent = "Please fill in all required fields.";
    resultAlert.className = "alert alert-danger show";
    return;
  }

  // Gather key-value pairs
  const resultData = {};
  document.querySelectorAll("#result-fields .form-row").forEach(row => {
    const key = row.querySelector('[data-role="key"]').value.trim();
    const val = row.querySelector('[data-role="value"]').value.trim();
    if (key) resultData[key] = val;
  });

  const submitBtn = document.getElementById("result-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing…";

  try {
    await addDoc(collection(db, "results"), {
      userId,
      userEmail,
      bookingId: bookingId || "",
      testName,
      sampleType,
      summary,
      resultData,
      testedDate: testedDate ? Timestamp.fromDate(new Date(testedDate)) : null,
      reportUrl,
      status: "completed",
      createdAt: serverTimestamp()
    });

    // If linked to a booking, mark it completed
    if (bookingId) {
      await updateDoc(doc(db, "bookings", bookingId), { status: "completed" });
    }

    resultAlert.textContent = "Result published successfully!";
    resultAlert.className = "alert alert-success show";
    resultForm.reset();

    // Reset dynamic fields to one row
    document.getElementById("result-fields").innerHTML = `
      <div class="form-row" style="margin-bottom:8px;">
        <input class="form-input" type="text" placeholder="Parameter name" data-role="key">
        <input class="form-input" type="text" placeholder="Value" data-role="value">
      </div>`;

    await loadResults();
  } catch (err) {
    console.error("Result publish error:", err);
    resultAlert.textContent = "Failed to publish result: " + err.message;
    resultAlert.className = "alert alert-danger show";
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Publish Result";
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let allReports = [];

function renderReportsTable(reports) {
  const wrap = document.getElementById("reports-admin-table-wrap");
  const noMatch = document.getElementById("reports-no-match");
  if (reports.length === 0) {
    wrap.style.display = "none";
    noMatch.style.display = "block";
    return;
  }
  noMatch.style.display = "none";
  wrap.style.display = "block";
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Client</th><th>Company</th><th>Project</th><th>Test ID</th><th>Notes</th><th>Report</th></tr>
        </thead>
        <tbody>
          ${reports.map(r => `
            <tr>
              <td>${formatDate(r.reportDate || r.createdAt)}</td>
              <td>${esc(r.clientName || r.userEmail || "—")}</td>
              <td style="font-size:13px;">${esc(r.companyName || "—")}</td>
              <td style="font-size:13px;">${esc(r.projectName || "—")}</td>
              <td style="font-size:13px;">${esc(r.testId || "—")}</td>
              <td style="font-size:13px;max-width:180px;">${esc(r.notes || "—")}</td>
              <td>${r.fileUrl ? `<a href="${esc(r.fileUrl)}" target="_blank" class="btn btn-secondary btn-sm">View</a>` : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

function applyReportsView() {
  const q    = document.getElementById("reports-search").value.trim().toLowerCase();
  const sort = document.getElementById("reports-sort").value;

  let list = allReports.filter(r => {
    if (!q) return true;
    const date = formatDate(r.reportDate || r.createdAt).toLowerCase();
    return (
      (r.testId      || "").toLowerCase().includes(q) ||
      (r.companyName || "").toLowerCase().includes(q) ||
      (r.clientName  || r.userEmail || "").toLowerCase().includes(q) ||
      (r.projectName || "").toLowerCase().includes(q) ||
      date.includes(q)
    );
  });

  list = [...list].sort((a, b) => {
    const str = f => (f || "").toLowerCase();
    const ts  = r => (r.reportDate || r.createdAt)?.toMillis?.() ?? 0;
    if (sort === "date-desc")    return ts(b) - ts(a);
    if (sort === "date-asc")     return ts(a) - ts(b);
    if (sort === "client-asc")   return str(a.clientName || a.userEmail).localeCompare(str(b.clientName || b.userEmail));
    if (sort === "client-desc")  return str(b.clientName || b.userEmail).localeCompare(str(a.clientName || a.userEmail));
    if (sort === "company-asc")  return str(a.companyName).localeCompare(str(b.companyName));
    if (sort === "testid-asc")   return str(a.testId).localeCompare(str(b.testId));
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

  document.getElementById("reports-search-bar").style.display = "flex";
  document.getElementById("reports-search").value = "";
  document.getElementById("reports-sort").value = "date-desc";
  renderReportsTable(allReports);
}

const reportForm = document.getElementById("report-form");
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
    reportAlert.className = "alert alert-danger show";
    return;
  }

  const submitBtn = document.getElementById("report-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading…";

  try {
    await addDoc(collection(db, "reports"), {
      userId:      userId || "",
      userEmail:   userEmail || userInput,
      testId,
      companyName,
      clientName,
      projectName,
      notes,
      fileUrl,
      reportDate: dateVal ? Timestamp.fromDate(new Date(dateVal)) : null,
      createdAt: serverTimestamp()
    });

    reportAlert.textContent = "Report uploaded successfully!";
    reportAlert.className = "alert alert-success show";
    reportForm.reset();
    await loadReports();
  } catch (err) {
    console.error("Report upload error:", err);
    reportAlert.textContent = "Failed to upload report: " + err.message;
    reportAlert.className = "alert alert-danger show";
  }

  submitBtn.disabled = false;
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
        reportUrlInput.value = `https://drive.google.com/drive/folders/${match.id}?usp=sharing`;
        driveStatus.textContent = `✓ Folder: ${match.name}`;
      } else {
        reportUrlInput.value = `https://drive.google.com/file/d/${match.id}/view?usp=sharing`;
        driveStatus.textContent = `✓ File: ${match.name}`;
      }
      driveStatus.style.color = "var(--success)";
    } catch (err) {
      driveStatus.textContent = "Search failed: " + err.message;
      driveStatus.style.color = "var(--danger)";
    }
  }, 600);
});
