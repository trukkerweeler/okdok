/**
 * Company Settings Management
 * Handles company settings UI and API calls
 */

import { loadHeaderFooter, getSessionUser } from "./utils.mjs";

let currentSettings = {};

/**
 * Initialize the settings page
 */
async function initializeSettingsPage() {
  try {
    // Load header
    loadHeaderFooter();

    // Get current user session
    await getSessionUser();

    // Load settings
    await loadSettings();
    await loadCommonTrips();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing settings page:", error);
    alert("Error loading page. Please try again.");
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const form = document.getElementById("invoiceContactForm");
  if (form) {
    form.addEventListener("submit", saveSettings);
  }

  // Setup real-time preview updates
  const inputs = document.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("input", updatePreview);
  });

  // Setup PM Expense Categories
  loadPMExpenseCategories();
  const addCategoryForm = document.getElementById("addCategoryForm");
  if (addCategoryForm) {
    addCategoryForm.addEventListener("submit", handleAddCategory);
  }

  // Setup Mileage Rates
  loadMileageRates();
  const addRateForm = document.getElementById("addMileageRateForm");
  if (addRateForm) {
    addRateForm.addEventListener("submit", handleAddMileageRate);
  }

  const addCommonTripForm = document.getElementById("addCommonTripForm");
  if (addCommonTripForm) {
    addCommonTripForm.addEventListener("submit", handleAddCommonTrip);
  }
}

/**
 * Load settings from API
 */
async function loadSettings() {
  try {
    const response = await fetch("/accounting/company-settings");
    if (!response.ok) {
      throw new Error("Error loading settings");
    }

    currentSettings = await response.json();

    // Populate form fields
    populateForm();
    updatePreview();
  } catch (error) {
    console.error("Error loading settings:", error);
    showError("Error loading settings. Please try again.");
  }
}

/**
 * Populate form with current settings
 */
function populateForm() {
  const fields = [
    "invoice_contact_name",
    "invoice_contact_phone",
    "invoice_contact_email",
    "company_name",
    "company_address",
    "company_city",
    "company_state",
    "company_zip",
  ];

  fields.forEach((field) => {
    const input = document.querySelector(`[name="${field}"]`);
    if (input) {
      input.value = currentSettings[field] || "";
    }
  });
}

/**
 * Update live preview
 */
function updatePreview() {
  const name = document.getElementById("invoiceContactName").value;
  const phone = document.getElementById("invoiceContactPhone").value;
  const email = document.getElementById("invoiceContactEmail").value;
  const address = document.getElementById("companyAddress").value;
  const city = document.getElementById("companyCity").value;
  const state = document.getElementById("companyState").value;
  const zip = document.getElementById("companyZip").value;

  document.getElementById("previewName").textContent = name || "(Contact Name)";
  document.getElementById("previewPhone").textContent = phone
    ? `Phone: ${phone}`
    : "";
  document.getElementById("previewEmail").textContent = email
    ? `Email: ${email}`
    : "";
  document.getElementById("previewAddress").textContent =
    address || "(Address)";
  document.getElementById("previewCityState").textContent =
    `${city || "(City)"}, ${state || "(ST)"} ${zip || "(Zip)"}`;
}

/**
 * Save settings
 */
async function saveSettings(e) {
  e.preventDefault();

  try {
    const form = document.getElementById("invoiceContactForm");
    const formData = new FormData(form);

    const settings = {};
    formData.forEach((value, key) => {
      settings[key] = value;
    });

    const response = await fetch("/accounting/company-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error("Error saving settings");
    }

    currentSettings = settings;
    showSuccess("Settings saved successfully!");

    // Hide success message after 3 seconds
    setTimeout(() => {
      document.getElementById("successAlert").style.display = "none";
    }, 3000);
  } catch (error) {
    console.error("Error saving settings:", error);
    showError("Error saving settings. Please try again.");
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  const alert = document.getElementById("successAlert");
  alert.textContent = message;
  alert.style.display = "block";
  document.getElementById("errorAlert").style.display = "none";
}

/**
 * Show error message
 */
function showError(message) {
  const alert = document.getElementById("errorAlert");
  const messageSpan = document.getElementById("errorMessage");
  messageSpan.textContent = message;
  alert.style.display = "block";
  document.getElementById("successAlert").style.display = "none";
}

// ===================================================
// PM EXPENSE CATEGORIES MANAGEMENT
// ===================================================

/**
 * Load and display PM expense categories
 */
async function loadPMExpenseCategories() {
  try {
    const response = await fetch("/pm-expenses/categories/all");
    if (!response.ok) {
      throw new Error("Error loading categories");
    }

    const categories = await response.json();
    displayCategoriesTable(categories);
  } catch (error) {
    console.error("Error loading PM expense categories:", error);
    showError("Error loading expense categories");
  }
}

/**
 * Display categories in table
 */
function displayCategoriesTable(categories) {
  const tbody = document.getElementById("categoriesTableBody");
  if (!tbody) return;

  tbody.innerHTML = categories
    .map(
      (cat) => `
    <tr>
      <td>${escapeHtml(cat.name)}</td>
      <td><code>${escapeHtml(cat.code)}</code></td>
      <td>
        <div style="width: 30px; height: 30px; background-color: ${escapeHtml(cat.color)}; border: 1px solid #ddd; border-radius: 4px;"></div>
      </td>
      <td>
        <span class="badge ${cat.is_active ? "bg-success" : "bg-secondary"}">
          ${cat.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-secondary" onclick="editCategory(${cat.id})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${cat.id})">Delete</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

/**
 * Handle add category form submission
 */
async function handleAddCategory(e) {
  e.preventDefault();

  const name = document.getElementById("categoryName").value;
  const code = document.getElementById("categoryCode").value;
  const color = document.getElementById("categoryColor").value;

  if (!name || !code) {
    showError("Please fill in all required fields");
    return;
  }

  try {
    const response = await fetch("/pm-expenses/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, color }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error creating category");
    }

    showSuccess("Category added successfully!");
    document.getElementById("addCategoryForm").reset();
    await loadPMExpenseCategories();

    // Hide success message after 3 seconds
    setTimeout(() => {
      document.getElementById("successAlert").style.display = "none";
    }, 3000);
  } catch (error) {
    console.error("Error adding category:", error);
    showError(error.message);
  }
}

/**
 * Edit category (placeholder - could expand UI later)
 */
function editCategory(id) {
  // Future enhancement: inline edit form
  alert(`Edit functionality coming soon for category ${id}`);
}

/**
 * Delete category
 */
async function deleteCategory(id) {
  if (!confirm("Are you sure you want to delete this category?")) {
    return;
  }

  try {
    const response = await fetch(`/pm-expenses/categories/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error deleting category");
    }

    showSuccess("Category deleted successfully!");
    await loadPMExpenseCategories();

    // Hide success message after 3 seconds
    setTimeout(() => {
      document.getElementById("successAlert").style.display = "none";
    }, 3000);
  } catch (error) {
    console.error("Error deleting category:", error);
    showError(error.message);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ===================================================
// MILEAGE RATES MANAGEMENT
// ===================================================

const DEFAULT_COMMON_TRIPS = [
  {
    id: "office-to-property-632",
    name: "Office to Property 632",
    startingLocation: "Office",
    endingLocation: "Property 632",
    miles: 31.7,
    propertyId: "632",
  },
  {
    id: "property-632-to-office",
    name: "Property 632 to Office",
    startingLocation: "Property 632",
    endingLocation: "Office",
    miles: 31.7,
    propertyId: "632",
  },
];

let commonTrips = [];

async function loadCommonTrips() {
  try {
    const propertiesResponse = await fetch("/accounting/properties");
    const properties = propertiesResponse.ok
      ? await propertiesResponse.json()
      : [];
    const propertySelect = document.getElementById("commonTripProperty");
    properties.forEach((property) => {
      const option = document.createElement("option");
      option.value = property.id;
      option.textContent = `${property.address}, ${property.city}, ${property.state}`;
      propertySelect.appendChild(option);
    });

    commonTrips = currentSettings.common_trips
      ? JSON.parse(currentSettings.common_trips)
      : DEFAULT_COMMON_TRIPS;
    if (!Array.isArray(commonTrips)) commonTrips = DEFAULT_COMMON_TRIPS;
  } catch (error) {
    console.error("Error loading common trips:", error);
    commonTrips = DEFAULT_COMMON_TRIPS;
  }
  displayCommonTrips();
}

function displayCommonTrips() {
  const tbody = document.getElementById("commonTripsTableBody");
  if (!tbody) return;

  tbody.innerHTML = commonTrips.length
    ? commonTrips
        .map(
          (trip) => `
    <tr>
      <td>${escapeHtml(String(trip.name || ""))}</td>
      <td>${escapeHtml(String(trip.startingLocation || ""))} &rarr; ${escapeHtml(String(trip.endingLocation || ""))}</td>
      <td>${Number(trip.miles).toFixed(1)} mi</td>
      <td>${escapeHtml(String(trip.propertyId || "-"))}</td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteCommonTrip('${escapeHtml(String(trip.id))}')">Delete</button></td>
    </tr>`,
        )
        .join("")
    : '<tr><td colspan="5" class="text-muted">No saved trips.</td></tr>';
}

async function handleAddCommonTrip(event) {
  event.preventDefault();
  const trip = {
    id: crypto.randomUUID(),
    name: document.getElementById("commonTripName").value.trim(),
    startingLocation: document.getElementById("commonTripStarting").value.trim(),
    endingLocation: document.getElementById("commonTripEnding").value.trim(),
    miles: parseFloat(document.getElementById("commonTripMiles").value),
    propertyId: document.getElementById("commonTripProperty").value || null,
  };

  if (
    !trip.name ||
    !trip.startingLocation ||
    !trip.endingLocation ||
    !Number.isFinite(trip.miles) ||
    trip.miles < 0
  ) {
    showError("Please enter a name, both locations, and a valid distance.");
    return;
  }

  await saveCommonTrips([...commonTrips, trip]);
}

async function deleteCommonTrip(id) {
  await saveCommonTrips(
    commonTrips.filter((trip) => String(trip.id) !== String(id)),
  );
}

async function saveCommonTrips(trips) {
  try {
    const response = await fetch("/accounting/company-settings/common_trips", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(trips) }),
    });
    if (!response.ok) throw new Error("Error saving common trips");
    commonTrips = trips;
    displayCommonTrips();
    document.getElementById("addCommonTripForm")?.reset();
    showSuccess("Common trips saved successfully!");
  } catch (error) {
    console.error("Error saving common trips:", error);
    showError(error.message);
  }
}

// Hardcoded defaults shown when no DB value exists yet
const DEFAULT_MILEAGE_RATES = {
  "2022-01-01": 0.585,
  "2022-07-01": 0.625,
  "2023-01-01": 0.655,
  "2024-01-01": 0.67,
  "2025-01-01": 0.7,
  "2026-01-01": 0.725,
  "2026-07-01": 0.76,
};

async function loadMileageRates() {
  try {
    const response = await fetch("/accounting/company-settings");
    if (!response.ok) throw new Error("Error loading settings");
    const settings = await response.json();

    // Extract date-effective keys; legacy year keys mean January 1.
    const dbRates = {};
    Object.entries(settings).forEach(([key, value]) => {
      const match = key.match(/^mileage_rate_(\d{4})(?:-(\d{2}-\d{2}))?$/);
      if (match) {
        const effectiveDate = match[2]
          ? `${match[1]}-${match[2]}`
          : `${match[1]}-01-01`;
        dbRates[effectiveDate] = parseFloat(value);
      }
    });

    // Merge: DB values take precedence over defaults
    const allRates = { ...DEFAULT_MILEAGE_RATES, ...dbRates };
    displayMileageRates(allRates, dbRates);
  } catch (error) {
    console.error("Error loading mileage rates:", error);
    displayMileageRates(DEFAULT_MILEAGE_RATES, {});
  }
}

function displayMileageRates(rates, dbRates) {
  const tbody = document.getElementById("mileageRatesTableBody");
  if (!tbody) return;

  const sorted = Object.entries(rates).sort((a, b) => b[0].localeCompare(a[0]));
  const isFromDb = (date) => Object.prototype.hasOwnProperty.call(dbRates, date);

  tbody.innerHTML = sorted
    .map(
      ([date, rate]) => `
    <tr id="rateRow_${date}">
      <td>${date}</td>
      <td>
        <span id="rateDisplay_${date}">$${parseFloat(rate).toFixed(3)}/mi</span>
        ${!isFromDb(date) ? '<span class="badge bg-secondary ms-2" title="Default value \u2014 not yet saved to DB">default</span>' : ""}
        <input
          type="number"
          id="rateInput_${date}"
          class="form-control form-control-sm d-none"
          style="width: 110px; display: inline-block !important"
          step="0.001"
          min="0"
          value="${rate}"
        />
      </td>
      <td>
        <button class="btn btn-sm btn-outline-secondary" id="editRateBtn_${date}" onclick="editMileageRate('${date}')">Edit</button>
        <button class="btn btn-sm btn-primary d-none" id="saveRateBtn_${date}" onclick="saveMileageRate('${date}')">Save</button>
        <button class="btn btn-sm btn-secondary d-none" id="cancelRateBtn_${date}" onclick="cancelEditRate('${date}')">Cancel</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

function editMileageRate(date) {
  document.getElementById(`rateDisplay_${date}`).classList.add("d-none");
  document.getElementById(`rateInput_${date}`).classList.remove("d-none");
  document.getElementById(`editRateBtn_${date}`).classList.add("d-none");
  document.getElementById(`saveRateBtn_${date}`).classList.remove("d-none");
  document.getElementById(`cancelRateBtn_${date}`).classList.remove("d-none");
}

function cancelEditRate(date) {
  document.getElementById(`rateDisplay_${date}`).classList.remove("d-none");
  document.getElementById(`rateInput_${date}`).classList.add("d-none");
  document.getElementById(`editRateBtn_${date}`).classList.remove("d-none");
  document.getElementById(`saveRateBtn_${date}`).classList.add("d-none");
  document.getElementById(`cancelRateBtn_${date}`).classList.add("d-none");
}

async function saveMileageRate(date) {
  const input = document.getElementById(`rateInput_${date}`);
  const rate = parseFloat(input.value);
  if (isNaN(rate) || rate <= 0) {
    showError("Please enter a valid rate greater than 0");
    return;
  }

  try {
    const response = await fetch(
      `/accounting/company-settings/mileage_rate_${date}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: rate.toFixed(3) }),
      },
    );
    if (!response.ok) throw new Error("Error saving rate");

    showSuccess(`Rate from ${date} saved: $${rate.toFixed(3)}/mi`);
    setTimeout(
      () => (document.getElementById("successAlert").style.display = "none"),
      3000,
    );
    await loadMileageRates();
  } catch (error) {
    console.error("Error saving mileage rate:", error);
    showError("Error saving mileage rate. Please try again.");
  }
}

async function handleAddMileageRate(e) {
  e.preventDefault();
  const date = document.getElementById("rateDate").value;
  const rate = parseFloat(document.getElementById("rateValue").value);

  if (!date || isNaN(rate) || rate <= 0) {
    showError("Please enter a valid effective date and rate greater than 0");
    return;
  }

  try {
    const response = await fetch(
      `/accounting/company-settings/mileage_rate_${date}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: rate.toFixed(3) }),
      },
    );
    if (!response.ok) throw new Error("Error saving rate");

    showSuccess(`Rate from ${date} saved: $${rate.toFixed(3)}/mi`);
    document.getElementById("addMileageRateForm").reset();
    setTimeout(
      () => (document.getElementById("successAlert").style.display = "none"),
      3000,
    );
    await loadMileageRates();
  } catch (error) {
    console.error("Error adding mileage rate:", error);
    showError("Error saving mileage rate. Please try again.");
  }
}

window.editMileageRate = editMileageRate;
window.cancelEditRate = cancelEditRate;
window.saveMileageRate = saveMileageRate;
window.deleteCommonTrip = deleteCommonTrip;

// ===================================================

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeSettingsPage);
