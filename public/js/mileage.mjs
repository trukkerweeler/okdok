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

// IRS mileage rate (2026)
const IRS_MILEAGE_RATE = 0.725;

// Initialize handler function
async function initializeMileage() {
  console.debug("[mileage.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadReferenceData();
  await loadMileageData();
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

  if (mileage.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-muted py-4">No mileage entries yet. Click the + button to add one.</td></tr>';
    return;
  }

  tbody.innerHTML = mileage
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
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Filter for this month
  const thisMonthEntries = mileage.filter((entry) => {
    const entryDate = new Date(entry.date);
    return (
      entryDate.getMonth() + 1 === currentMonth &&
      entryDate.getFullYear() === currentYear
    );
  });

  // Calculate totals with type conversion
  const totalMiles = thisMonthEntries.reduce((sum, entry) => {
    return sum + (parseFloat(entry.miles_driven) || 0);
  }, 0);

  const tripCount = thisMonthEntries.length;
  const avgMiles = tripCount > 0 ? totalMiles / tripCount : 0;
  const taxDeduction = totalMiles * IRS_MILEAGE_RATE;

  // Update display
  const thisMonthMilesEl = document.getElementById("thisMonthMiles");
  if (thisMonthMilesEl) {
    thisMonthMilesEl.textContent = totalMiles.toFixed(1);
  }

  const thisMonthTripsEl = document.getElementById("thisMonthTrips");
  if (thisMonthTripsEl) {
    thisMonthTripsEl.textContent = tripCount;
  }

  const taxDeductionEl = document.getElementById("taxDeduction");
  if (taxDeductionEl) {
    taxDeductionEl.textContent = `$${taxDeduction.toFixed(2)}`;
  }

  const avgMilesEl = document.getElementById("avgMiles");
  if (avgMilesEl) {
    avgMilesEl.textContent = avgMiles.toFixed(1);
  }
}

// Make functions available globally for inline onclick handlers
window.editMileage = editMileage;
window.deleteMileage = deleteMileage;

async function editMileage(id) {
  console.log("Edit mileage:", id);
  // TODO: Implement edit functionality
  alert("Edit functionality coming soon!");
}
