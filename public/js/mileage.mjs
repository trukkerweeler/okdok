import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const mileageUrl = `${apiUrl}/accounting/mileage`;
const propertiesUrl = `${apiUrl}/accounting/properties`;

let user;
let properties = [];
let mileage = [];

// IRS standard mileage rates by year — fallback defaults
// Source: https://www.irs.gov/tax-professionals/standard-mileage-rates
const DEFAULT_MILEAGE_RATES = {
  2022: 0.585, // Jan–Jun; IRS raised mid-year to 0.625 Jul–Dec
  2023: 0.655,
  2024: 0.67,
  2025: 0.7,
  2026: 0.725,
};

// Active rates — defaults merged with any values saved in Settings
let activeRates = { ...DEFAULT_MILEAGE_RATES };

function getMileageRate(year) {
  return (
    activeRates[year] ??
    activeRates[Math.max(...Object.keys(activeRates).map(Number))]
  );
}

// Backwards-compat alias used by existing code
const IRS_MILEAGE_RATE = getMileageRate(new Date().getFullYear());

// Currently selected tax year (defaults to current calendar year)
let selectedYear = new Date().getFullYear();

// Initialize handler function
async function initializeMileage() {
  console.debug("[mileage.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadMileageRatesFromSettings();
  await loadReferenceData();
  await loadMileageData();
  populateYearFilter();
  setDefaultDate();
  updateStatistics();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMileage);
} else {
  initializeMileage();
}

function setupEventListeners() {
  // Add Mileage button
  const addMileageBtn = document.getElementById("addMileageBtn");
  if (addMileageBtn) {
    addMileageBtn.addEventListener("click", openAddMileageDialog);
  }

  // Close button for add mileage dialog
  const closeAddBtn = document.getElementById("closeAddMileageBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addMileageDialog").close();
    });
  }

  // Save mileage form
  const addMileageForm = document.getElementById("addMileageForm");
  if (addMileageForm) {
    addMileageForm.addEventListener("submit", saveMileage);
  }

  // Close dialog on outside click
  const addMileageDialog = document.getElementById("addMileageDialog");
  if (addMileageDialog) {
    addMileageDialog.addEventListener("click", (e) => {
      if (e.target === addMileageDialog) {
        addMileageDialog.close();
      }
    });
  }

  // Close button for edit mileage dialog
  const closeEditBtn = document.getElementById("closeEditMileageBtn");
  if (closeEditBtn) {
    closeEditBtn.addEventListener("click", () => {
      document.getElementById("editMileageDialog").close();
    });
  }

  // Save edit mileage form
  const editMileageForm = document.getElementById("editMileageForm");
  if (editMileageForm) {
    editMileageForm.addEventListener("submit", saveEditMileage);
  }

  // Close edit dialog on outside click
  const editMileageDialog = document.getElementById("editMileageDialog");
  if (editMileageDialog) {
    editMileageDialog.addEventListener("click", (e) => {
      if (e.target === editMileageDialog) {
        editMileageDialog.close();
      }
    });
  }
}

async function loadMileageRatesFromSettings() {
  try {
    const response = await fetch(`${apiUrl}/accounting/company-settings`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const settings = await response.json();
    Object.entries(settings).forEach(([key, value]) => {
      const match = key.match(/^mileage_rate_(\d{4})$/);
      if (match) {
        activeRates[parseInt(match[1])] = parseFloat(value);
      }
    });
  } catch {
    // silently fall back to hardcoded defaults
  }
}

async function loadReferenceData() {
  try {
    // Load properties
    const propertiesResponse = await fetch(propertiesUrl, {
      credentials: "include",
    });
    if (propertiesResponse.ok) {
      properties = await propertiesResponse.json();
      populatePropertyDropdown();
    }
  } catch (error) {
    console.error("Error loading reference data:", error);
  }
}

function populatePropertyDropdown() {
  const propertySelect = document.getElementById("mileageProperty");
  if (!propertySelect) return;

  propertySelect.innerHTML = '<option value="">Select a property...</option>';

  properties.forEach((prop) => {
    const option = document.createElement("option");
    option.value = prop.id;
    option.textContent = `${prop.address}, ${prop.city}, ${prop.state}`;
    propertySelect.appendChild(option);
  });

  // Also populate edit dialog property dropdown
  const editPropertySelect = document.getElementById("editMileageProperty");
  if (editPropertySelect) {
    editPropertySelect.innerHTML =
      '<option value="">Select a property...</option>';
    properties.forEach((prop) => {
      const option = document.createElement("option");
      option.value = prop.id;
      option.textContent = `${prop.address}, ${prop.city}, ${prop.state}`;
      editPropertySelect.appendChild(option);
    });
  }
}

function setDefaultDate() {
  const dateInput = document.getElementById("mileageDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
}

function openAddMileageDialog() {
  const form = document.getElementById("addMileageForm");
  if (form) {
    form.reset();
  }
  setDefaultDate();
  document.getElementById("addMileageDialog").showModal();
}

async function saveMileage(event) {
  event.preventDefault();
  const form = document.getElementById("addMileageForm");
  const formData = new FormData(form);

  try {
    const dataJson = {
      date: formData.get("date"),
      miles_driven: parseFloat(formData.get("miles_driven")),
      starting_location: formData.get("starting_location") || null,
      ending_location: formData.get("ending_location") || null,
      purpose: formData.get("purpose"),
      category: formData.get("category"),
      property_id: formData.get("property_id")
        ? parseInt(formData.get("property_id"))
        : null,
      owner_id: user?.id || null,
      notes: formData.get("notes") || null,
    };

    const response = await fetch(mileageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to save mileage"}`);
      return;
    }

    const newMileage = await response.json();
    console.log("Mileage saved:", newMileage);

    // Close dialog and refresh list
    document.getElementById("addMileageDialog").close();
    await loadMileageData();
    updateStatistics();
  } catch (error) {
    console.error("Error saving mileage:", error);
    alert(`Error: ${error.message}`);
  }
}

async function loadMileageData() {
  try {
    const response = await fetch(mileageUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch mileage");
    }

    mileage = await response.json();
    console.debug("Mileage loaded:", mileage);
    displayMileage();
  } catch (error) {
    console.error("Error loading mileage:", error);
    alert(`Error loading mileage: ${error.message}`);
  }
}

function displayMileage() {
  const tbody = document.getElementById("mileageTableBody");
  if (!tbody) return;

  // Filter to the selected tax year
  const filtered = mileage.filter(
    (entry) => new Date(entry.date).getFullYear() === selectedYear,
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No mileage entries for ${selectedYear}. Click the + button to add one.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((entry) => {
      const categoryDisplay = formatCategory(entry.category);
      const locations = entry.starting_location
        ? `${entry.starting_location} → ${entry.ending_location || "?"}`
        : "Not specified";

      const milesValue = parseFloat(entry.miles_driven) || 0;

      return `
        <tr>
          <td>${formatDate(entry.date)}</td>
          <td><span class="badge bg-info">${categoryDisplay}</span></td>
          <td>${entry.purpose}</td>
          <td>${entry.property_address ? entry.property_address : "-"}</td>
          <td class="fw-bold">${milesValue.toFixed(1)} mi</td>
          <td class="small">${locations}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="editMileage(${entry.id})">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteMileage(${entry.id})">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function deleteMileage(id) {
  if (!confirm("Are you sure you want to delete this mileage entry?")) {
    return;
  }

  try {
    const response = await fetch(`${mileageUrl}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete mileage entry");
    }

    await loadMileageData();
    updateStatistics();
  } catch (error) {
    console.error("Error deleting mileage:", error);
    alert(`Error: ${error.message}`);
  }
}

function formatCategory(category) {
  const categoryMap = {
    property_visit: "Property Visit",
    tenant_meeting: "Tenant Meeting",
    maintenance: "Maintenance",
    supply_run: "Supply Run",
    posting: "Posting",
    inspection: "Inspection",
    showing: "Showing",
    other: "Other",
  };
  return categoryMap[category] || category;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function updateStatistics() {
  // Filter for the selected tax year
  const yearEntries = mileage.filter(
    (entry) => new Date(entry.date).getFullYear() === selectedYear,
  );

  const totalMiles = yearEntries.reduce(
    (sum, entry) => sum + (parseFloat(entry.miles_driven) || 0),
    0,
  );
  const tripCount = yearEntries.length;
  const avgMiles = tripCount > 0 ? totalMiles / tripCount : 0;
  const taxDeduction = totalMiles * getMileageRate(selectedYear);

  const thisMonthMilesEl = document.getElementById("thisMonthMiles");
  if (thisMonthMilesEl) thisMonthMilesEl.textContent = totalMiles.toFixed(1);

  const thisMonthTripsEl = document.getElementById("thisMonthTrips");
  if (thisMonthTripsEl) thisMonthTripsEl.textContent = tripCount;

  const taxDeductionEl = document.getElementById("taxDeduction");
  if (taxDeductionEl)
    taxDeductionEl.textContent = `$${taxDeduction.toFixed(2)}`;

  const rateLabel = document.getElementById("taxRateLabel");
  if (rateLabel)
    rateLabel.textContent = `${selectedYear} Rate: $${getMileageRate(selectedYear).toFixed(3)}/mi`;

  const avgMilesEl = document.getElementById("avgMiles");
  if (avgMilesEl) avgMilesEl.textContent = avgMiles.toFixed(1);
}

function populateYearFilter() {
  const select = document.getElementById("yearFilter");
  if (!select) return;

  const currentYear = new Date().getFullYear();
  const years = [
    ...new Set(mileage.map((e) => new Date(e.date).getFullYear())),
  ];
  if (!years.includes(currentYear)) years.push(currentYear);
  years.sort((a, b) => b - a);

  select.innerHTML = years
    .map(
      (y) =>
        `<option value="${y}"${y === selectedYear ? " selected" : ""}>${y}</option>`,
    )
    .join("");

  select.onchange = () => {
    selectedYear = parseInt(select.value);
    displayMileage();
    updateStatistics();
  };

  const printBtn = document.getElementById("printTaxSummaryBtn");
  if (printBtn) printBtn.onclick = printTaxSummary;
}

function printTaxSummary() {
  const yearEntries = mileage
    .filter((e) => new Date(e.date).getFullYear() === selectedYear)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const totalMiles = yearEntries.reduce(
    (sum, e) => sum + (parseFloat(e.miles_driven) || 0),
    0,
  );
  const yearRate = getMileageRate(selectedYear);
  const totalDeduction = totalMiles * yearRate;

  // Aggregate by category
  const byCategory = {};
  yearEntries.forEach((e) => {
    byCategory[e.category] =
      (byCategory[e.category] || 0) + (parseFloat(e.miles_driven) || 0);
  });

  // Aggregate by property
  const byProperty = {};
  yearEntries.forEach((e) => {
    const key = e.property_address || "Unassigned";
    byProperty[key] =
      (byProperty[key] || 0) + (parseFloat(e.miles_driven) || 0);
  });

  const categoryRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, miles]) =>
        `<tr><td>${formatCategory(cat)}</td><td>${miles.toFixed(1)}</td><td>$${(miles * yearRate).toFixed(2)}</td></tr>`,
    )
    .join("");

  const propertyRows = Object.entries(byProperty)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([prop, miles]) =>
        `<tr><td>${prop}</td><td>${miles.toFixed(1)}</td><td>$${(miles * yearRate).toFixed(2)}</td></tr>`,
    )
    .join("");

  const detailRows = yearEntries
    .map(
      (e) =>
        `<tr><td>${formatDate(e.date)}</td><td>${formatCategory(e.category)}</td><td>${e.purpose}</td><td>${e.property_address || "-"}</td><td>${parseFloat(e.miles_driven).toFixed(1)}</td><td>${e.starting_location || ""}${e.ending_location ? " &rarr; " + e.ending_location : ""}</td></tr>`,
    )
    .join("");

  const noData = "<tr><td colspan='3' style='color:#999'>No entries</td></tr>";
  const noDataDetail =
    "<tr><td colspan='6' style='color:#999'>No entries</td></tr>";

  const win = window.open("", "_blank");
  win.document.write(`<!doctype html>
<html>
<head>
  <title>Mileage Tax Summary ${selectedYear}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #222; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0f0f0; text-align: left; padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; }
    td { padding: 4px 8px; border: 1px solid #ddd; }
    .summary-box { background: #f5f5f5; border: 2px solid #333; padding: 14px 22px; margin: 16px 0; display: inline-block; border-radius: 4px; }
    .total { font-size: 15px; font-weight: bold; margin: 3px 0; }
    .note { color: #999; font-size: 10px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 8px; }
    .print-btn { float: right; padding: 6px 14px; cursor: pointer; font-size: 12px; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <h1>Mileage Tax Summary &mdash; ${selectedYear}</h1>
  <p>IRS Standard Mileage Rate: <strong>\$${yearRate.toFixed(3)}/mile</strong> &nbsp;&bull;&nbsp; ${yearEntries.length} trip${yearEntries.length !== 1 ? "s" : ""} recorded</p>
  <div class="summary-box">
    <div class="total">Total Miles: ${totalMiles.toFixed(1)}</div>
    <div class="total">Total Deduction: \$${totalDeduction.toFixed(2)}</div>
  </div>
  <h2>By Category</h2>
  <table><thead><tr><th>Category</th><th>Miles</th><th>Deduction</th></tr></thead>
  <tbody>${categoryRows || noData}</tbody></table>
  <h2>By Property</h2>
  <table><thead><tr><th>Property</th><th>Miles</th><th>Deduction</th></tr></thead>
  <tbody>${propertyRows || noData}</tbody></table>
  <h2>Detail Log</h2>
  <table><thead><tr><th>Date</th><th>Category</th><th>Purpose</th><th>Property</th><th>Miles</th><th>Route</th></tr></thead>
  <tbody>${detailRows || noDataDetail}</tbody></table>
  <p class="note">Generated ${new Date().toLocaleDateString()} &bull; Verify the IRS standard mileage rate for tax year ${selectedYear} at irs.gov before filing.</p>
</body>
</html>`);
  win.document.close();
}

// Make functions available globally for inline onclick handlers
window.editMileage = editMileage;
window.deleteMileage = deleteMileage;
window.printTaxSummary = printTaxSummary;

async function editMileage(id) {
  const entry = mileage.find((m) => m.id === id);
  if (!entry) {
    alert("Mileage entry not found");
    return;
  }

  // Populate form with entry data
  document.getElementById("editMileageId").value = entry.id;
  document.getElementById("editMileageDate").value = entry.date;
  document.getElementById("editMileageMiles").value = entry.miles_driven;
  document.getElementById("editMileageCategory").value = entry.category;
  document.getElementById("editMileageProperty").value =
    entry.property_id || "";
  document.getElementById("editMileageStarting").value =
    entry.starting_location || "";
  document.getElementById("editMileageEnding").value =
    entry.ending_location || "";
  document.getElementById("editMileagePurpose").value = entry.purpose;
  document.getElementById("editMileageNotes").value = entry.notes || "";

  // Open dialog
  document.getElementById("editMileageDialog").showModal();
}

async function saveEditMileage(event) {
  event.preventDefault();
  const form = document.getElementById("editMileageForm");
  const formData = new FormData(form);
  const id = formData.get("id");

  try {
    const dataJson = {
      date: formData.get("date"),
      miles_driven: parseFloat(formData.get("miles_driven")),
      starting_location: formData.get("starting_location") || null,
      ending_location: formData.get("ending_location") || null,
      purpose: formData.get("purpose"),
      category: formData.get("category"),
      property_id: formData.get("property_id")
        ? parseInt(formData.get("property_id"))
        : null,
      notes: formData.get("notes") || null,
    };

    const response = await fetch(`${mileageUrl}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to update mileage"}`);
      return;
    }

    const updatedMileage = await response.json();
    console.log("Mileage updated:", updatedMileage);

    // Close dialog and refresh list
    document.getElementById("editMileageDialog").close();
    await loadMileageData();
    updateStatistics();
  } catch (error) {
    console.error("Error updating mileage:", error);
    alert(`Error: ${error.message}`);
  }
}
