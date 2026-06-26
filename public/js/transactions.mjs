import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const allOwnersUrl = `${apiUrl}/accounting/owners`;
const allPropertiesUrl = `${apiUrl}/accounting/properties`;
const vendorsUrl = `${apiUrl}/accounting/vendors`;
const invoicesUrl = `${apiUrl}/accounting/invoices`;
const expensesUrl = `${apiUrl}/accounting/expenses/owner`;
const rentUrl = `${apiUrl}/accounting/rent/collect`;
const feesUrl = `${apiUrl}/accounting/fees/management`;
const distributionsUrl = `${apiUrl}/accounting/distributions/owner`;

let user;
let owners = [];
let properties = [];
let vendors = [];
let transactions = [];
let unpaidInvoices = [];
let currentType = "expense";
let lastTransaction = null;
let filterProperty = null;
let isSubmitting = false;
let pendingDistribution = null; // Store distribution data for expense selection

// Initialize
async function initializeTransactions() {
  console.debug("[transactions.mjs] Initializing");
  user = await getSessionUser();
  await loadOwnersAndProperties();
  setupEventListeners();
  setupColumnResizing();
  setupKeyboardShortcuts();
  setTodayDate();
  await loadTransactions();
  updateQuickBalances();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTransactions);
} else {
  initializeTransactions();
}

function setupEventListeners() {
  // Type buttons
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const newType = e.target.dataset.type;
      document
        .querySelectorAll(".type-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentType = newType;
      updateFormForTransactionType();
    });
  });

  // Property change: reload invoices for rent type
  document
    .getElementById("entryProperty")
    .addEventListener("change", async (e) => {
      if (currentType === "rent") {
        await loadUnpaidInvoices();
      }
    });

  // Form submission
  document
    .getElementById("entryForm")
    .addEventListener("submit", submitTransaction);

  // Export & Refresh
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await loadTransactions();
    showMessage("Refreshed", "success");
  });

  // Property filter
  document.getElementById("propertyFilter").addEventListener("change", (e) => {
    filterProperty = e.target.value ? parseInt(e.target.value) : null;
    displayTransactions();
    updateStats();
  });

  // Distribution expense dialog
  const closeDistributionBtn = document.getElementById(
    "closeDistributionDialog",
  );
  if (closeDistributionBtn) {
    closeDistributionBtn.addEventListener("click", () => {
      document.getElementById("distributionExpenseDialog").close();
    });
  }

  const distributionExpenseForm = document.getElementById(
    "distributionExpenseForm",
  );
  if (distributionExpenseForm) {
    distributionExpenseForm.addEventListener(
      "submit",
      submitDistributionWithExpenses,
    );
  }

  const distributionExpenseDialog = document.getElementById(
    "distributionExpenseDialog",
  );
  if (distributionExpenseDialog) {
    distributionExpenseDialog.addEventListener("click", (e) => {
      if (e.target === distributionExpenseDialog) {
        distributionExpenseDialog.close();
      }
    });
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + 1,2,3,4 for transaction types
    if ((e.ctrlKey || e.metaKey) && e.key === "1") {
      switchType("expense");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "2") {
      switchType("rent");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "3") {
      switchType("fee");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "4") {
      switchType("distribution");
    }
    // Enter in amount field to submit
    if (e.key === "Enter" && e.target.id === "entryAmount") {
      e.preventDefault();
      document.getElementById("entryForm").dispatchEvent(new Event("submit"));
    }
  });

  // Prevent scroll wheel from changing the amount field
  document.getElementById("entryAmount").addEventListener(
    "wheel",
    (e) => {
      e.target.blur();
    },
    { passive: true },
  );
}

// Column Resizing
const DEFAULT_COLUMN_WIDTHS = ["80px", "80px", "1fr", "auto", "80px"];
const COLUMNS_STORAGE_KEY = "transactionLogColumnWidths";

function loadColumnWidths() {
  const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_COLUMN_WIDTHS;
}

function saveColumnWidths(widths) {
  localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(widths));
}

function applyColumnWidths(widths) {
  const container = document.getElementById("transactionLogContainer");
  if (!container) return;

  const header = container.querySelector(".log-header");
  const logEntries = container.querySelectorAll(".log-entry");

  const gridTemplate = widths.join(" ");
  if (header) header.style.gridTemplateColumns = gridTemplate;
  logEntries.forEach((entry) => {
    entry.style.gridTemplateColumns = gridTemplate;
  });
}

function setupColumnResizing() {
  const header = document.querySelector(".log-header");
  if (!header) return;

  const headerCols = header.querySelectorAll(".log-header-col");
  const columnCount = headerCols.length;

  let resizingColIndex = null;
  let startX = 0;
  let currentWidths = loadColumnWidths();

  headerCols.forEach((col, index) => {
    if (index === columnCount - 1) return; // Skip last column

    col.addEventListener("mousedown", (e) => {
      // Check if mouse is over the resize handle (right edge)
      const rect = col.getBoundingClientRect();
      const distFromRight = rect.right - e.clientX;
      if (distFromRight > 8) return; // Not on the handle

      e.preventDefault();
      resizingColIndex = index;
      startX = e.clientX;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (moveEvent) => {
        if (resizingColIndex === null) return;

        const delta = moveEvent.clientX - startX;
        currentWidths = loadColumnWidths();

        // Parse current width
        const currentWidth = currentWidths[resizingColIndex];
        let newWidth;

        if (currentWidth === "1fr") {
          // If flexible, convert to pixel-based
          const container = document.getElementById("transactionLogContainer");
          const logPanel = container.closest(".log-panel");
          const containerWidth = logPanel ? logPanel.clientWidth : 600;
          newWidth = Math.max(40, containerWidth / 4 + delta) + "px";
        } else {
          const pixelWidth = parseFloat(currentWidth);
          newWidth = Math.max(40, pixelWidth + delta) + "px";
        }

        currentWidths[resizingColIndex] = newWidth;
        applyColumnWidths(currentWidths);
        startX = moveEvent.clientX;
      };

      const onMouseUp = () => {
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
        saveColumnWidths(currentWidths);
        resizingColIndex = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });

  // Apply saved widths on load
  applyColumnWidths(currentWidths);
}

function switchType(type) {
  currentType = type;
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.type === type) {
      btn.classList.add("active");
    }
  });
  updateFormForTransactionType();
}

function setTodayDate() {
  // Get local date without UTC conversion to prevent timezone shift
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  document.getElementById("entryDate").value = `${year}-${month}-${day}`;
}

async function loadOwnersAndProperties() {
  try {
    const [ownersRes, propsRes, vendorsRes] = await Promise.all([
      fetch(allOwnersUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }),
      fetch(allPropertiesUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }),
      fetch(vendorsUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }),
    ]);

    if (!ownersRes.ok || !propsRes.ok || !vendorsRes.ok)
      throw new Error("Failed to load data");

    owners = await ownersRes.json();
    properties = await propsRes.json();
    vendors = await vendorsRes.json();

    populatePropertyDropdown();
    populatePropertyFilter();
    populateVendorDropdown();
    updateFormForTransactionType();
  } catch (error) {
    console.error("Error loading owners/properties:", error);
    showMessage("Error loading owners/properties", "error");
  }
}

function populatePropertyDropdown() {
  const select = document.getElementById("entryProperty");

  const options = properties
    .map((p) => `<option value="${p.id}">${escapeHtml(p.address)}</option>`)
    .join("");

  select.innerHTML = '<option value="">Select property...</option>' + options;

  // Auto-select if there's only one property
  if (properties.length === 1) {
    select.value = properties[0].id;
  }
}

/**
 * Derive the owner_id from the currently selected property.
 */
function getOwnerIdFromProperty() {
  const propertyId = document.getElementById("entryProperty").value;
  if (!propertyId) return null;
  const prop = properties.find((p) => p.id == propertyId);
  return prop ? prop.owner_id : null;
}

function populatePropertyFilter() {
  const select = document.getElementById("propertyFilter");
  if (!select) return;

  const options = properties
    .map(
      (p) =>
        `<option value="${p.id}">#${p.id} - ${escapeHtml(p.address)}</option>`,
    )
    .join("");

  select.innerHTML = '<option value="">All Properties</option>' + options;
}

function populateVendorDropdown() {
  const select = document.getElementById("entryVendor");
  if (!select) return;

  select.innerHTML = '<option value="">-- Select Vendor --</option>';

  vendors.forEach((vendor) => {
    const option = document.createElement("option");
    option.value = vendor.id;
    option.textContent = vendor.name;
    select.appendChild(option);
  });
}

/**
 * Update form visibility based on transaction type
 */
function updateFormForTransactionType() {
  const invoiceGroup = document.getElementById("invoiceSelectionGroup");
  if (invoiceGroup) {
    if (currentType === "rent") {
      invoiceGroup.style.display = "block";
      loadUnpaidInvoices();
    } else {
      invoiceGroup.style.display = "none";
      // Clear invoice selection for non-rent types
      document.getElementById("entryInvoice").value = "";
    }
  }
}

/**
 * Load unpaid invoices for the selected owner and property
 */
async function loadUnpaidInvoices() {
  try {
    const owner_id = getOwnerIdFromProperty();
    const property_id = document.getElementById("entryProperty").value
      ? parseInt(document.getElementById("entryProperty").value)
      : null;

    if (!owner_id) {
      unpaidInvoices = [];
      populateInvoiceDropdown();
      return;
    }

    // Fetch all invoices and filter for unpaid ones
    const response = await fetch(invoicesUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Failed to fetch invoices");
      unpaidInvoices = [];
      populateInvoiceDropdown();
      return;
    }

    const allInvoices = await response.json();

    // Filter for unpaid invoices matching owner and optional property
    unpaidInvoices = allInvoices.filter((inv) => {
      const statusMatch = inv.status !== "paid" && inv.status !== "cancelled";
      const ownerMatch = inv.owner_id === owner_id;
      const propertyMatch = property_id
        ? inv.property_id === property_id
        : true;
      return statusMatch && ownerMatch && propertyMatch;
    });

    populateInvoiceDropdown();
  } catch (error) {
    console.error("Error loading invoices:", error);
    unpaidInvoices = [];
    populateInvoiceDropdown();
  }
}

/**
 * Populate the invoice dropdown with unpaid invoices
 */
function populateInvoiceDropdown() {
  const select = document.getElementById("entryInvoice");
  if (!select) return;

  select.innerHTML = '<option value="">-- No invoice --</option>';

  unpaidInvoices.forEach((inv) => {
    const option = document.createElement("option");
    option.value = inv.id;
    option.dataset.amount = inv.amount;
    const amount = parseFloat(inv.amount).toFixed(2);
    const dueDate = inv.due_date
      ? new Date(inv.due_date).toLocaleDateString()
      : "No due date";
    option.textContent = `Invoice #${inv.id} - $${amount} (Due: ${dueDate})`;
    select.appendChild(option);
  });

  // Auto-fill amount when an invoice is selected
  select.addEventListener("change", () => {
    const selected = select.options[select.selectedIndex];
    const amountField = document.getElementById("entryAmount");
    if (selected && selected.dataset.amount) {
      amountField.value = parseFloat(selected.dataset.amount).toFixed(2);
    } else if (selected && !selected.dataset.amount) {
      amountField.value = "";
    }
  });
}

async function submitTransaction(e) {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting) {
    return;
  }

  const property_id = document.getElementById("entryProperty").value
    ? parseInt(document.getElementById("entryProperty").value)
    : null;
  const owner_id = getOwnerIdFromProperty();
  const amount = parseFloat(document.getElementById("entryAmount").value);
  const memo = document.getElementById("entryMemo").value;
  // Keep date as string from input (YYYY-MM-DD format) - backend will handle it as local date
  const date = document.getElementById("entryDate").value;
  const vendor_id = document.getElementById("entryVendor").value
    ? parseInt(document.getElementById("entryVendor").value)
    : null;
  const invoice_id = document.getElementById("entryInvoice").value
    ? parseInt(document.getElementById("entryInvoice").value)
    : null;

  if (!owner_id || !amount) {
    showMessage("Property and Amount are required", "error");
    return;
  }

  // For expenses, require vendor
  if (currentType === "expense" && !vendor_id) {
    showMessage("Vendor is required for expenses", "error");
    return;
  }

  // For distributions, show expense selection dialog
  if (currentType === "distribution") {
    pendingDistribution = {
      amount,
      owner_id,
      property_id,
      memo,
      date,
    };
    await showDistributionExpenseDialog(owner_id);
    return;
  }

  isSubmitting = true;

  try {
    const payload = { amount, owner_id, property_id, memo, date };

    // Add vendor_id for expenses only
    if (currentType === "expense") {
      payload.vendor_id = vendor_id;
    }

    // Include invoice_id for rent — backend marks it paid atomically
    if (currentType === "rent" && invoice_id) {
      payload.invoice_id = invoice_id;
    }

    let url;
    switch (currentType) {
      case "expense":
        url = expensesUrl;
        break;
      case "rent":
        url = rentUrl;
        break;
      case "fee":
        url = feesUrl;
        break;
      case "distribution":
        url = distributionsUrl;
        break;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save transaction");
    }

    const result = await response.json();
    lastTransaction = { type: currentType, ...result };

    if (currentType === "rent" && invoice_id) {
      showMessage(
        `✓ RENT recorded & Invoice #${invoice_id} marked as paid`,
        "success",
      );
    } else {
      showMessage(`✓ ${currentType.toUpperCase()} recorded`, "success");
    }

    document.getElementById("entryForm").reset();
    setTodayDate();
    await loadTransactions();
    updateQuickBalances();
    if (currentType === "rent") {
      await loadUnpaidInvoices();
    }

    // Focus back to property for next entry
    document.getElementById("entryProperty").focus();
    isSubmitting = false;
  } catch (error) {
    console.error("Error:", error);
    showMessage(error.message, "error");
    isSubmitting = false;
  }
}

/**
 * Update distribution preview with selected expenses and fees
 */
function updateDistributionPreview() {
  if (!pendingDistribution) return;

  const gross = parseFloat(pendingDistribution.amount) || 0;
  const selectedExpenseCheckboxes = document.querySelectorAll(
    "#expensesList .expense-checkbox:checked",
  );
  const selectedFeeCheckboxes = document.querySelectorAll(
    "#feesList .fee-checkbox:checked",
  );
  const selectedExpenseTotal = Array.from(selectedExpenseCheckboxes).reduce(
    (sum, cb) => sum + (parseFloat(cb.dataset.amount) || 0),
    0,
  );
  const selectedFeeTotal = Array.from(selectedFeeCheckboxes).reduce(
    (sum, cb) => sum + (parseFloat(cb.dataset.amount) || 0),
    0,
  );
  const net = gross - selectedExpenseTotal - selectedFeeTotal;

  const previewGross = document.getElementById("previewGross");
  const previewExpenses = document.getElementById("previewExpenses");
  const previewFees = document.getElementById("previewFees");
  const previewNet = document.getElementById("previewNet");

  if (previewGross) previewGross.textContent = `$${gross.toFixed(2)}`;
  if (previewFees) previewFees.textContent = `-$${selectedFeeTotal.toFixed(2)}`;
  if (previewExpenses)
    previewExpenses.textContent = `-$${selectedExpenseTotal.toFixed(2)}`;
  if (previewNet) previewNet.textContent = `$${net.toFixed(2)}`;
}

/**
 * Show distribution expense selection dialog
 * Loads unreimbursed expenses and uncollected fees for the selected owner
 */
async function showDistributionExpenseDialog(owner_id) {
  try {
    // Load unreimbursed expenses and uncollected fees in parallel
    const [expenseResponse, feeResponse] = await Promise.all([
      fetch(`${apiUrl}/accounting/owners/${owner_id}/unreimbursed-expenses`, {
        credentials: "include",
      }),
      fetch(`${apiUrl}/accounting/owners/${owner_id}/unreimbursed-fees`, {
        credentials: "include",
      }),
    ]);

    if (!expenseResponse.ok) throw new Error("Failed to load expenses");
    if (!feeResponse.ok) throw new Error("Failed to load fees");

    const expenses = await expenseResponse.json();
    const fees = await feeResponse.json();

    // Display fees
    const feesList = document.getElementById("feesList");
    if (fees.length === 0) {
      feesList.innerHTML =
        '<div style="padding: 12px; text-align: center; color: #999; font-size: 12px;">No uncollected fees.</div>';
    } else {
      feesList.innerHTML = fees
        .map(
          (fee) => `
        <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px;">
          <input
            type="checkbox"
            class="fee-checkbox"
            value="${fee.id}"
            data-amount="${fee.amount}"
          />
          <div style="flex: 1;">
            <div style="font-weight: 500; font-size: 13px;">${escapeHtml(fee.memo || "Management Fee")}</div>
            <div style="font-size: 12px; color: #666;">${formatDateShort(fee.date)}</div>
          </div>
          <div style="font-weight: 600; min-width: 80px; text-align: right;">
            $${parseFloat(fee.amount).toFixed(2)}
          </div>
        </div>
      `,
        )
        .join("");

      document.querySelectorAll(".fee-checkbox").forEach((cb) => {
        cb.addEventListener("change", updateDistributionPreview);
      });
    }

    // Display expenses
    const expensesList = document.getElementById("expensesList");
    if (expenses.length === 0) {
      expensesList.innerHTML =
        '<div style="padding: 12px; text-align: center; color: #999; font-size: 12px;">No unreimbursed expenses.</div>';
    } else {
      expensesList.innerHTML = expenses
        .map(
          (exp) => `
        <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px;">
          <input 
            type="checkbox" 
            class="expense-checkbox" 
            value="${exp.id}"
            data-amount="${exp.amount}"
          />
          <div style="flex: 1;">
            <div style="font-weight: 500; font-size: 13px;">${escapeHtml(exp.memo || "Unnamed")}</div>
            <div style="font-size: 12px; color: #666;">
              ${formatDateShort(exp.date)} • Vendor ID: ${exp.vendor_id || "—"}
            </div>
          </div>
          <div style="font-weight: 600; min-width: 80px; text-align: right;">
            $${parseFloat(exp.amount).toFixed(2)}
          </div>
        </div>
      `,
        )
        .join("");

      document.querySelectorAll(".expense-checkbox").forEach((checkbox) => {
        checkbox.addEventListener("change", updateDistributionPreview);
      });
    }

    // Initialize preview with gross amount
    updateDistributionPreview();

    // Open dialog
    document.getElementById("distributionExpenseDialog").showModal();
  } catch (error) {
    console.error("Error loading expenses/fees:", error);
    showMessage("Failed to load unreimbursed expenses and fees", "error");
  }
}

/**
 * Submit distribution with selected expenses
 */
async function submitDistributionWithExpenses(e) {
  e.preventDefault();

  if (!pendingDistribution) {
    showMessage("Error: Distribution data lost", "error");
    return;
  }

  // Get selected expense IDs
  const selectedExpenseCheckboxes = document.querySelectorAll(
    "#expensesList .expense-checkbox:checked",
  );
  const expense_ids = Array.from(selectedExpenseCheckboxes).map((cb) =>
    parseInt(cb.value),
  );

  // Get selected fee IDs
  const selectedFeeCheckboxes = document.querySelectorAll(
    "#feesList .fee-checkbox:checked",
  );
  const fee_ids = Array.from(selectedFeeCheckboxes).map((cb) =>
    parseInt(cb.value),
  );

  // Close dialog
  document.getElementById("distributionExpenseDialog").close();

  isSubmitting = true;

  try {
    const payload = {
      ...pendingDistribution,
      expense_ids,
      fee_ids,
    };

    const response = await fetch(distributionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save distribution");
    }

    const result = await response.json();
    lastTransaction = { type: "distribution", ...result };

    const parts = [];
    if (fee_ids.length > 0) parts.push(`${fee_ids.length} fee(s)`);
    if (expense_ids.length > 0) parts.push(`${expense_ids.length} expense(s)`);
    const deductionMsg =
      parts.length > 0 ? ` and deducted ${parts.join(" and ")}` : "";

    // Show success message with link to view report
    const reportUrl = `${apiUrl}/accounting/distributions/${result.id}/reconciliation-report`;
    showMessageWithLink(
      `✓ Distribution recorded${deductionMsg}`,
      "View Report",
      reportUrl,
      "success",
    );

    document.getElementById("entryForm").reset();
    setTodayDate();
    await loadTransactions();
    updateQuickBalances();

    // Focus back to property for next entry
    document.getElementById("entryProperty").focus();
    pendingDistribution = null;
  } catch (error) {
    console.error("Error:", error);
    showMessage(error.message, "error");
  } finally {
    isSubmitting = false;
  }
}

async function loadTransactions() {
  // For now, we'll load from a basic endpoint and format them
  try {
    // This would ideally be a dedicated transactions list endpoint
    // For now, we're fetching all transactions via owner statements
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");

    transactions = [];

    // Load transactions for each owner
    for (const owner of owners) {
      try {
        const response = await fetch(
          `${apiUrl}/accounting/ledger/owner/${owner.id}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );

        if (response.ok) {
          const entries = await response.json();
          if (Array.isArray(entries)) {
            transactions.push(
              ...entries.map((e) => ({
                ...e,
                owner_name: owner.name,
              })),
            );
          }
        }
      } catch (error) {
        console.error(
          `Error loading transactions for owner ${owner.id}:`,
          error,
        );
      }
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    displayTransactions();
    setupTransactionListeners();
    updateStats();
  } catch (error) {
    console.error("Error loading transactions:", error);
  }
}

function displayTransactions() {
  const log = document.getElementById("transactionLog");

  // Filter by property if selected
  let filtered = transactions;
  if (filterProperty) {
    filtered = transactions.filter((t) => t.property_id === filterProperty);
  }

  if (!filtered || filtered.length === 0) {
    log.innerHTML = `
      <div class="empty-log">
        <div class="empty-log-icon">📭</div>
        <div>${filterProperty ? "No transactions for this property." : "No transactions yet. Add one to get started."}</div>
      </div>
    `;
    // Still apply column widths for consistency
    applyColumnWidths(loadColumnWidths());
    return;
  }

  // Debug: Log all transactions to see what we have
  console.log("All transactions:", transactions);
  console.log("Filtered transactions:", filtered);

  // Debug: Check for distributions
  const distributions = filtered.filter((t) => {
    const memoLower = t.memo ? t.memo.toLowerCase() : "";
    const descLower = t.description ? t.description.toLowerCase() : "";
    return (
      memoLower.includes("distribution") || descLower.includes("distribution")
    );
  });
  console.log("Distribution transactions found:", distributions.length);
  if (distributions.length > 0) {
    console.log("First distribution:", distributions[0]);
  }

  // Debug: Log some memos to see what they look like
  console.log(
    "Sample memos:",
    filtered
      .slice(0, 5)
      .map((t) => ({ id: t.id, memo: t.memo, description: t.description })),
  );

  // Debug: Log ALL fields of first transaction to see what we have to work with
  if (filtered.length > 0) {
    console.log("All fields in first transaction:", Object.keys(filtered[0]));
    console.log("First transaction full object:", filtered[0]);
  }

  // Create vendor name lookup
  const vendorMap = {};
  vendors.forEach((v) => {
    vendorMap[v.id] = v.name;
  });

  const html = filtered.map((t, idx) => {
    const type = getTransactionType(t);

    // Debug: Log distribution transactions
    if (
      type === "distribution" ||
      (t.memo && t.memo.toLowerCase().includes("distribution"))
    ) {
      console.log("Distribution transaction found:", t);
    }

    const typeBadge = `<span class="log-type-badge badge-${type}" title="Transaction #${t.id}">${type.toUpperCase()}</span>`;
    const amount = parseFloat(t.amount) || 0;
    const propStr = t.property_id ? `#${t.property_id}` : "(no prop)";
    const vendorStr = t.vendor_id
      ? `<span style="color:#0066cc;font-weight:500">${escapeHtml(vendorMap[t.vendor_id] || "Unknown")}</span>`
      : "";

    // Add reimbursement status badge for expenses
    const reimbursementBadge =
      type === "expense"
        ? t.reimbursement_status === "reimbursed"
          ? `<span class="log-type-badge badge-reimbursed">✓ Reimbursed</span>`
          : `<span class="log-type-badge badge-unreimbursed">Pending</span>`
        : "";

    // Add receipt indicator for expenses
    const hasReceipts =
      type === "expense" && t.receipt_count && t.receipt_count > 0;
    const receiptClass = hasReceipts ? "receipt-attached" : "receipt-empty";
    const receiptBadge = hasReceipts
      ? `<span class="receipt-badge">${t.receipt_count}</span>`
      : "";
    const receiptIndicator =
      type === "expense"
        ? `<div class="log-action log-receipt ${receiptClass}" data-id="${t.id}" data-receipt-count="${t.receipt_count || 0}" title="${hasReceipts ? "View Receipt" : "Attach Receipt"}">📎${receiptBadge}</div>`
        : "";

    // Add report button for distributions
    const reportButton =
      type === "distribution"
        ? `<div class="log-report" data-dist-id="${t.distribution_id}" title="View distribution report" style="cursor:pointer;color:#0066cc;font-weight:bold;font-size:14px">📊</div>`
        : "";

    return `
      <div class="log-entry">
        <div class="log-date">${formatDateShort(t.date)}</div>
        <div class="log-amount">$${amount.toFixed(2)}</div>
        <div class="log-description">${typeBadge} ${reimbursementBadge} <span style="color:#999;font-size:11px">${propStr}</span> ${vendorStr} ${escapeHtml(t.memo || "")}</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${receiptIndicator}
          ${reportButton}
          <div class="log-undo" data-id="${t.id}" title="Delete transaction">✕</div>
        </div>
      </div>
    `;
  });

  log.innerHTML = html.join("");

  // Apply saved column widths
  applyColumnWidths(loadColumnWidths());
}

function setupTransactionListeners() {
  const log = document.getElementById("transactionLog");

  // Use event delegation to avoid duplicate listeners
  log.removeEventListener("click", handleTransactionClick);
  log.addEventListener("click", handleTransactionClick);
}

let currentTransactionIdForReceipt = null;

async function handleTransactionClick(e) {
  // Handle receipt click - paperclip or badge
  if (
    e.target.classList.contains("log-receipt") ||
    e.target.classList.contains("receipt-badge")
  ) {
    e.stopPropagation();
    const receiptElement =
      e.currentTarget.closest(".log-receipt") ||
      e.target.closest(".log-receipt");
    if (receiptElement) {
      const transactionId = receiptElement.dataset.id;
      if (e.target.classList.contains("receipt-badge")) {
        // Badge clicked = download
        await downloadTransactionReceipt(transactionId);
      } else {
        // Paperclip clicked = upload
        await attachTransactionReceipt(transactionId);
      }
    }
  }

  // Handle delete button
  if (e.target.classList.contains("log-undo")) {
    const id = e.target.dataset.id;
    if (confirm("Delete this transaction? This cannot be undone.")) {
      await undoTransaction(id);
    }
  }

  // Handle report button
  if (e.target.classList.contains("log-report")) {
    const distId = e.target.dataset.distId;
    const reportUrl = `${apiUrl}/accounting/distributions/${distId}/reconciliation-report`;
    window.open(reportUrl, "_blank");
  }
}

async function attachTransactionReceipt(transactionId) {
  // Open file input dialog
  currentTransactionIdForReceipt = transactionId;
  if (!document.getElementById("transactionReceiptFileInput")) {
    // Create hidden file input if it doesn't exist
    const input = document.createElement("input");
    input.type = "file";
    input.id = "transactionReceiptFileInput";
    input.accept = ".pdf,.jpg,.jpeg,.png,.gif,.tiff";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", uploadTransactionReceipt);
  }
  document.getElementById("transactionReceiptFileInput").click();
}

async function uploadTransactionReceipt(e) {
  try {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${apiUrl}/accounting/ledger/${currentTransactionIdForReceipt}/receipts`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to upload receipt");
    }

    showMessage("✓ Receipt uploaded successfully", "success");
    await loadTransactions();
    e.target.value = ""; // Reset file input
  } catch (error) {
    console.error("Error uploading receipt:", error);
    showMessage("Error uploading receipt", "error");
  }
}

async function downloadTransactionReceipt(transactionId) {
  try {
    const response = await fetch(
      `${apiUrl}/accounting/ledger/${transactionId}/receipts`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch receipts");
    }

    const receipts = await response.json();
    if (receipts.length > 0) {
      // Download the most recent receipt
      const receipt = receipts[0];
      const downloadUrl = `${apiUrl}/accounting/receipts/${receipt.id}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = receipt.filename;
      link.click();
    }
  } catch (error) {
    console.error("Error downloading receipt:", error);
    showMessage("Error downloading receipt", "error");
  }
}

function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter transactions by property if selected
  let filtered = transactions;
  if (filterProperty) {
    filtered = transactions.filter((t) => t.property_id === filterProperty);
  }

  const todayTxns = filtered.filter((t) => {
    const txnDate = new Date(t.date);
    txnDate.setHours(0, 0, 0, 0);
    return txnDate.getTime() === today.getTime();
  });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthTxns = filtered.filter((t) => new Date(t.date) >= monthStart);

  const totalVolume = filtered.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0),
    0,
  );

  // Calculate unreimbursed owner expenses
  const unreimbursed = filtered.filter(
    (t) =>
      t.debit_account_name?.includes("Owner Expense") &&
      t.reimbursement_status !== "reimbursed",
  );
  const unreimbursedCount = unreimbursed.length;
  const unreimbursedBalance = unreimbursed.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0),
    0,
  );

  document.getElementById("statsToday").textContent = todayTxns.length;
  document.getElementById("statsMonth").textContent = monthTxns.length;
  document.getElementById("statsTotal").textContent =
    `$${totalVolume.toFixed(2)}`;
  document.getElementById("statsUnreimbursedCount").textContent =
    unreimbursedCount;
  document.getElementById("statsUnreimbursedBalance").textContent =
    `$${unreimbursedBalance.toFixed(2)}`;
}

async function updateQuickBalances() {
  try {
    const balances = [];

    for (const owner of owners.slice(0, 5)) {
      try {
        const response = await fetch(
          `${apiUrl}/accounting/owners/${owner.id}/balance`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );

        if (response.ok) {
          const data = await response.json();
          balances.push({
            name: owner.name,
            balance: parseFloat(data.balance || 0),
          });
        }
      } catch (error) {
        console.error(`Error loading balance for owner ${owner.id}:`, error);
      }
    }

    const html = balances
      .map(
        (b) => `
      <div class="balance-item">
        <span class="balance-name">${escapeHtml(b.name)}</span>
        <span class="balance-amount ${b.balance < 0 ? "negative" : ""}">$${b.balance.toFixed(2)}</span>
      </div>
    `,
      )
      .join("");

    document.getElementById("quickBalances").innerHTML =
      html || '<div style="color: #999; font-size: 12px">No balances</div>';
  } catch (error) {
    console.error("Error updating quick balances:", error);
  }
}

function getTransactionType(txn) {
  // Check if this is a distribution (has distribution_id)
  if (txn.distribution_id) return "distribution";

  // Infer type from account names (most reliable)
  const debitAcct = txn.debit_account_name
    ? txn.debit_account_name.toLowerCase()
    : "";
  const creditAcct = txn.credit_account_name
    ? txn.credit_account_name.toLowerCase()
    : "";

  // Rent: Trust Cash (debit) + Rent Income (credit)
  if (creditAcct.includes("rent")) return "rent";

  // Fee: Owner Equity (debit) + Management Fee Income (credit)
  if (creditAcct.includes("management fee") || creditAcct.includes("fee"))
    return "fee";

  // Expense: Owner Expense (debit) + Trust Cash (credit)
  if (debitAcct.includes("expense")) return "expense";

  // Fallback: try memo as last resort
  const memoLower = txn.memo ? txn.memo.toLowerCase() : "";

  if (memoLower.includes("expense")) return "expense";
  if (memoLower.includes("rent")) return "rent";
  if (memoLower.includes("fee")) return "fee";

  return "transaction";
}

async function undoTransaction(id) {
  try {
    const response = await fetch(`${apiUrl}/accounting/ledger/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete transaction");
    }

    showMessage("✓ Transaction deleted", "success");
    await loadTransactions();
    updateQuickBalances();
  } catch (error) {
    console.error("Error undoing:", error);
    showMessage(error.message, "error");
  }
}

function exportToCSV() {
  if (transactions.length === 0) {
    showMessage("No transactions to export", "error");
    return;
  }

  const headers = ["Date", "Owner", "Amount", "Type", "Memo"];
  const rows = transactions.map((t) => [
    formatDateShort(t.date),
    t.owner_name || "",
    parseFloat(t.amount || 0).toFixed(2),
    getTransactionType(t),
    t.memo || "",
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
  a.download = `transactions-${formatLocalDate(new Date())}.csv`;
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

function showMessageWithLink(text, linkText, linkUrl, type = "info") {
  const container = document.getElementById("messageContainer");
  const classes =
    type === "error"
      ? "error-message"
      : type === "success"
        ? "success-message"
        : "info-message";

  const html = `
    <div class="${classes}" style="display: flex; justify-content: space-between; align-items: center;">
      <span>${escapeHtml(text)}</span>
      <a href="${escapeHtml(linkUrl)}" target="_blank" style="
        color: inherit;
        text-decoration: underline;
        margin-left: 15px;
        padding: 5px 10px;
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
        white-space: nowrap;
      ">
        ${escapeHtml(linkText)} ↗
      </a>
    </div>
  `;
  container.innerHTML = html;

  setTimeout(() => {
    container.innerHTML = "";
  }, 6000);
}

function formatLocalDate(date) {
  // Format date as YYYY-MM-DD using local time (not UTC)
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
