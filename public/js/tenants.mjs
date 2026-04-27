/**
 * Tenants Management
 * Handles creating, editing, and managing all tenants across properties
 */

import { loadHeaderFooter, getSessionUser } from "./utils.mjs";

let tenants = [];
let properties = [];

/**
 * Initialize the tenants page
 */
async function initializeTenantsPage() {
  try {
    // Load header
    loadHeaderFooter();

    // Get current user session
    await getSessionUser();

    // Load reference data
    await loadReferenceData();

    // Load tenants
    await loadTenantsData();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing tenants page:", error);
    alert("Error loading page. Please try again.");
  }
}

/**
 * Load properties for dropdown
 */
async function loadReferenceData() {
  try {
    const response = await fetch("/accounting/properties");
    if (!response.ok) {
      throw new Error("Error loading properties");
    }
    properties = await response.json();
    populatePropertyDropdown();
  } catch (error) {
    console.error("Error loading properties:", error);
  }
}

/**
 * Populate property dropdown
 */
function populatePropertyDropdown() {
  const select = document.getElementById("tenantProperty");
  if (!select) return;

  select.innerHTML = '<option value="">Select a property...</option>';
  properties.forEach((prop) => {
    const option = document.createElement("option");
    option.value = prop.id;
    option.textContent = `${prop.address} (${prop.city}, ${prop.state})`;
    select.appendChild(option);
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const addTenantBtn = document.getElementById("addTenantBtn");
  if (addTenantBtn) {
    addTenantBtn.addEventListener("click", () => {
      resetTenantForm();
      document.getElementById("addTenantDialog").showModal();
    });
  }

  const addTenantForm = document.getElementById("addTenantForm");
  if (addTenantForm) {
    addTenantForm.addEventListener("submit", saveTenant);
  }
}

/**
 * Reset tenant form
 */
function resetTenantForm() {
  document.getElementById("tenantId").value = "";
  document.getElementById("addTenantForm").reset();
  document.querySelector("#addTenantDialog .dialog-header h2").textContent =
    "Add New Tenant";
}

/**
 * Save tenant (create or update)
 */
async function saveTenant(e) {
  e.preventDefault();

  try {
    const tenantId = document.getElementById("tenantId").value;
    const formData = {
      name: document.getElementById("tenantName").value,
      email: document.getElementById("tenantEmail").value || null,
      phone: document.getElementById("tenantPhone").value || null,
      property_id: document.getElementById("tenantProperty").value
        ? parseInt(document.getElementById("tenantProperty").value)
        : null,
      notes: document.getElementById("tenantNotes").value || null,
    };

    let response;
    if (tenantId) {
      // Update existing tenant
      response = await fetch(`/accounting/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } else {
      // Create new tenant
      response = await fetch("/accounting/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    }

    if (!response.ok) {
      throw new Error(
        tenantId ? "Error updating tenant" : "Error creating tenant",
      );
    }

    document.getElementById("addTenantDialog").close();
    resetTenantForm();
    await loadTenantsData();

    alert(
      tenantId ? "Tenant updated successfully" : "Tenant added successfully",
    );
  } catch (error) {
    console.error("Error saving tenant:", error);
    alert("Error saving tenant. Please try again.");
  }
}

/**
 * Load all tenants
 */
async function loadTenantsData() {
  try {
    const response = await fetch("/accounting/tenants");
    if (!response.ok) {
      throw new Error("Error loading tenants");
    }

    tenants = await response.json();
    displayTenants();
  } catch (error) {
    console.error("Error loading tenants:", error);
    alert("Error loading tenants");
  }
}

/**
 * Display tenants in table
 */
function displayTenants() {
  const tbody = document.querySelector("#tenantsTable tbody");
  const noTenantsMessage = document.getElementById("noTenantsMessage");

  if (tenants.length === 0) {
    tbody.innerHTML = "";
    noTenantsMessage.style.display = "block";
    return;
  }

  noTenantsMessage.style.display = "none";

  tbody.innerHTML = tenants
    .map((tenant) => {
      const property = properties.find((p) => p.id === tenant.property_id);
      const propertyName = property
        ? `${property.address} (${property.city})`
        : "—";

      return `
    <tr>
      <td>${escapeHtml(tenant.name)}</td>
      <td>${tenant.email ? escapeHtml(tenant.email) : "—"}</td>
      <td>${tenant.phone ? escapeHtml(tenant.phone) : "—"}</td>
      <td>${escapeHtml(propertyName)}</td>
      <td>
        <span class="badge ${tenant.status === "active" ? "bg-success" : "bg-secondary"}">
          ${tenant.status || "active"}
        </span>
      </td>
      <td>
        <button 
          class="btn btn-sm btn-warning"
          onclick="editTenant(${tenant.id})"
          title="Edit tenant"
        >
          ✎
        </button>
        <button 
          class="btn btn-sm btn-danger"
          onclick="deleteTenant(${tenant.id})"
          title="Delete tenant"
        >
          ✕
        </button>
      </td>
    </tr>
  `;
    })
    .join("");
}

/**
 * Edit a tenant
 */
async function editTenant(tenantId) {
  try {
    const response = await fetch(`/accounting/tenants/${tenantId}`);
    if (!response.ok) {
      throw new Error("Error loading tenant");
    }

    const tenant = await response.json();

    // Populate form
    document.getElementById("tenantId").value = tenant.id;
    document.getElementById("tenantName").value = tenant.name;
    document.getElementById("tenantEmail").value = tenant.email || "";
    document.getElementById("tenantPhone").value = tenant.phone || "";
    document.getElementById("tenantProperty").value = tenant.property_id || "";
    document.getElementById("tenantNotes").value = tenant.notes || "";

    // Update dialog title
    document.querySelector("#addTenantDialog .dialog-header h2").textContent =
      "Edit Tenant";

    document.getElementById("addTenantDialog").showModal();
  } catch (error) {
    console.error("Error loading tenant for edit:", error);
    alert("Error loading tenant. Please try again.");
  }
}

/**
 * Delete a tenant
 */
async function deleteTenant(tenantId) {
  if (!confirm("Are you sure you want to delete this tenant?")) {
    return;
  }

  try {
    const response = await fetch(`/accounting/tenants/${tenantId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Error deleting tenant");
    }

    await loadTenantsData();
    alert("Tenant deleted successfully");
  } catch (error) {
    console.error("Error deleting tenant:", error);
    alert("Error deleting tenant. Please try again.");
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeTenantsPage);

// Export functions globally for inline onclick handlers
window.editTenant = editTenant;
window.deleteTenant = deleteTenant;
