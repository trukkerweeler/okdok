import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const allOwnersUrl = `${apiUrl}/accounting/owners`;
const allPropertiesUrl = `${apiUrl}/accounting/properties`;
const vendorsUrl = `${apiUrl}/accounting/vendors`;
const expensesUrl = `${apiUrl}/accounting/expenses/owner`;
const rentUrl = `${apiUrl}/accounting/rent/collect`;
const feesUrl = `${apiUrl}/accounting/fees/management`;
const distributionsUrl = `${apiUrl}/accounting/distributions/owner`;

let user;
let owners = [];
let properties = [];
let vendors = [];
let transactions = [];
let currentType = "expense";
let lastTransaction = null;
let isBatchMode = false;
let filterProperty = null;
let isSubmitting = false;
let isBatchSubmitting = false;

// Initialize
async function initializeTransactions() {
  console.debug("[transactions.mjs] Initializing");
  user = await getSessionUser();
  await loadOwnersAndProperties();
  setupEventListeners();
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
      if (newType === "batch") {
        toggleBatchMode();
      } else {
        document
          .querySelectorAll(".type-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        currentType = newType;
      }
    });
  });

  // Form submission
  document
    .getElementById("entryForm")
    .addEventListener("submit", submitTransaction);
  document.getElementById("batchForm").addEventListener("submit", submitBatch);
  document
    .getElementById("batchCancel")
    .addEventListener("click", toggleBatchMode);

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
    if (e.key === "Enter" && e.target.id === "entryAmount" && !isBatchMode) {
      e.preventDefault();
      document.getElementById("entryForm").dispatchEvent(new Event("submit"));
    }
  });
}

function switchType(type) {
  currentType = type;
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.type === type) {
      btn.classList.add("active");
    }
  });
}

function toggleBatchMode() {
  isBatchMode = !isBatchMode;
  document.getElementById("entryForm").style.display = isBatchMode
    ? "none"
    : "block";
  document.getElementById("batchForm").style.display = isBatchMode
    ? "block"
    : "none";
  if (isBatchMode) {
    document.getElementById("batchInput").focus();
  } else {
    document.getElementById("entryOwner").focus();
  }
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

    populateOwnerDropdown();
    populatePropertyDropdown();
    populatePropertyFilter();
    populateVendorDropdown();
  } catch (error) {
    console.error("Error loading owners/properties:", error);
    showMessage("Error loading owners/properties", "error");
  }
}

function populateOwnerDropdown() {
  const select = document.getElementById("entryOwner");
  const options = owners
    .map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`)
    .join("");
  select.innerHTML = '<option value="">Select owner...</option>' + options;

  // Set first owner by default
  if (owners.length > 0) {
    select.value = owners[0].id;
  }

  // Update property dropdown when owner changes
  select.addEventListener("change", populatePropertyDropdown);
}

function populatePropertyDropdown() {
  const ownerId = document.getElementById("entryOwner").value;
  const select = document.getElementById("entryProperty");

  const ownerProps = properties.filter(
    (p) => !ownerId || p.owner_id == ownerId,
  );
  const options = ownerProps
    .map((p) => `<option value="${p.id}">${escapeHtml(p.address)}</option>`)
    .join("");

  select.innerHTML = '<option value="">All properties</option>' + options;
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

async function submitTransaction(e) {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting) {
    return;
  }

  const owner_id = parseInt(document.getElementById("entryOwner").value);
  const property_id = document.getElementById("entryProperty").value
    ? parseInt(document.getElementById("entryProperty").value)
    : null;
  const amount = parseFloat(document.getElementById("entryAmount").value);
  const memo = document.getElementById("entryMemo").value;
  // Keep date as string from input (YYYY-MM-DD format) - backend will handle it as local date
  const date = document.getElementById("entryDate").value;
  const vendor_id = document.getElementById("entryVendor").value
    ? parseInt(document.getElementById("entryVendor").value)
    : null;

  if (!owner_id || !amount) {
    showMessage("Owner and Amount are required", "error");
    return;
  }

  // For expenses, require vendor
  if (currentType === "expense" && !vendor_id) {
    showMessage("Vendor is required for expenses", "error");
    return;
  }

  isSubmitting = true;

  try {
    const payload = { amount, owner_id, property_id, memo, date };

    // Add vendor_id for expenses only
    if (currentType === "expense") {
      payload.vendor_id = vendor_id;
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

    showMessage(`✓ ${currentType.toUpperCase()} recorded`, "success");
    document.getElementById("entryForm").reset();
    setTodayDate();
    await loadTransactions();
    updateQuickBalances();

    // Focus back to owner for next entry
    document.getElementById("entryOwner").focus();
    isSubmitting = false;
  } catch (error) {
    console.error("Error:", error);
    showMessage(error.message, "error");
    isSubmitting = false;
  }
}

async function submitBatch(e) {
  e.preventDefault();

  // Prevent double submission
  if (isBatchSubmitting) {
    return;
  }

  const input = document.getElementById("batchInput").value.trim();
  if (!input) {
    showMessage("Enter transaction data", "error");
    return;
  }

  isBatchSubmitting = true;

  const lines = input.split("\n").filter((l) => l.trim());
  let successCount = 0;
  let errorCount = 0;

  showMessage(`Processing ${lines.length} transactions...`, "info");

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 2) continue;

    const ownerName = parts[0];
    const amount = parseFloat(parts[1]);
    const memo = parts[2] || "";

    // Find owner by name
    const owner = owners.find(
      (o) => o.name.toLowerCase() === ownerName.toLowerCase(),
    );
    if (!owner) {
      errorCount++;
      continue;
    }

    try {
      const payload = {
        amount,
        owner_id: owner.id,
        property_id: null,
        memo,
        date: formatLocalDate(new Date()),
      };

      const url =
        currentType === "expense"
          ? expensesUrl
          : currentType === "rent"
            ? rentUrl
            : currentType === "fee"
              ? feesUrl
              : distributionsUrl;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
  }

  showMessage(
    `✓ ${successCount} processed, ${errorCount} failed`,
    successCount > errorCount ? "success" : "error",
  );
  document.getElementById("batchInput").value = "";
  await loadTransactions();
  updateQuickBalances();
  isBatchSubmitting = false;
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
    return;
  }

  // Create vendor name lookup
  const vendorMap = {};
  vendors.forEach((v) => {
    vendorMap[v.id] = v.name;
  });

  const html = filtered.map((t, idx) => {
    const type = getTransactionType(t);
    const typeBadge = `<span class="log-type-badge badge-${type}">${type}</span>`;
    const amount = parseFloat(t.amount) || 0;
    const propStr = t.property_id ? `#${t.property_id}` : "(no prop)";
    const vendorStr = t.vendor_id
      ? `<span style="color:#0066cc;font-weight:500">${escapeHtml(vendorMap[t.vendor_id] || "Unknown")}</span>`
      : "";

    return `
      <div class="log-entry">
        <div class="log-date">${formatDateShort(t.date)}</div>
        <div class="log-amount">$${amount.toFixed(2)}</div>
        <div class="log-description">${typeBadge} <span style="color:#999;font-size:11px">${propStr}</span> ${vendorStr} ${escapeHtml(t.memo || "")}</div>
        <div class="log-undo" data-id="${t.id}" title="Delete transaction">✕</div>
      </div>
    `;
  });

  log.innerHTML = html.join("");

  // Add undo listeners
  document.querySelectorAll(".log-undo").forEach((el) => {
    el.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (confirm("Delete this transaction? This cannot be undone.")) {
        await undoTransaction(id);
      }
    });
  });
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

  document.getElementById("statsToday").textContent = todayTxns.length;
  document.getElementById("statsMonth").textContent = monthTxns.length;
  document.getElementById("statsTotal").textContent =
    `$${totalVolume.toFixed(2)}`;
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
  // Infer type from account names or memo
  if (txn.memo) {
    if (txn.memo.toLowerCase().includes("expense")) return "expense";
    if (txn.memo.toLowerCase().includes("rent")) return "rent";
    if (txn.memo.toLowerCase().includes("fee")) return "fee";
    if (txn.memo.toLowerCase().includes("distribution")) return "distribution";
  }
  return "transaction";
}

async function undoTransaction(id) {
  if (!confirm("Delete this transaction? This cannot be undone.")) {
    return;
  }

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
