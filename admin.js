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
    loadResults()
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

  // Populate user dropdown in results form
  const userSelect = document.getElementById("res-user");
  userSelect.innerHTML = '<option value="">Select user…</option>';
  approved.forEach(u => {
    userSelect.innerHTML += `<option value="${esc(u.id)}" data-email="${esc(u.email)}">${esc(u.displayName || u.email)} (${esc(u.company || "—")})</option>`;
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

  const active = allBookings.filter(b => !["completed", "cancelled"].includes(b.status));
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
}

window._updateBooking = async function(bookingId, newStatus) {
  try {
    await updateDoc(doc(db, "bookings", bookingId), { status: newStatus });
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
