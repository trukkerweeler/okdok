/**
 * Tenant Credits
 * View available/used overpayment credits per tenant and apply them to invoices
 */
import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const tenantCreditsUrl = `${apiUrl}/accounting/tenant-credits`;
const invoicesUrl = `${apiUrl}/accounting/invoices`;
const balanceUrl = `${apiUrl}/accounting/invoice-balance`;

let user;
let creditSummary = [];

async function initializeTenantCredits() {
  console.debug("[tenant-credits.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadCreditSummary();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTenantCredits);
} else {
  initializeTenantCredits();
}

function setupEventListeners() {
  document
    .getElementById("closeCreditHistoryBtn")
    .addEventListener("click", () => {
      document.getElementById("creditHistoryDialog").close();
    });

  document
    .getElementById("cancelApplyCreditBtn")
    .addEventListener("click", () => {
      document.getElementById("applyCreditDialog").close();
    });

  document
    .getElementById("applyCreditForm")
    .addEventListener("submit", submitApplyCredit);

  document
    .getElementById("creditHistoryDialog")
    .addEventListener("click", (e) => {
      if (e.target.id === "creditHistoryDialog") {
        e.target.close();
      }
    });

  document
    .getElementById("applyCreditDialog")
    .addEventListener("click", (e) => {
      if (e.target.id === "applyCreditDialog") {
        e.target.close();
      }
    });
}

async function loadCreditSummary() {
  try {
    const response = await fetch(tenantCreditsUrl, { credentials: "include" });
    if (!response.ok) throw new Error("Failed to load tenant credits");
    creditSummary = await response.json();
    renderCreditSummary();
  } catch (error) {
    console.error("Error loading tenant credits:", error);
    document.getElementById("tenantCreditsTableBody").innerHTML =
      '<tr><td colspan="5" class="text-center text-danger py-4">Error loading tenant credits.</td></tr>';
  }
}

function renderCreditSummary() {
  const tbody = document.getElementById("tenantCreditsTableBody");

  if (creditSummary.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted py-4">No tenant credits recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = creditSummary
    .map((row) => {
      const available = parseFloat(row.available_balance);
      const badgeClass = available > 0 ? "bg-success" : "bg-secondary";
      return `
        <tr>
          <td>${row.tenant_name || "Unknown"}</td>
          <td><span class="badge ${badgeClass}">$${available.toFixed(2)}</span></td>
          <td>$${parseFloat(row.total_credited).toFixed(2)}</td>
          <td>${row.credit_count}</td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-secondary me-2 view-history-btn" data-tenant-id="${row.tenant_id}" data-tenant-name="${escapeHtml(row.tenant_name || "Tenant")}">
              View History
            </button>
            <button type="button" class="btn btn-sm btn-primary apply-credit-btn" data-tenant-id="${row.tenant_id}" data-tenant-name="${escapeHtml(row.tenant_name || "Tenant")}" ${available > 0 ? "" : "disabled"}>
              Apply to Invoice
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".view-history-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openCreditHistory(btn.dataset.tenantId, btn.dataset.tenantName),
    );
  });

  tbody.querySelectorAll(".apply-credit-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openApplyCreditDialog(btn.dataset.tenantId, btn.dataset.tenantName),
    );
  });
}

async function openCreditHistory(tenantId, tenantName) {
  document.getElementById("creditHistoryTitle").textContent =
    `Credit History - ${tenantName}`;
  const tbody = document.getElementById("creditHistoryTableBody");
  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center text-muted py-3">Loading...</td></tr>';
  document.getElementById("creditHistoryDialog").showModal();

  try {
    const response = await fetch(`${tenantCreditsUrl}/${tenantId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load credit history");
    const data = await response.json();

    if (!data.credits || data.credits.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted py-3">No credits recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = data.credits
      .map(
        (credit) => `
        <tr>
          <td>${formatDate(credit.created_at)}</td>
          <td>$${parseFloat(credit.amount).toFixed(2)}</td>
          <td>$${parseFloat(credit.remaining_amount).toFixed(2)}</td>
          <td>${credit.source_invoice_id ? `#${credit.source_invoice_id}` : "-"}</td>
          <td>${escapeHtml(credit.notes || "")}</td>
        </tr>
      `,
      )
      .join("");
  } catch (error) {
    console.error("Error loading credit history:", error);
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-danger py-3">Error loading credit history.</td></tr>';
  }
}

async function openApplyCreditDialog(tenantId, tenantName) {
  document.getElementById("applyCreditTitle").textContent =
    `Apply Credit - ${tenantName}`;
  document.getElementById("applyCreditTenantId").value = tenantId;

  const select = document.getElementById("applyCreditInvoice");
  select.innerHTML = '<option value="">Loading invoices...</option>';
  document.getElementById("applyCreditAvailableLabel").textContent = "";
  document.getElementById("applyCreditDialog").showModal();

  const summaryRow = creditSummary.find(
    (row) => String(row.tenant_id) === String(tenantId),
  );
  const available = summaryRow ? parseFloat(summaryRow.available_balance) : 0;
  document.getElementById("applyCreditAvailableLabel").textContent =
    `Available credit: $${available.toFixed(2)}`;

  try {
    const response = await fetch(`${invoicesUrl}/tenant/${tenantId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load invoices");
    const tenantInvoices = (await response.json()).filter(
      (inv) => inv.status !== "cancelled" && inv.status !== "paid",
    );

    const balances = await Promise.all(
      tenantInvoices.map((inv) =>
        fetch(`${balanceUrl}/${inv.id}`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    );

    const unpaidInvoices = tenantInvoices
      .map((inv, i) => ({
        ...inv,
        balance: parseFloat(balances[i]?.balance ?? inv.amount),
      }))
      .filter((inv) => inv.balance > 0);

    if (unpaidInvoices.length === 0) {
      select.innerHTML =
        '<option value="">No unpaid invoices for this tenant</option>';
      return;
    }

    select.innerHTML =
      '<option value="">Select an invoice...</option>' +
      unpaidInvoices
        .map(
          (inv) =>
            `<option value="${inv.id}">#${inv.invoice_number} - Balance: $${inv.balance.toFixed(2)}</option>`,
        )
        .join("");
  } catch (error) {
    console.error("Error loading tenant invoices:", error);
    select.innerHTML = '<option value="">Error loading invoices</option>';
  }
}

async function submitApplyCredit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const tenant_id = parseInt(formData.get("tenant_id"));
  const invoice_id = parseInt(formData.get("invoice_id"));

  if (!invoice_id) {
    alert("Please select an invoice.");
    return;
  }

  try {
    const response = await fetch(`${tenantCreditsUrl}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id, invoice_id }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to apply credit"}`);
      return;
    }

    const result = await response.json();
    if (!result.appliedTotal || result.appliedTotal <= 0) {
      alert("No credit was applied (invoice may already be fully paid).");
    }

    document.getElementById("applyCreditDialog").close();
    await loadCreditSummary();
  } catch (error) {
    console.error("Error applying credit:", error);
    alert("Error applying credit. Please try again.");
  }
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
