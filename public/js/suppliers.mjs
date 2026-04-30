import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const url = `${apiUrl}/accounting/vendors`;
let user;
let currentEditingId = null;

// Initialize handler function
async function initializeSuppliers() {
  console.debug("[suppliers.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadSuppliersData();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSuppliers);
} else {
  initializeSuppliers();
}

function setupEventListeners() {
  // Add Supplier button
  const addSupplierBtn = document.getElementById("addSupplierBtn");
  if (addSupplierBtn) {
    addSupplierBtn.addEventListener("click", openAddSupplierDialog);
  }

  // Close button for supplier dialog
  const closeSupplierBtn = document.getElementById("closeSupplierBtn");
  if (closeSupplierBtn) {
    closeSupplierBtn.addEventListener("click", () => {
      document.getElementById("supplierDialog").close();
    });
  }

  // Save supplier form
  const supplierForm = document.getElementById("supplierForm");
  if (supplierForm) {
    supplierForm.addEventListener("submit", saveSupplier);
  }

  // Close dialog on outside click
  const supplierDialog = document.getElementById("supplierDialog");
  if (supplierDialog) {
    supplierDialog.addEventListener("click", (e) => {
      if (e.target === supplierDialog) {
        supplierDialog.close();
      }
    });
  }
}

async function openAddSupplierDialog() {
  currentEditingId = null;
  const dialog = document.getElementById("supplierDialog");
  const title = document.getElementById("supplierDialogTitle");
  const form = document.getElementById("supplierForm");

  form.reset();
  title.textContent = "Add New Supplier";
  dialog.showModal();
}

async function openEditSupplierDialog(id) {
  try {
    const response = await fetch(`${url}/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      alert("Error loading supplier details");
      return;
    }

    const supplier = await response.json();
    currentEditingId = id;

    const form = document.getElementById("supplierForm");
    const title = document.getElementById("supplierDialogTitle");

    // Parse the description to extract fields
    const details = parseSupplierDescription(supplier.description || "");

    document.getElementById("supplierName").value = supplier.name || "";
    document.getElementById("supplierContact").value = details.contact || "";
    document.getElementById("supplierEmail").value = details.email || "";
    document.getElementById("supplierPhone").value = details.phone || "";
    document.getElementById("supplierAddress").value = details.address || "";
    document.getElementById("supplierWebsite").value = details.website || "";
    document.getElementById("supplierCategory").value = details.category || "";
    document.getElementById("supplierDescription").value = details.notes || "";

    title.textContent = "Edit Supplier";
    document.getElementById("supplierDialog").showModal();
  } catch (error) {
    console.error("Error loading supplier:", error);
    alert("Error loading supplier details");
  }
}

function parseSupplierDescription(description) {
  // Try to parse JSON structure
  try {
    return JSON.parse(description);
  } catch {
    // Return empty object if not JSON
    return {};
  }
}

async function saveSupplier(event) {
  event.preventDefault();
  const form = document.getElementById("supplierForm");
  const formData = new FormData(form);

  try {
    // Create a structured description object
    const supplierDetails = {
      contact: formData.get("contact") || "",
      email: formData.get("email") || "",
      phone: formData.get("phone") || "",
      address: formData.get("address") || "",
      website: formData.get("website") || "",
      category: formData.get("category") || "",
      notes: formData.get("description") || "",
    };

    const dataJson = {
      name: formData.get("name"),
      description: JSON.stringify(supplierDetails),
    };

    const method = currentEditingId ? "PUT" : "POST";
    const endpoint = currentEditingId ? `${url}/${currentEditingId}` : url;

    const response = await fetch(endpoint, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to save supplier"}`);
      return;
    }

    const supplier = await response.json();
    console.log("Supplier saved:", supplier);

    // Close dialog and refresh list
    document.getElementById("supplierDialog").close();
    await loadSuppliersData();

    const action = currentEditingId ? "updated" : "created";
    alert(`Supplier "${supplier.name}" ${action} successfully!`);
    currentEditingId = null;
  } catch (error) {
    console.error("Error saving supplier:", error);
    alert("Error saving supplier. Check console for details.");
  }
}

async function deleteSupplier(id, name) {
  if (!confirm(`Are you sure you want to delete supplier "${name}"?`)) {
    return;
  }

  try {
    const response = await fetch(`${url}/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to delete supplier"}`);
      return;
    }

    console.log("Supplier deleted:", id);
    await loadSuppliersData();
    alert(`Supplier "${name}" deleted successfully!`);
  } catch (error) {
    console.error("Error deleting supplier:", error);
    alert("Error deleting supplier. Check console for details.");
  }
}

async function loadSuppliersData() {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const suppliers = await response.json();
    displaySuppliers(suppliers);
  } catch (error) {
    console.error("Error loading suppliers:", error);
    const tbody = document.getElementById("suppliersTableBody");
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-danger py-4">Error loading suppliers</td></tr>';
  }
}

function displaySuppliers(suppliers) {
  const tbody = document.getElementById("suppliersTableBody");

  if (!suppliers || suppliers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted py-4">No suppliers found. Click + to add one.</td></tr>';
    return;
  }

  tbody.innerHTML = suppliers
    .map((supplier) => {
      const details = parseSupplierDescription(supplier.description || "");
      return `
    <tr>
      <td>${escapeHtml(supplier.id)}</td>
      <td><strong>${escapeHtml(supplier.name)}</strong></td>
      <td>${escapeHtml(details.contact || "-")}</td>
      <td>${escapeHtml(details.email || "-")}</td>
      <td>${escapeHtml(details.phone || "-")}</td>
      <td>${escapeHtml(details.category || "-")}</td>
      <td>${formatDate(supplier.created_at)}</td>
      <td>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          onclick="window.editSupplier(${supplier.id})"
          title="Edit supplier"
        >
          Edit
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          onclick="window.deleteSupplierHandler(${supplier.id}, '${escapeHtml(supplier.name).replace(/'/g, "\\'")}' )"
          title="Delete supplier"
        >
          Delete
        </button>
      </td>
    </tr>
  `;
    })
    .join("");

  // Attach global functions for button handlers
  window.editSupplier = openEditSupplierDialog;
  window.deleteSupplierHandler = deleteSupplier;
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
