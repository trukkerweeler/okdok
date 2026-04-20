import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const expensesUrl = `${apiUrl}/pm-expenses`;
const vendorsUrl = `${apiUrl}/accounting/vendors`;

let user;
let expenses = [];
let vendors = [];
let filterCategory = "";
let isSubmitting = false;

const categoryLabels = {
  office: "Office Supplies",
  technology: "Technology & Software",
  staff: "Staff & Training",
  utilities: "Utilities & Rent",
  marketing: "Marketing & Advertising",
  professional: "Professional Services",
  other: "Other",
};

// Initialize
async function initializeExpenses() {
  console.debug("[pm-expenses.mjs] Initializing");
  user = await getSessionUser();
  await loadVendors();
  setupEventListeners();
  setupKeyboardShortcuts();
  setTodayDate();
  await loadExpenses();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExpenses);
} else {
  initializeExpenses();
}

function setupEventListeners() {
  // Form submission
  document
    .getElementById("entryForm")
    .addEventListener("submit", submitExpense);

  // Category filter buttons
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      document
        .querySelectorAll(".category-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterCategory = btn.dataset.filter;
      displayExpenses();
      updateStats();
    });
  });

  // Export & Refresh
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await loadExpenses();
    showMessage("Refreshed", "success");
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Enter in amount field to submit
    if (e.key === "Enter" && e.target.id === "entryAmount") {
      e.preventDefault();
      document.getElementById("entryForm").dispatchEvent(new Event("submit"));
    }
  });
}

function setTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  document.getElementById("entryDate").value = `${year}-${month}-${day}`;
}

async function loadVendors() {
  try {
    const response = await fetch(vendorsUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    vendors = await response.json();
    populateVendorDropdown();
  } catch (error) {
    console.error("Error loading vendors:", error);
    showMessage("Error loading vendors", "error");
  }
}

function populateVendorDropdown() {
  const select = document.getElementById("entryVendor");
  select.innerHTML = '<option value="">-- Select Vendor --</option>';

  vendors.forEach((vendor) => {
    const option = document.createElement("option");
    option.value = vendor.id;
    option.textContent = vendor.name;
    select.appendChild(option);
  });
}

async function submitExpense(e) {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting) {
    return;
  }

  const category = document.getElementById("entryCategory").value;
  const amount = parseFloat(document.getElementById("entryAmount").value);
  const description = document.getElementById("entryDescription").value;
  const vendor_id = document.getElementById("entryVendor").value;
  const dateInputValue = document.getElementById("entryDate").value;

  if (!category || !amount || !description || !vendor_id) {
    showMessage(
      "Category, Amount, Description, and Vendor are required",
      "error",
    );
    return;
  }

  isSubmitting = true;

  try {
    // Use the date string directly - it's already in YYYY-MM-DD format from the input
    // Don't create a Date object as that causes timezone conversion issues
    const date = dateInputValue;

    const payload = {
      category,
      amount,
      description,
      vendor_id: parseInt(vendor_id),
      date,
    };

    const response = await fetch(expensesUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save expense");
    }

    const result = await response.json();
    console.log("Expense saved:", result);

    showMessage(`✓ $${amount.toFixed(2)} expense recorded`, "success");
    document.getElementById("entryForm").reset();
    setTodayDate();
    await loadExpenses();

    // Focus back to category for next entry
    document.getElementById("entryCategory").focus();
    isSubmitting = false;
  } catch (error) {
    console.error("Error:", error);
    showMessage(error.message, "error");
    isSubmitting = false;
  }
}

async function loadExpenses() {
  try {
    const response = await fetch(expensesUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    expenses = await response.json();
    // Sort by date descending
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    displayExpenses();
    updateStats();
  } catch (error) {
    console.error("Error loading expenses:", error);
    const log = document.getElementById("expenseLog");
    log.innerHTML =
      '<div class="empty-log"><div style="color: #dc3545">Error loading expenses</div></div>';
  }
}

function displayExpenses() {
  const log = document.getElementById("expenseLog");

  // Filter by category if selected
  let filtered = expenses;
  if (filterCategory) {
    filtered = expenses.filter((e) => e.category === filterCategory);
  }

  if (!filtered || filtered.length === 0) {
    log.innerHTML = `
      <div class="empty-log">
        <div class="empty-log-icon">💼</div>
        <div>${filterCategory ? "No expenses in this category." : "No expenses yet. Add one to get started."}</div>
      </div>
    `;
    return;
  }

  // Create vendor name lookup
  const vendorMap = {};
  vendors.forEach((v) => {
    vendorMap[v.id] = v.name;
  });

  const html = filtered.map((e) => {
    const amount = parseFloat(e.amount) || 0;
    const categoryLabel = categoryLabels[e.category] || e.category;
    const categorySpan = `<span class="log-category">${e.category}</span>`;
    const vendorName = e.vendor_id
      ? escapeHtml(vendorMap[e.vendor_id] || "Unknown")
      : "";
    const vendorStr = vendorName
      ? `<span style="color:#0066cc;font-weight:500">${vendorName}</span> — `
      : "";

    return `
      <div class="log-entry">
        <div class="log-date">${formatDateShort(e.date)}</div>
        <div class="log-amount">$${amount.toFixed(2)}</div>
        <div>${categorySpan}</div>
        <div class="log-description">${vendorStr}${escapeHtml(e.description)}</div>
        <div class="log-delete" data-id="${e.id}" title="Delete">✕</div>
      </div>
    `;
  });

  log.innerHTML = html.join("");

  // Add delete listeners
  document.querySelectorAll(".log-delete").forEach((el) => {
    el.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (confirm("Delete this expense?")) {
        await deleteExpense(id);
      }
    });
  });
}

async function deleteExpense(id) {
  try {
    const response = await fetch(`${expensesUrl}/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete expense");
    }

    showMessage("✓ Expense deleted", "success");
    await loadExpenses();
  } catch (error) {
    console.error("Error deleting:", error);
    showMessage("Error deleting expense", "error");
  }
}

function updateStats() {
  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  // Filter by category if selected
  let filtered = expenses;
  if (filterCategory) {
    filtered = expenses.filter((e) => e.category === filterCategory);
  }

  const monthExpenses = filtered.filter((e) => {
    const eDate = new Date(e.date);
    return eDate.getMonth() === thisMonth && eDate.getFullYear() === thisYear;
  });

  const yearExpenses = filtered.filter((e) => {
    const eDate = new Date(e.date);
    return eDate.getFullYear() === thisYear;
  });

  const monthTotal = monthExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0),
    0,
  );
  const yearTotal = yearExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0),
    0,
  );

  document.getElementById("statsMonth").textContent =
    `$${monthTotal.toFixed(2)}`;
  document.getElementById("statsYear").textContent = `$${yearTotal.toFixed(2)}`;
}

function exportToCSV() {
  if (expenses.length === 0) {
    showMessage("No expenses to export", "error");
    return;
  }

  const headers = ["Date", "Category", "Amount", "Description", "Vendor"];
  const rows = expenses.map((e) => [
    formatDateShort(e.date),
    categoryLabels[e.category] || e.category,
    e.amount.toFixed(2),
    e.description,
    e.vendor || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pm-expenses-${formatLocalDate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  showMessage("✓ Exported to CSV", "success");
}

function showMessage(text, type = "info") {
  const container = document.getElementById("messageContainer");
  const classes =
    type === "error"
      ? "error-message"
      : type === "success"
        ? "success-message"
        : "info-message";
  container.innerHTML = `<div class="${classes}">${escapeHtml(text)}</div>`;

  setTimeout(() => {
    container.innerHTML = "";
  }, 4000);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
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
