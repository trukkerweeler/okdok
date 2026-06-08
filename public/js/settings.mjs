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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeSettingsPage);
