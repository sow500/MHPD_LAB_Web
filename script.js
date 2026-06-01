// Hamburger menu
const navToggle = document.getElementById("nav-toggle");
const mainNav = document.getElementById("main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.classList.toggle("is-open");
    mainNav.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.classList.remove("is-open");
      mainNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const serviceGroups = [
  {
    title: "Coarse Aggregate",
    icon: "layers",
    items: [
      "Coarse Aggregate Test (concrete)",
      "Coarse Aggregate Test (road)",
      "Coarse Aggregate Test (all test 15,16,18,19 excluded)",
      "Specific Gravity and Absorption of Coarse Aggregate",
      "Sieve Analysis of Coarse Aggregate",
      "Particle Shape Test of Coarse Aggregate",
      "Bulk Density (Unit Weight) and Voids in Aggregate",
      "Clay Lumps and Friable Particles in Aggregate",
      "Aggregate by Abrasion and Impact in the Los Angeles Machine",
      "Aggregate Impact Value",
      "Aggregate Crushing Value and 10% Fines Value",
      "Uniaxial Compressive Strength Test (Rock Core)",
      "Uniaxial Compressive Strength Test (6 x 9)",
      "Magnesium Sulphate Soundness Test (5 Cycle Soundness)",
      "Particles Finer than #200 Sieve",
      "Alkali-Silica Reaction Test (Mortar Bar Method)",
      "Alkali-Silica Reaction Test (Chemical Method)",
      "Mohs Scale Hardness"
    ]
  },
  {
    title: "Fine Aggregate",
    icon: "grid-3x3",
    items: [
      "Fine Aggregate Test (excluding 5 cycle test)",
      "Specific Gravity and Absorption of Fine Aggregate",
      "Sieve Analysis of Fine Aggregate (FM)",
      "Clay Lumps and Friable Particles in Aggregate",
      "Bulk Density (Unit Weight) and Voids in Aggregate",
      "Organic Impurities Test",
      "Particles Finer than #200 Sieve",
      "Magnesium Sulphate Soundness Test (5 Cycle Soundness)"
    ]
  },
  {
    title: "Soil",
    icon: "sprout",
    items: [
      "Soil Test (excluding modified compaction test)",
      "Soil Test (excluding standard compaction test)",
      "Soil Penetration Test (SPT)",
      "Atterberg Limits Test",
      "Particle Size Analysis Test (Grain Size Distribution)",
      "Laboratory Compaction Test (Standard)",
      "Laboratory Compaction Test (Modified Effort)",
      "Specific Gravity Test (SPG)",
      "Absorption Test",
      "Laboratory CBR Test",
      "Direct Shear Test"
    ]
  },
  {
    title: "Rebar",
    icon: "grip-vertical",
    items: [
      "6 mm Tensile Strength Test",
      "8 mm Tensile Strength Test",
      "10 mm Tensile Strength Test",
      "12 mm Tensile Strength Test",
      "14 mm Tensile Strength Test",
      "16 mm Tensile Strength Test",
      "18 mm Tensile Strength Test",
      "20 mm Tensile Strength Test",
      "22 mm Tensile Strength Test",
      "25 mm Tensile Strength Test",
      "Over 25 mm Tensile Strength Test",
      "6 mm Bending Test",
      "8 mm Bending Test",
      "10 mm Bending Test",
      "12 mm Bending Test",
      "14 mm Bending Test",
      "16 mm Bending Test",
      "18 mm Bending Test",
      "20 mm Bending Test",
      "22 mm Bending Test",
      "25 mm Bending Test",
      "Over 25 mm Bending Test"
    ]
  },
  {
    title: "Structural Member",
    icon: "frame",
    items: [
      "H / I Beam",
      "Hollow Section",
      "Channel",
      "GI Sheet",
      "Dimension and Thickness"
    ]
  },
  {
    title: "In Situ",
    icon: "map-pin",
    items: [
      "Plate Bearing Test (Field CBR)",
      "Dynamic Cone Penetrometer Test (DCP)",
      "Field Density Test (Sand Cone Method)",
      "Rebound Hammer Test",
      "UPV Test",
      "Rebar Scanner",
      "Crack Detection"
    ]
  },
  {
    title: "Concrete",
    icon: "building-2",
    items: [
      "Concrete Mix Design (by Weight)",
      "Concrete Mix Design (by Volume)",
      "Concrete Compressive Strength Test",
      "Air Content of Concrete (by Pressure or Volume)"
    ]
  },
  {
    title: "Brick",
    icon: "layout-grid",
    items: [
      "Brick Compressive Strength Test",
      "Initial Rate of Absorption"
    ]
  },
  {
    title: "Cement",
    icon: "flask-conical",
    items: [
      "Specific Gravity of Cement",
      "Soundness of Cement",
      "Compressive Strength of Cement (Mortar Test)",
      "Time of Setting and Normal Consistency of Cement",
      "Fineness of Cement (by Air-Permeability)",
      "Fineness of Cement (by Sieving)",
      "Air Content of Mortar (by Pressure)",
      "Cement Test (excluding air content test)"
    ]
  },
  {
    title: "Water",
    icon: "droplets",
    items: [
      "Acid / Basicity (pH)",
      "Alkalinity (CaCO3)",
      "Ammonia (NH3-N)",
      "Arsenic",
      "Chloride (Cl)",
      "Colour",
      "Conductivity",
      "Fluoride",
      "Iron (Fe)",
      "Manganese (Mn)",
      "Nitrate (NO3-N)",
      "Nitrite (NO3-N)",
      "Potassium (K+)",
      "Phosphate (PO43-)",
      "Total Chlorine (Cl2)",
      "Salinity",
      "Silica (SiO2)",
      "Sulfate (SO4)",
      "Total Dissolved Solids (TDS)",
      "Total Hardness",
      "Total Solid Suspended",
      "Turbidity",
      "Calcium",
      "Phosphorus"
    ]
  },
  {
    title: "Rental",
    icon: "wrench",
    items: [
      "Mould rental",
      "Slump cone rental",
      "Mould tamping rod",
      "Slump cone tamping rod"
    ]
  },
  {
    title: "Pipe",
    icon: "cylinder",
    items: [
      "PVC Pipe Pressure Test (4.5 inch to over 3 inch)",
      "PVC Pipe Pressure Test (3 inch to over 2 inch)",
      "PVC Pipe Pressure Test (2 inch to over 1 inch)",
      "PVC Pipe Pressure Test (1 inch and below)"
    ]
  },
  {
    title: "Grade / Mix Ratio",
    icon: "scale",
    items: [
      "G-15",
      "G-20",
      "G-25",
      "G-30",
      "G-35",
      "G-40",
      "G-45",
      "1500 PSI",
      "2000 PSI",
      "2500 PSI",
      "3000 PSI",
      "3250 PSI",
      "4000 PSI",
      "4250 PSI",
      "4500 PSI",
      "5000 PSI",
      "1:3:6",
      "1:2:4",
      "1:1.5:3",
      "1:2:3",
      "1:2:2",
      "1:2",
      "1:3",
      "1:4"
    ]
  }
];

const serviceGrid = document.querySelector("#service-grid");

if (serviceGrid) {
  serviceGrid.innerHTML = serviceGroups
    .map((group, index) => {
      const panelId = `service-panel-${index + 1}`;
      const items = group.items
        .map((item) => `<li>${item}</li>`)
        .join("");

      return `
        <article class="service-card service-accordion">
          <button
            class="service-toggle"
            type="button"
            aria-expanded="false"
            aria-controls="${panelId}"
          >
            <span class="service-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="service-toggle-copy">
              <span class="service-toggle-title">
                ${group.title}<i data-lucide="${group.icon}" class="service-icon" aria-hidden="true"></i>
              </span>
              <span class="service-count">${group.items.length} services</span>
            </span>
            <span class="service-toggle-icon" aria-hidden="true"></span>
          </button>
          <div class="service-panel" id="${panelId}">
            <div class="service-panel-inner">
              <ul class="service-list">
                ${items}
              </ul>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  lucide.createIcons();
}

document.querySelectorAll(".service-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".service-accordion");
    const panel = card?.querySelector(".service-panel");
    const isOpen = button.getAttribute("aria-expanded") === "true";

    document.querySelectorAll(".service-accordion").forEach((item) => {
      item.classList.remove("is-open");
    });

    document.querySelectorAll(".service-toggle").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });

    document.querySelectorAll(".service-panel").forEach((section) => {
      section.classList.remove("is-open");
    });

    if (!isOpen && card && panel) {
      card.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      panel.classList.add("is-open");
    }
  });
});

const albumSlides = document.querySelectorAll(".album-slide");
const albumPhotos = document.querySelectorAll(".album-photo");
const albumDotBtns = document.querySelectorAll(".album-dot");
const albumPrevBtn = document.getElementById("album-prev");
const albumNextBtn = document.getElementById("album-next");
const albumCurrentEl = document.getElementById("album-current");
let albumIndex = 0;

function goToAlbumSlide(next) {
  const total = albumSlides.length;
  albumSlides[albumIndex].classList.remove("is-active");
  albumPhotos[albumIndex].classList.remove("is-active");
  albumDotBtns[albumIndex].classList.remove("is-active");

  albumIndex = (next + total) % total;

  albumSlides[albumIndex].classList.add("is-active");
  albumPhotos[albumIndex].classList.add("is-active");
  albumDotBtns[albumIndex].classList.add("is-active");

  if (albumCurrentEl) albumCurrentEl.textContent = albumIndex + 1;
}

albumPrevBtn?.addEventListener("click", () => goToAlbumSlide(albumIndex - 1));
albumNextBtn?.addEventListener("click", () => goToAlbumSlide(albumIndex + 1));
albumDotBtns.forEach((dot, i) => dot.addEventListener("click", () => goToAlbumSlide(i)));

const certModal    = document.getElementById("cert-modal");
const certClose    = document.getElementById("cert-close");
const certBackdrop = document.getElementById("cert-backdrop");
const certModalImg = document.getElementById("cert-modal-img");
const certModalTitle = document.getElementById("cert-modal-title");

function openCert(src, title) {
  certModalImg.src = src;
  certModalImg.alt = title + " – MHPD Lab";
  certModalTitle.textContent = title;
  certModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeCert() {
  certModal.classList.remove("is-open");
  document.body.style.overflow = "";
}

document.querySelectorAll(".doc-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    openCert(btn.dataset.docSrc, btn.dataset.docTitle);
  });
});

certClose?.addEventListener("click", closeCert);
certBackdrop?.addEventListener("click", closeCert);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && certModal.classList.contains("is-open")) closeCert();
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18
  }
);

document
  .querySelectorAll(".service-card, .feature-card, .about-panel, .contact-card, .site-footer")
  .forEach((element) => {
    observer.observe(element);
  });

// Person contact tabs
document.querySelectorAll(".person-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetId = tab.dataset.tab;
    tab.closest(".person-tabs").querySelectorAll(".person-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.closest(".person-tabs").querySelectorAll(".person-panel").forEach((p) => {
      p.classList.remove("active");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(targetId).classList.add("active");
  });
});

// Total test count — script tag (JSONP) via Apps Script Web App
window._testCountCb = function(data) {
  const n = data && data.count;
  if (typeof n === 'number') {
    const el = document.getElementById('total-tests-count');
    if (el) el.textContent = Math.round(n).toLocaleString() + '+';
  }
};
(function() {
  const s = document.createElement('script');
  s.src = 'https://script.google.com/macros/s/AKfycbwUCVL8dMZwePJgI_cUYCaYd85QzxPLFEGnG5pgJHHeM5oS8r2VlL1s2R9aeAwGH_3bPg/exec';
  s.onerror = function() {};
  document.head.appendChild(s);
})();
