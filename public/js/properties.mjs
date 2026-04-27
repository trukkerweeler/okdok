import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const propertiesUrl = `${apiUrl}/accounting/properties`;
const ownersUrl = `${apiUrl}/accounting/owners`;
let user;
let ownersList = [];

// Initialize handler function
async function initializeProperties() {
  console.debug("[properties.mjs] Initializing");
  user = await getSessionUser();
  await loadOwnersForDropdown();
  setupEventListeners();
  await loadPropertiesData();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeProperties);
} else {
  initializeProperties();
}

function setupEventListeners() {
  // Add Property button
  const addPropertyBtn = document.getElementById("addPropertyBtn");
  if (addPropertyBtn) {
    addPropertyBtn.addEventListener("click", openAddPropertyDialog);
  }

  // Close button for add property dialog
  const closeAddBtn = document.getElementById("closeAddPropertyBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addPropertyDialog").close();
    });
  }

  // Save property form
  const addPropertyForm = document.getElementById("addPropertyForm");
  if (addPropertyForm) {
    addPropertyForm.addEventListener("submit", saveProperty);
  }

  // Close dialog on outside click
  const addPropertyDialog = document.getElementById("addPropertyDialog");
  if (addPropertyDialog) {
    addPropertyDialog.addEventListener("click", (e) => {
      if (e.target === addPropertyDialog) {
        addPropertyDialog.close();
      }
    });
  }
}

async function loadOwnersForDropdown() {
  try {
    const response = await fetch(ownersUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    ownersList = await response.json();
    populateOwnerDropdown();
  } catch (error) {
    console.error("Error loading owners:", error);
  }
}

function populateOwnerDropdown() {
  const select = document.getElementById("propertyOwner");
  if (!select) return;

  // Keep the placeholder option
  const options = ownersList.map(
    (owner) => `<option value="${owner.id}">${escapeHtml(owner.name)}</option>`,
  );

  select.innerHTML =
    '<option value="">Select an owner...</option>' + options.join("");
}

async function openAddPropertyDialog() {
  const dialog = document.getElementById("addPropertyDialog");
  if (dialog) {
    const form = document.getElementById("addPropertyForm");
    form.reset();
    dialog.showModal();
  }
}

async function saveProperty(event) {
  event.preventDefault();
  const form = document.getElementById("addPropertyForm");
  const formData = new FormData(form);

  try {
    const dataJson = {
      owner_id: parseInt(formData.get("owner_id")),
      address: formData.get("address"),
      city: formData.get("city"),
      state: formData.get("state").toUpperCase(),
      zip: formData.get("zip"),
      status: formData.get("status") || "active",
    };

    // Validation
    if (!dataJson.owner_id) {
      alert("Please select an owner");
      return;
    }

    const response = await fetch(propertiesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to save property"}`);
      return;
    }

    const newProperty = await response.json();
    console.log("Property saved:", newProperty);

    // Close dialog and refresh list
    document.getElementById("addPropertyDialog").close();
    await loadPropertiesData();

    // Show success message
    alert(`Property at "${newProperty.address}" created successfully!`);
  } catch (error) {
    console.error("Error saving property:", error);
    alert("Error saving property. Check console for details.");
  }
}

async function loadPropertiesData() {
  try {
    const response = await fetch(propertiesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const properties = await response.json();
    displayProperties(properties);
  } catch (error) {
    console.error("Error loading properties:", error);
    const tbody = document.getElementById("propertiesTableBody");
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-danger py-4">Error loading properties</td></tr>';
  }
}

function displayProperties(properties) {
  const tbody = document.getElementById("propertiesTableBody");

  if (!properties || properties.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="text-center text-muted py-4">No properties found. Click + to add one.</td></tr>';
    return;
  }

  tbody.innerHTML = properties
    .sort((a, b) => a.id - b.id)
    .map((property) => {
      const owner = ownersList.find((o) => o.id === property.owner_id);
      const ownerName = owner ? owner.name : `Owner #${property.owner_id}`;

      return `
    <tr>
      <td>${property.id}</td>
      <td>${escapeHtml(ownerName)}</td>
      <td>${escapeHtml(property.address)}</td>
      <td>${escapeHtml(property.city)}</td>
      <td>${escapeHtml(property.state)}</td>
      <td>${escapeHtml(property.zip)}</td>
      <td>
        <span class="badge ${property.status === "active" ? "bg-success" : "bg-secondary"}">
          ${escapeHtml(property.status)}
        </span>
      </td>
      <td>${formatDate(property.created_at)}</td>
    </tr>
  `;
    })
    .join("");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
