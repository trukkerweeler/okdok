/**
 * Tenants Management
 * Handles creating, editing, and managing all tenants across properties
 */

import { loadHeaderFooter, getSessionUser } from "./utils.mjs";

let tenants = [];
let properties = [];
let communicationTenantId = null;

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

  const communicationLogForm = document.getElementById("communicationLogForm");
  if (communicationLogForm) {
    communicationLogForm.addEventListener("submit", saveCommunicationLogEntry);
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
        <button class="btn btn-sm btn-outline-primary" onclick="openCommunicationLog(${tenant.id})" title="Open communication log">Log Contact</button>
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

async function openCommunicationLog(tenantId) {
  const tenant = tenants.find((item) => item.id === tenantId);
  if (!tenant) return;
  communicationTenantId = tenantId;
  document.getElementById("communicationTenantId").value = tenantId;
  document.getElementById("communicationTenantName").textContent = tenant.name;
  resetCommunicationLogForm();
  await loadCommunicationLog(tenantId);
  document.getElementById("communicationLogDialog").showModal();
}

function resetCommunicationLogForm() {
  document.getElementById("communicationLogForm").reset();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("communicationDate").value = now
    .toISOString()
    .slice(0, 16);
}

async function loadCommunicationLog(tenantId) {
  const response = await fetch(
    `/accounting/tenants/${tenantId}/communication-log`,
  );
  if (!response.ok) throw new Error("Error loading communication log");
  const entries = await response.json();
  const tbody = document.querySelector("#communicationLogTable tbody");
  const empty = document.getElementById("communicationLogEmpty");
  empty.style.display = entries.length ? "none" : "block";
  tbody.innerHTML = entries
    .map(
      (entry) => `<tr>
        <td>${formatDateTime(entry.communication_date)}</td>
        <td>${escapeHtml(formatLabel(entry.method))}</td>
        <td><strong>${escapeHtml(entry.subject)}</strong>${entry.notes ? `<br><small class="text-muted">${escapeHtml(entry.notes)}</small>` : ""}</td>
        <td>${escapeHtml(formatLabel(entry.outcome))}</td>
        <td>${entry.next_follow_up_date ? formatDate(entry.next_follow_up_date) : "—"}</td>
        <td><button class="btn btn-sm btn-outline-danger" onclick="deleteCommunicationLog(${entry.id})" title="Delete log entry">✕</button></td>
      </tr>`,
    )
    .join("");
}

async function saveCommunicationLogEntry(event) {
  event.preventDefault();
  const payload = {
    communication_date: document.getElementById("communicationDate").value,
    method: document.getElementById("communicationMethod").value,
    outcome: document.getElementById("communicationOutcome").value,
    subject: document.getElementById("communicationSubject").value,
    notes: document.getElementById("communicationNotes").value || null,
    next_follow_up_date:
      document.getElementById("communicationNextFollowUp").value || null,
  };
  const response = await fetch(
    `/accounting/tenants/${communicationTenantId}/communication-log`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    alert("Unable to save communication log entry.");
    return;
  }
  resetCommunicationLogForm();
  await loadCommunicationLog(communicationTenantId);
}

async function deleteCommunicationLog(entryId) {
  if (!confirm("Delete this communication log entry?")) return;
  const response = await fetch(
    `/accounting/tenant-communication-log/${entryId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    alert("Unable to delete communication log entry.");
    return;
  }
  await loadCommunicationLog(communicationTenantId);
}

function formatLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  return value
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString()
    : "—";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
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
window.openCommunicationLog = openCommunicationLog;
window.deleteCommunicationLog = deleteCommunicationLog;
