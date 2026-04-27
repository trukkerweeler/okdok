/**
 * Leases Management
 * Handles creating, editing, and managing leases with tenants
 */

import { loadHeaderFooter, getSessionUser } from "./utils.mjs";

let currentLeaseId = null;
let leases = [];
let properties = [];
let tenants = [];
let allTenants = [];

/**
 * Initialize the leases page
 */
async function initializeLeases() {
  try {
    // Load and inject header
    loadHeaderFooter();

    // Get current user session
    await getSessionUser();

    // Load reference data
    await loadReferenceData();

    // Load leases
    await loadLeasesData();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing leases page:", error);
    alert("Error loading page. Please try again.");
  }
}

/**
 * Load properties and tenants for dropdowns
 */
async function loadReferenceData() {
  try {
    const [propertiesRes, tenantsRes] = await Promise.all([
      fetch("/accounting/properties"),
      fetch("/accounting/tenants"),
    ]);

    if (!propertiesRes.ok || !tenantsRes.ok) {
      throw new Error("Error loading reference data");
    }

    properties = await propertiesRes.json();
    allTenants = await tenantsRes.json();

    populatePropertyDropdown();
  } catch (error) {
    console.error("Error loading reference data:", error);
    alert("Error loading properties and tenants");
  }
}

/**
 * Populate property dropdown
 */
function populatePropertyDropdown() {
  const select = document.getElementById("leaseProperty");
  if (!select) return;

  select.innerHTML =
    '<option value="">Select a property...</option>' +
    properties
      .map((prop) => `<option value="${prop.id}">${prop.address}</option>`)
      .join("");
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const addLeaseBtn = document.getElementById("addLeaseBtn");
  if (addLeaseBtn) {
    addLeaseBtn.addEventListener("click", () => {
      resetLeaseForm();
      document.getElementById("addLeaseDialog").showModal();
    });
  }

  const addLeaseForm = document.getElementById("addLeaseForm");
  if (addLeaseForm) {
    addLeaseForm.addEventListener("submit", saveLease);
  }

  const leaseProperty = document.getElementById("leaseProperty");
  if (leaseProperty) {
    leaseProperty.addEventListener("change", updateLeaseNumber);
  }
}

/**
 * Update lease number when property changes
 */
async function updateLeaseNumber() {
  const propertyId = document.getElementById("leaseProperty").value;
  if (!propertyId) {
    document.getElementById("leaseNumber").value = "";
    return;
  }

  try {
    // Count leases for this property in current year
    const currentYear = new Date().getFullYear();
    const propertyLeases = leases.filter(
      (l) =>
        l.property_id == propertyId &&
        new Date(l.lease_start).getFullYear() === currentYear,
    );
    const count = propertyLeases.length;
    const sequenceNumber = 101 + count;
    const leaseNumber = `${propertyId}-${currentYear}-${String(sequenceNumber).padStart(3, "0")}`;
    document.getElementById("leaseNumber").value = leaseNumber;
  } catch (error) {
    console.error("Error generating lease number:", error);
  }
}

/**
 * Reset lease form
 */
function resetLeaseForm() {
  document.getElementById("leaseId").value = "";
  document.getElementById("addLeaseForm").reset();
  document.querySelector("#addLeaseDialog .dialog-header h2").textContent =
    "Add New Lease";

  // Set default lease start to today
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("leaseStart").value = today;
  document.getElementById("leaseStatus").value = "active";
}

/**
 * Save lease (create or update)
 */
async function saveLease(e) {
  e.preventDefault();

  try {
    const leaseId = document.getElementById("leaseId").value;
    const formData = {
      property_id: parseInt(document.getElementById("leaseProperty").value),
      lease_number: document.getElementById("leaseNumber").value,
      lease_start: document.getElementById("leaseStart").value,
      lease_end: document.getElementById("leaseEnd").value || null,
      monthly_rent: parseFloat(document.getElementById("monthlyRent").value),
      security_deposit:
        parseFloat(document.getElementById("securityDeposit").value) || 0,
      status: document.getElementById("leaseStatus").value,
      notes: document.getElementById("leaseNotes").value,
    };

    let response;
    if (leaseId) {
      // Update existing lease
      response = await fetch(`/accounting/leases/${leaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } else {
      // Create new lease
      response = await fetch("/accounting/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    }

    if (!response.ok) {
      throw new Error(
        leaseId ? "Error updating lease" : "Error creating lease",
      );
    }

    document.getElementById("addLeaseDialog").close();
    resetLeaseForm();
    await loadLeasesData();

    alert(leaseId ? "Lease updated successfully" : "Lease added successfully");
  } catch (error) {
    console.error("Error saving lease:", error);
    alert("Error saving lease. Please try again.");
  }
}

/**
 * Load all leases
 */
async function loadLeasesData() {
  try {
    const response = await fetch("/accounting/leases");
    if (!response.ok) {
      throw new Error("Error loading leases");
    }

    leases = await response.json();
    displayLeases();
  } catch (error) {
    console.error("Error loading leases:", error);
    alert("Error loading leases");
  }
}

/**
 * Display leases in table
 */
function displayLeases() {
  const tbody = document.querySelector("#leasesTable tbody");
  const noLeasesMessage = document.getElementById("noLeasesMessage");

  if (leases.length === 0) {
    tbody.innerHTML = "";
    noLeasesMessage.style.display = "block";
    return;
  }

  noLeasesMessage.style.display = "none";

  tbody.innerHTML = leases
    .map((lease) => {
      const leaseStart = formatDate(lease.lease_start);
      const leaseEnd = lease.lease_end ? formatDate(lease.lease_end) : "—";
      const property = properties.find((p) => p.id === lease.property_id);
      const propertyAddress = property ? property.address : "—";

      return `
    <tr>
      <td><strong>${escapeHtml(lease.lease_number)}</strong></td>
      <td>${escapeHtml(propertyAddress)}</td>
      <td>${leaseStart}</td>
      <td>${leaseEnd}</td>
      <td>$${formatCurrency(lease.monthly_rent)}</td>
      <td>$${formatCurrency(lease.security_deposit)}</td>
      <td>
        <button 
          class="btn btn-sm btn-info"
          onclick="showManageTenants(${lease.id})"
          title="Manage tenants for this lease"
        >
          👥
        </button>
      </td>
      <td>
        <span class="badge bg-${lease.status === "active" ? "success" : lease.status === "pending" ? "warning" : "secondary"}">
          ${lease.status}
        </span>
      </td>
      <td>
        <button 
          class="btn btn-sm btn-warning"
          onclick="editLease(${lease.id})"
          title="Edit lease"
        >
          ✎
        </button>
        <button 
          class="btn btn-sm btn-danger"
          onclick="deleteLease(${lease.id})"
          title="Delete lease"
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
 * Edit a lease
 */
async function editLease(leaseId) {
  try {
    const response = await fetch(`/accounting/leases/${leaseId}`);
    if (!response.ok) {
      throw new Error("Error loading lease");
    }

    const lease = await response.json();

    // Populate form
    document.getElementById("leaseId").value = lease.id;
    document.getElementById("leaseProperty").value = lease.property_id;
    document.getElementById("leaseNumber").value = lease.lease_number;
    document.getElementById("leaseStart").value = lease.lease_start;
    document.getElementById("leaseEnd").value = lease.lease_end || "";
    document.getElementById("monthlyRent").value = lease.monthly_rent;
    document.getElementById("securityDeposit").value =
      lease.security_deposit || "";
    document.getElementById("leaseStatus").value = lease.status;
    document.getElementById("leaseNotes").value = lease.notes || "";

    // Update dialog title
    document.querySelector("#addLeaseDialog .dialog-header h2").textContent =
      "Edit Lease";

    document.getElementById("addLeaseDialog").showModal();
  } catch (error) {
    console.error("Error loading lease for edit:", error);
    alert("Error loading lease. Please try again.");
  }
}

/**
 * Delete a lease
 */
async function deleteLease(leaseId) {
  if (!confirm("Are you sure you want to delete this lease?")) {
    return;
  }

  try {
    const response = await fetch(`/accounting/leases/${leaseId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Error deleting lease");
    }

    await loadLeasesData();
    alert("Lease deleted successfully");
  } catch (error) {
    console.error("Error deleting lease:", error);
    alert("Error deleting lease. Please try again.");
  }
}

/**
 * Show manage tenants dialog
 */
async function showManageTenants(leaseId) {
  try {
    currentLeaseId = leaseId;

    const response = await fetch(`/accounting/leases/${leaseId}`);
    if (!response.ok) {
      throw new Error("Error loading lease");
    }

    const lease = await response.json();
    const tenantsList = document.getElementById("leaseTenantsList");

    tenantsList.innerHTML = "<strong>Current Tenants:</strong>";

    if (lease.tenants && lease.tenants.length > 0) {
      tenantsList.innerHTML +=
        "<ul class='mt-2'>" +
        lease.tenants
          .map(
            (tenant) =>
              `<li>${escapeHtml(tenant.name)}${tenant.is_primary ? " ★ (Primary)" : ""}
               <button class="btn btn-sm btn-danger ms-2" onclick="removeTenantFromLease(${leaseId}, ${tenant.id})">Remove</button>
             </li>`,
          )
          .join("") +
        "</ul>";
    } else {
      tenantsList.innerHTML +=
        "<p class='mt-2 text-muted'>No tenants added yet</p>";
    }

    // Populate add tenant dropdown with available tenants
    const addTenantSelect = document.getElementById("addTenantSelect");
    const assignedTenantIds = lease.tenants
      ? lease.tenants.map((t) => t.id)
      : [];
    const availableTenants = allTenants.filter(
      (t) =>
        t.property_id == lease.property_id && !assignedTenantIds.includes(t.id),
    );

    addTenantSelect.innerHTML =
      '<option value="">Select a tenant...</option>' +
      availableTenants
        .map((tenant) => `<option value="${tenant.id}">${tenant.name}</option>`)
        .join("");

    document.getElementById("manageLeaseTenants").showModal();
  } catch (error) {
    console.error("Error showing manage tenants dialog:", error);
    alert("Error loading lease tenants.");
  }
}

/**
 * Add tenant to lease
 */
async function addTenantToLease() {
  const tenantId = document.getElementById("addTenantSelect").value;
  if (!tenantId || !currentLeaseId) {
    alert("Please select a tenant");
    return;
  }

  try {
    const response = await fetch(
      `/accounting/leases/${currentLeaseId}/tenants/${tenantId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: false }),
      },
    );

    if (!response.ok) {
      throw new Error("Error adding tenant to lease");
    }

    // Reload the manage tenants dialog
    await showManageTenants(currentLeaseId);
    alert("Tenant added to lease successfully");
  } catch (error) {
    console.error("Error adding tenant to lease:", error);
    alert("Error adding tenant. Please try again.");
  }
}

/**
 * Remove tenant from lease
 */
async function removeTenantFromLease(leaseId, tenantId) {
  if (!confirm("Remove this tenant from the lease?")) {
    return;
  }

  try {
    const response = await fetch(
      `/accounting/leases/${leaseId}/tenants/${tenantId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error("Error removing tenant");
    }

    await showManageTenants(leaseId);
  } catch (error) {
    console.error("Error removing tenant from lease:", error);
    alert("Error removing tenant. Please try again.");
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeLeases);

// Export functions globally for inline onclick handlers
window.showManageTenants = showManageTenants;
window.addTenantToLease = addTenantToLease;
window.removeTenantFromLease = removeTenantFromLease;
window.editLease = editLease;
window.deleteLease = deleteLease;
