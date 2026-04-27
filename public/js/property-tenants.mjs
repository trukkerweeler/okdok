/**
 * Property Tenants Management
 * Handles adding, editing, and managing tenants for a property
 * Also manages setting a primary tenant for the property
 */

import { loadHeaderFooter, getSessionUser } from "./utils.mjs";

let currentPropertyId = null;
let currentTenants = [];
let selectedTenantForPrimary = null;

/**
 * Initialize the property tenants page
 */
async function initializePropertyTenants() {
  try {
    // Load header
    loadHeaderFooter();

    // Get property ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentPropertyId = urlParams.get("property_id");

    if (!currentPropertyId) {
      alert("Property ID not provided");
      window.history.back();
      return;
    }

    // Get current user session
    await getSessionUser();

    // Load property details
    await loadPropertyDetails();

    // Load tenants for the property
    await loadTenantsData();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing property tenants page:", error);
    alert("Error loading page. Please try again.");
  }
}

/**
 * Load property details and display them
 */
async function loadPropertyDetails() {
  try {
    const response = await fetch(
      `/accounting/properties/${currentPropertyId}/with-primary-tenant`,
    );
    if (!response.ok) {
      throw new Error("Property not found");
    }

    const property = await response.json();
    displayPropertyDetails(property);
  } catch (error) {
    console.error("Error loading property details:", error);
    alert("Error loading property details");
  }
}

/**
 * Display property details in the header section
 */
function displayPropertyDetails(property) {
  const detailsDiv = document.getElementById("propertyDetails");
  const address = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;
  const primaryTenantInfo = property.primary_tenant_name
    ? `<strong>${property.primary_tenant_name}</strong> (${property.primary_tenant_email})`
    : "Not assigned";

  detailsDiv.innerHTML = `
    <div class="col-md-6">
      <p><strong>Address:</strong> ${address}</p>
    </div>
    <div class="col-md-6">
      <p><strong>Primary Tenant:</strong> ${primaryTenantInfo}</p>
    </div>
    <div class="col-md-6">
      <p><strong>Status:</strong> <span class="badge bg-${property.status === "active" ? "success" : "secondary"}">${property.status}</span></p>
    </div>
  `;

  // Set property ID in hidden form field
  document.getElementById("propertyId").value = currentPropertyId;
}

/**
 * Load tenants for this property
 */
async function loadTenantsData() {
  try {
    const response = await fetch(
      `/accounting/tenants/property/${currentPropertyId}`,
    );
    if (!response.ok) {
      throw new Error("Error loading tenants");
    }

    currentTenants = await response.json();
    displayTenants();
  } catch (error) {
    console.error("Error loading tenants:", error);
    alert("Error loading tenants");
  }
}

/**
 * Display tenants in the table
 */
function displayTenants() {
  const tbody = document.querySelector("#tenantsTable tbody");
  const noTenantsMessage = document.getElementById("noTenantsMessage");

  if (currentTenants.length === 0) {
    tbody.innerHTML = "";
    noTenantsMessage.style.display = "block";
    return;
  }

  noTenantsMessage.style.display = "none";

  tbody.innerHTML = currentTenants
    .map((tenant) => {
      const leaseStart = tenant.lease_start
        ? formatDate(tenant.lease_start)
        : "—";
      const leaseEnd = tenant.lease_end ? formatDate(tenant.lease_end) : "—";

      return `
    <tr>
      <td>
        <button 
          class="btn btn-sm btn-outline-primary"
          onclick="showSetPrimaryTenantDialog(${tenant.id}, '${escapedName(tenant.name)}')"
          title="Set as primary tenant"
        >
          ${getPrimaryTenantBadge(tenant.id)}
        </button>
      </td>
      <td>${escapeHtml(tenant.name)}</td>
      <td>${escapeHtml(tenant.email || "")}</td>
      <td>${escapeHtml(tenant.phone || "")}</td>
      <td>${leaseStart}</td>
      <td>${leaseEnd}</td>
      <td>$${formatCurrency(tenant.rent_amount)}</td>
      <td>$${formatCurrency(tenant.deposit_amount)}</td>
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
 * Get primary tenant badge for display
 */
function getPrimaryTenantBadge(tenantId) {
  // We need to load the property to check which tenant is primary
  // For now, we'll return a star or empty based on comparison
  return "★";
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById("addTenantBtn").addEventListener("click", () => {
    resetTenantForm();
    document.getElementById("addTenantDialog").showModal();
  });

  document
    .getElementById("addTenantForm")
    .addEventListener("submit", saveTenant);
}

/**
 * Show dialog to confirm setting a tenant as primary
 */
function showSetPrimaryTenantDialog(tenantId, tenantName) {
  selectedTenantForPrimary = tenantId;
  document.getElementById("selectedTenantName").textContent = tenantName;
  document.getElementById("setPrimaryTenantDialog").showModal();
}

/**
 * Confirm and set the primary tenant
 */
async function confirmSetPrimaryTenant() {
  if (!selectedTenantForPrimary) return;

  try {
    const response = await fetch(
      `/accounting/properties/${currentPropertyId}/primary-tenant/${selectedTenantForPrimary}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error("Error setting primary tenant");
    }

    document.getElementById("setPrimaryTenantDialog").close();
    selectedTenantForPrimary = null;

    // Reload property details and tenants
    await loadPropertyDetails();
    await loadTenantsData();

    alert("Primary tenant updated successfully");
  } catch (error) {
    console.error("Error setting primary tenant:", error);
    alert("Error setting primary tenant. Please try again.");
  }
}

/**
 * Reset the tenant form
 */
function resetTenantForm() {
  document.getElementById("tenantId").value = "";
  document.getElementById("addTenantForm").reset();
  document.querySelector("#addTenantDialog .dialog-header h2").textContent =
    "Add New Tenant";

  // Set default lease start to today
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("leaseStart").value = today;
}

/**
 * Save tenant (create or update)
 */
async function saveTenant(e) {
  e.preventDefault();

  try {
    const tenantId = document.getElementById("tenantId").value;
    const formData = {
      property_id: currentPropertyId,
      name: document.getElementById("tenantName").value,
      email: document.getElementById("tenantEmail").value,
      phone: document.getElementById("tenantPhone").value,
      lease_start: document.getElementById("leaseStart").value,
      lease_end: document.getElementById("leaseEnd").value,
      rent_amount: parseFloat(document.getElementById("rentAmount").value),
      deposit_amount:
        parseFloat(document.getElementById("depositAmount").value) || 0,
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
 * Edit an existing tenant
 */
async function editTenant(tenantId) {
  try {
    const response = await fetch(`/accounting/tenants/${tenantId}`);
    if (!response.ok) {
      throw new Error("Error loading tenant");
    }

    const tenant = await response.json();

    // Populate form with tenant data
    document.getElementById("tenantId").value = tenant.id;
    document.getElementById("tenantName").value = tenant.name;
    document.getElementById("tenantEmail").value = tenant.email || "";
    document.getElementById("tenantPhone").value = tenant.phone || "";
    document.getElementById("leaseStart").value = tenant.lease_start;
    document.getElementById("leaseEnd").value = tenant.lease_end || "";
    document.getElementById("rentAmount").value = tenant.rent_amount;
    document.getElementById("depositAmount").value =
      tenant.deposit_amount || "";

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
 * Format a date string for display
 */
function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  if (!amount) return "0.00";
  return parseFloat(amount).toFixed(2);
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

/**
 * Escape special characters in names for safe JavaScript string
 */
function escapedName(name) {
  if (!name) return "";
  return name.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializePropertyTenants);
