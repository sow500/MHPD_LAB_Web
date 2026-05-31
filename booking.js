import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, getDoc, collection, addDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ── Service data (mirrors main site) ──────────────────────
const serviceTests = {
  "Coarse Aggregate": [
    "Coarse Aggregate Test (concrete)", "Coarse Aggregate Test (road)",
    "Specific Gravity and Absorption", "Sieve Analysis",
    "Particle Shape Test", "Bulk Density and Voids",
    "Clay Lumps and Friable Particles", "Los Angeles Abrasion",
    "Aggregate Impact Value", "Aggregate Crushing Value and 10% Fines",
    "Uniaxial Compressive Strength (Rock Core)", "Uniaxial Compressive Strength (6x9)",
    "Magnesium Sulphate Soundness", "Particles Finer than #200",
    "Alkali-Silica Reaction (Mortar Bar)", "Alkali-Silica Reaction (Chemical)",
    "Mohs Scale Hardness"
  ],
  "Fine Aggregate": [
    "Fine Aggregate Test (excl. 5 cycle)", "Specific Gravity and Absorption",
    "Sieve Analysis (FM)", "Clay Lumps and Friable Particles",
    "Bulk Density and Voids", "Organic Impurities",
    "Particles Finer than #200", "Magnesium Sulphate Soundness"
  ],
  "Soil": [
    "Soil Test (excl. modified compaction)", "Soil Test (excl. standard compaction)",
    "Soil Penetration Test (SPT)", "Atterberg Limits",
    "Particle Size Analysis", "Lab Compaction (Standard)",
    "Lab Compaction (Modified)", "Specific Gravity (SPG)",
    "Absorption Test", "Laboratory CBR", "Direct Shear Test"
  ],
  "Rebar": [
    "6mm Tensile", "8mm Tensile", "10mm Tensile", "12mm Tensile",
    "14mm Tensile", "16mm Tensile", "18mm Tensile", "20mm Tensile",
    "22mm Tensile", "25mm Tensile", "Over 25mm Tensile",
    "6mm Bending", "8mm Bending", "10mm Bending", "12mm Bending",
    "14mm Bending", "16mm Bending", "18mm Bending", "20mm Bending",
    "22mm Bending", "25mm Bending", "Over 25mm Bending"
  ],
  "Structural Member": [
    "H / I Beam", "Hollow Section", "Channel", "GI Sheet", "Dimension and Thickness"
  ],
  "In Situ": [
    "Plate Bearing Test (Field CBR)", "Dynamic Cone Penetrometer (DCP)",
    "Field Density (Sand Cone)", "Rebound Hammer",
    "UPV Test", "Rebar Scanner", "Crack Detection"
  ],
  "Concrete": [
    "Concrete Mix Design (by Weight)", "Concrete Mix Design (by Volume)",
    "Compressive Strength Test", "Air Content (Pressure or Volume)"
  ],
  "Brick": [
    "Brick Compressive Strength", "Initial Rate of Absorption"
  ],
  "Cement": [
    "Specific Gravity", "Soundness", "Compressive Strength (Mortar)",
    "Time of Setting and Normal Consistency", "Fineness (Air-Permeability)",
    "Fineness (Sieving)", "Air Content of Mortar", "Cement Test (excl. air content)"
  ],
  "Water": [
    "pH", "Alkalinity (CaCO3)", "Ammonia", "Arsenic", "Chloride",
    "Colour", "Conductivity", "Fluoride", "Iron (Fe)", "Manganese (Mn)",
    "Nitrate", "Nitrite", "Potassium", "Phosphate", "Total Chlorine",
    "Salinity", "Silica", "Sulfate", "TDS", "Total Hardness",
    "Total Solid Suspended", "Turbidity", "Calcium", "Phosphorus"
  ],
  "Pipe": [
    "PVC Pipe Pressure (4.5in to 3in)", "PVC Pipe Pressure (3in to 2in)",
    "PVC Pipe Pressure (2in to 1in)", "PVC Pipe Pressure (1in and below)"
  ],
  "Grade / Mix Ratio": [
    "G-15", "G-20", "G-25", "G-30", "G-35", "G-40", "G-45",
    "1500 PSI", "2000 PSI", "2500 PSI", "3000 PSI", "3250 PSI",
    "4000 PSI", "4250 PSI", "4500 PSI", "5000 PSI",
    "1:3:6", "1:2:4", "1:1.5:3", "1:2:3", "1:2:2", "1:2", "1:3", "1:4"
  ]
};

// ── DOM refs ──────────────────────────────────────────────
const loadingEl     = document.getElementById("loading");
const contentEl     = document.getElementById("content");
const alertBox      = document.getElementById("booking-alert");
const form          = document.getElementById("booking-form");
const categorySel   = document.getElementById("category");
const testGroup     = document.getElementById("test-select-group");
const testContainer = document.getElementById("test-checkboxes");
const submitBtn     = document.getElementById("submit-btn");

// ── Nav toggle ────────────────────────────────────────────
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
function showAlert(msg, type = "danger") {
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type} show`;
  alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ── Set min date to today ─────────────────────────────────
const dateInput = document.getElementById("preferred-date");
const today = new Date().toISOString().split("T")[0];
dateInput.setAttribute("min", today);

// ── Dynamic test checkboxes ───────────────────────────────
categorySel.addEventListener("change", () => {
  const cat = categorySel.value;
  const tests = serviceTests[cat];
  if (tests) {
    testContainer.innerHTML = tests.map((t, i) => `
      <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
        <input type="checkbox" name="tests" value="${esc(t)}" style="accent-color:var(--accent);">
        ${esc(t)}
      </label>
    `).join("");
    testGroup.style.display = "block";
  } else {
    testGroup.style.display = "none";
    testContainer.innerHTML = "";
  }
});

// ── Auth guard ────────────────────────────────────────────
let currentUser = null;
let userProfile = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().status !== "approved") {
    window.location.href = "dashboard.html";
    return;
  }

  currentUser = user;
  userProfile = snap.data();
  loadingEl.style.display = "none";
  contentEl.style.display = "block";
});

// ── Submit booking ────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedTests = Array.from(
    document.querySelectorAll('input[name="tests"]:checked')
  ).map(cb => cb.value);

  const category    = categorySel.value;
  const description = document.getElementById("description").value.trim();
  const quantity    = parseInt(document.getElementById("quantity").value, 10);
  const prefDate    = document.getElementById("preferred-date").value;
  const project     = document.getElementById("project-name").value.trim();
  const delivery    = document.getElementById("collection").value;
  const notes       = document.getElementById("notes").value.trim();

  if (!category) {
    showAlert("Please select a sample category.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    await addDoc(collection(db, "bookings"), {
      userId:          currentUser.uid,
      userEmail:       currentUser.email,
      userName:        userProfile.displayName || currentUser.displayName || "",
      userCompany:     userProfile.company || "",
      category:        category,
      selectedTests:   selectedTests,
      testDescription: description || selectedTests.join(", ") || category,
      quantity:        quantity,
      preferredDate:   Timestamp.fromDate(new Date(prefDate)),
      projectName:     project,
      deliveryMethod:  delivery,
      notes:           notes,
      status:          "pending",
      adminNotes:      "",
      createdAt:       serverTimestamp()
    });

    showAlert("Booking submitted successfully! Our team will review it shortly.", "success");
    form.reset();
    testGroup.style.display = "none";

    setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
  } catch (err) {
    console.error("Booking error:", err);
    showAlert("Failed to submit booking. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Booking";
  }
});
