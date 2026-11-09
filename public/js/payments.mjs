import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const paymentsUrl = `${apiUrl}/accounting/payments`;
const invoicesUrl = `${apiUrl}/accounting/invoices`;
const balanceUrl = `${apiUrl}/accounting/invoice-balance`;

let user;
let payments = [];
let invoices = [];
let paymentAttachments = {}; // Map of payment_id -> { slug: true } for attached documents
let filteredPayments = [];
let scanPaymentId = null;

const ATTACHMENT_TYPES = [
  { slug: "check-stub", label: "Check Stub" },
  { slug: "deposit-receipt", label: "Deposit Receipt" },
  { slug: "screenshot", label: "Screenshot" },
];

function hasAttachment(paymentId, slug) {
  return Boolean(paymentAttachments[paymentId]?.[slug]);
}

function setAttachment(paymentId, slug, present) {
  paymentAttachments[paymentId] = {
    ...paymentAttachments[paymentId],
    [slug]: present,
  };
}

function attachmentCount(paymentId) {
  return ATTACHMENT_TYPES.filter((type) => hasAttachment(paymentId, type.slug))
    .length;
}

const PLUS_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg>';

const PAPERCLIP_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

// Initialize handler function
async function initializePayments() {
  console.debug("[payments.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadReferenceData();
  await loadPaymentsData();
  setDefaultDate();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePayments);
} else {
  initializePayments();
}

function setupEventListeners() {
  // Add Payment button
  const addPaymentBtn = document.getElementById("addPaymentBtn");
  if (addPaymentBtn) {
    addPaymentBtn.addEventListener("click", openAddPaymentDialog);
  }

  // Close button for add payment dialog
  const closeAddBtn = document.getElementById("closeAddPaymentBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addPaymentDialog").close();
    });
  }

  // Save payment form
  const addPaymentForm = document.getElementById("addPaymentForm");
  if (addPaymentForm) {
    addPaymentForm.addEventListener("submit", savePayment);
  }

  // Close dialog on outside click
  const addPaymentDialog = document.getElementById("addPaymentDialog");
  if (addPaymentDialog) {
    addPaymentDialog.addEventListener("click", (e) => {
      if (e.target === addPaymentDialog) {
        addPaymentDialog.close();
      }
    });
  }

  // Add Scan dialog
  const addScanDialog = document.getElementById("addScanDialog");
  document
    .getElementById("closeAddScanBtn")
    ?.addEventListener("click", () => addScanDialog?.close());
  document.getElementById("addScanForm")?.addEventListener("submit", saveScan);
  addScanDialog?.addEventListener("click", (e) => {
    if (e.target === addScanDialog) addScanDialog.close();
  });

  // Remove a wrongly chosen attachment
  document.querySelectorAll(".clear-file-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.value = "";
    });
  });

  // Invoice dropdown change - update balance display
  const invoiceSelect = document.getElementById("paymentInvoice");
  if (invoiceSelect) {
    invoiceSelect.addEventListener("change", updateBalanceDisplay);
  }

  ["paymentYearFilter", "paymentMonthFilter", "paymentMethodFilter"].forEach(
    (id) =>
      document
        .getElementById(id)
        ?.addEventListener("change", refreshPaymentView),
  );
  document
    .getElementById("paymentSearch")
    ?.addEventListener("input", refreshPaymentView);
  document
    .getElementById("exportPaymentsBtn")
    ?.addEventListener("click", exportPaymentsToCSV);
}

async function loadReferenceData() {
  try {
    // Load invoices and keep only those with actual positive remaining balance.
    const response = await fetch(invoicesUrl, {
      credentials: "include",
    });
    if (response.ok) {
      const allInvoices = await response.json();

      const candidateInvoices = allInvoices.filter(
        (inv) => inv.status !== "cancelled",
      );

      const balanceResults = await Promise.all(
        candidateInvoices.map((inv) =>
          fetch(`${balanceUrl}/${inv.id}`, {
            credentials: "include",
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );

      invoices = candidateInvoices
        .map((inv, i) => ({
          ...inv,
          remaining_balance: balanceResults[i]?.balance ?? inv.amount,
        }))
        .filter((inv) => parseFloat(inv.remaining_balance) > 0);

      populateInvoiceDropdown();
    }
  } catch (error) {
    console.error("Error loading invoices:", error);
  }
}

function populateInvoiceDropdown() {
  const select = document.getElementById("paymentInvoice");
  if (!select) return;

  select.innerHTML = '<option value="">Select an invoice...</option>';
  invoices.forEach((invoice) => {
    const option = document.createElement("option");
    option.value = invoice.id;
    const remaining = parseFloat(
      invoice.remaining_balance ?? invoice.amount,
    ).toFixed(2);
    option.textContent = `${invoice.invoice_number} - ${invoice.owner_name} - $${remaining} remaining`;
    select.appendChild(option);
  });
}

async function updateBalanceDisplay() {
  const invoiceSelect = document.getElementById("paymentInvoice");
  const balanceDisplay = document.getElementById("invoiceBalance");
  const tenantDisplay = document.getElementById("invoiceTenant");
  const amountInput = document.getElementById("paymentAmount");

  if (!invoiceSelect || !balanceDisplay) return;

  const invoiceId = invoiceSelect.value;
  balanceDisplay.value = "";
  if (tenantDisplay) tenantDisplay.value = "";
  balanceDisplay.classList.remove("balance-zero", "balance-pending");
  if (amountInput) amountInput.max = "";

  if (invoiceId) {
    try {
      // Get the selected invoice to show tenant info
      const selectedInvoice = invoices.find((inv) => inv.id == invoiceId);
      if (tenantDisplay && selectedInvoice) {
        tenantDisplay.value = selectedInvoice.tenant_name || "—";
      }

      const response = await fetch(`${balanceUrl}/${invoiceId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const balance = await response.json();
        const balanceAmount = parseFloat(balance.balance).toFixed(2);
        balanceDisplay.value = `$${balanceAmount}`;

        // Color code the balance field
        if (balanceAmount == 0) {
          balanceDisplay.classList.add("balance-zero");
        } else {
          balanceDisplay.classList.add("balance-pending");
        }

        // Set max payment to remaining balance
        if (amountInput) {
          amountInput.max = balanceAmount;
        }
      }
    } catch (error) {
      console.error("Error fetching invoice balance:", error);
    }
  }
}

function setDefaultDate() {
  const dateInput = document.getElementById("paymentDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
}

async function openAddPaymentDialog() {
  const dialog = document.getElementById("addPaymentDialog");
  if (dialog) {
    const form = document.getElementById("addPaymentForm");
    form.reset();
    setDefaultDate();
    dialog.showModal();
  }
}

async function savePayment(event) {
  event.preventDefault();
  const form = document.getElementById("addPaymentForm");
  const formData = new FormData(form);
  const checkStubFile = formData.get("check_stub");

  try {
    // First, save the payment record
    const dataJson = {
      invoice_id: parseInt(formData.get("invoice_id")),
      payment_date: formData.get("payment_date"),
      amount_paid: parseFloat(formData.get("amount_paid")),
      payment_method: formData.get("payment_method") || null,
      reference_number: formData.get("reference_number") || null,
      notes: formData.get("notes") || null,
    };

    const response = await fetch(paymentsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to save payment"}`);
      return;
    }

    const newPayment = await response.json();
    console.log("Payment saved:", newPayment);

    // If a check stub file was provided, upload it
    if (checkStubFile && checkStubFile.size > 0) {
      const checkStubFormData = new FormData();
      checkStubFormData.append("check_stub", checkStubFile);

      try {
        const uploadResponse = await fetch(
          `${paymentsUrl}/${newPayment.id}/check-stub`,
          {
            method: "PUT",
            body: checkStubFormData,
            credentials: "include",
          },
        );

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          console.warn(
            `Check stub upload warning: ${
              uploadError.error || "Failed to upload check stub"
            }`,
          );
        } else {
          console.log("Check stub uploaded successfully");
        }
      } catch (uploadError) {
        console.error("Error uploading check stub:", uploadError);
      }
    }

    // If a deposit receipt file was provided, upload it
    const depositReceiptFile = formData.get("deposit_receipt");
    if (depositReceiptFile && depositReceiptFile.size > 0) {
      const depositFormData = new FormData();
      depositFormData.append("deposit_receipt", depositReceiptFile);

      try {
        const uploadResponse = await fetch(
          `${paymentsUrl}/${newPayment.id}/deposit-receipt`,
          {
            method: "PUT",
            body: depositFormData,
            credentials: "include",
          },
        );

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          console.warn(
            `Deposit receipt upload warning: ${
              uploadError.error || "Failed to upload deposit receipt"
            }`,
          );
        } else {
          console.log("Deposit receipt uploaded successfully");
        }
      } catch (uploadError) {
        console.error("Error uploading deposit receipt:", uploadError);
      }
    }

    // Close dialog and refresh list
    document.getElementById("addPaymentDialog").close();
    await loadPaymentsData();
  } catch (error) {
    console.error("Error saving payment:", error);
    alert(`Error: ${error.message}`);
  }
}

async function loadPaymentsData() {
  try {
    const response = await fetch(paymentsUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }

    payments = await response.json();
    populateYearFilter();

    // The API returns which attachment types each payment has.
    paymentAttachments = {};
    for (const payment of payments) {
      paymentAttachments[payment.id] = {
        "check-stub": Boolean(payment.has_check_stub),
        "deposit-receipt": Boolean(payment.has_deposit_receipt),
        screenshot: Boolean(payment.has_screenshot),
      };
    }

    displayPayments();
    updateSummary(filteredPayments);
  } catch (error) {
    console.error("Error loading payments:", error);
    alert(`Error loading payments: ${error.message}`);
  }
}

function displayPayments() {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;

  filteredPayments = getFilteredPayments();

  if (filteredPayments.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="text-center text-muted py-4">No payments match the selected filters.</td></tr>';
    return;
  }

  // Calculate balance for each payment's invoice
  const paymentsByInvoice = {};
  filteredPayments.forEach((p) => {
    if (!paymentsByInvoice[p.invoice_id]) {
      paymentsByInvoice[p.invoice_id] = {
        total: 0,
        invoiceAmount: p.invoice_amount,
      };
    }
    paymentsByInvoice[p.invoice_id].total += parseFloat(p.amount_paid);
  });

  tbody.innerHTML = filteredPayments
    .map((payment) => {
      const amountPaid = formatCurrency(payment.amount_paid);
      const amountDue = formatCurrency(payment.invoice_amount);
      const paymentDate = formatDate(payment.payment_date);

      const invoiceData = paymentsByInvoice[payment.invoice_id];
      const balance = parseFloat(payment.invoice_amount) - invoiceData.total;
      const balanceCurrency = formatCurrency(Math.max(0, balance));

      const attachments = attachmentCount(payment.id);
      const attachmentsButton = attachments
        ? `<button class="btn btn-sm btn-info attachments-btn" data-id="${payment.id}" title="${attachments} attachment${attachments === 1 ? "" : "s"} - view, add or replace" aria-label="Attachments (${attachments})">${PAPERCLIP_ICON_SVG}<span class="ms-1">${attachments}</span></button>`
        : `<button class="btn btn-sm btn-outline-primary attachments-btn" data-id="${payment.id}" title="Add attachment or edit method/reference" aria-label="Add attachment">${PLUS_ICON_SVG}</button>`;

      const reference = payment.reference_number
        ? `<div class="text-muted small">#${escapeHtml(payment.reference_number)}</div>`
        : "";

      return `
        <tr>
          <td><strong>${escapeHtml(payment.invoice_number)}</strong></td>
          <td>
            <div><strong>${escapeHtml(payment.tenant_name || "—")}</strong></div>
            <div class="text-muted small">${escapeHtml(payment.property_address || "—")}</div>
          </td>
          <td>${escapeHtml(payment.invoice_type || "—")}</td>
          <td class="text-end">${amountDue}</td>
          <td class="text-end">${amountPaid}</td>
          <td class="text-end">${balanceCurrency}</td>
          <td>${paymentDate}</td>
          <td>
            <div>${escapeHtml(payment.payment_method || "—")}</div>
            ${reference}
          </td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              ${attachmentsButton}
              <button class="btn btn-sm btn-danger delete-btn" data-id="${payment.id}" title="Delete Payment">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".attachments-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      openAddScanDialog(parseInt(e.currentTarget.dataset.id));
    });
  });

  // Add event listeners for delete buttons
  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const paymentId = parseInt(e.target.dataset.id);
      deletePayment(paymentId);
    });
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US");
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateSummary(paymentsForSummary = getFilteredPayments()) {
  // Calculate total payments
  const totalPaid = paymentsForSummary.reduce(
    (sum, p) => sum + parseFloat(p.amount_paid),
    0,
  );

  // Calculate outstanding balance by invoice
  const invoiceTotals = {};
  paymentsForSummary.forEach((p) => {
    if (!invoiceTotals[p.invoice_id]) {
      invoiceTotals[p.invoice_id] = {
        invoiceAmount: parseFloat(p.invoice_amount),
        totalPaid: 0,
      };
    }
    invoiceTotals[p.invoice_id].totalPaid += parseFloat(p.amount_paid);
  });

  // Add invoices with no payments in the filtered payment list. An invoice can
  // still be outstanding even when it has no payment record yet.
  invoices
    .filter(
      (inv) =>
        inv.status !== "cancelled" &&
        matchesInvoiceDateFilter(inv),
    )
    .forEach((inv) => {
      if (!invoiceTotals[inv.id]) {
        invoiceTotals[inv.id] = {
          invoiceAmount: parseFloat(inv.amount),
          totalPaid: 0,
        };
      }
    });

  let totalBalance = 0;
  Object.values(invoiceTotals).forEach((inv) => {
    const balance = inv.invoiceAmount - inv.totalPaid;
    if (balance > 0) {
      totalBalance += balance;
    }
  });

  // Update summary cards
  const totalPaymentsEl = document.getElementById("totalPayments");
  if (totalPaymentsEl) {
    totalPaymentsEl.textContent = formatCurrency(totalPaid);
  }

  const totalBalanceEl = document.getElementById("totalBalance");
  if (totalBalanceEl) {
    totalBalanceEl.textContent = formatCurrency(totalBalance);
  }

  const invoiceCountEl = document.getElementById("invoiceCount");
  if (invoiceCountEl) {
    invoiceCountEl.textContent = Object.keys(invoiceTotals).length;
  }
}

function populateYearFilter() {
  const select = document.getElementById("paymentYearFilter");
  if (!select) return;

  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear]);
  payments.forEach((payment) => {
    const year = getDateParts(payment.payment_date)?.year;
    if (year) years.add(year);
  });

  const selectedYear = select.value || String(currentYear);
  select.innerHTML = '<option value="">All years</option>';
  [...years]
    .sort((left, right) => right - left)
    .forEach((year) => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      select.appendChild(option);
    });
  select.value = years.has(Number(selectedYear))
    ? selectedYear
    : String(currentYear);
}

function getDateParts(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

function matchesDateFilter(dateValue) {
  const parts = getDateParts(dateValue);
  if (!parts) return false;
  const year = document.getElementById("paymentYearFilter")?.value;
  const month = document.getElementById("paymentMonthFilter")?.value;
  return (
    (!year || parts.year === Number(year)) &&
    (!month || parts.month === Number(month))
  );
}

function matchesInvoiceDateFilter(invoice) {
  return [
    invoice.invoice_date,
    invoice.due_date,
    invoice.created_at,
  ].some((dateValue) => matchesDateFilter(dateValue));
}

function getFilteredPayments() {
  const method = document.getElementById("paymentMethodFilter")?.value || "";
  const search = (document.getElementById("paymentSearch")?.value || "")
    .trim()
    .toLowerCase();

  return payments.filter((payment) => {
    if (!matchesDateFilter(payment.payment_date)) return false;
    if (method && payment.payment_method !== method) return false;
    if (!search) return true;
    return [
      payment.invoice_number,
      payment.tenant_name,
      payment.property_address,
      payment.owner_name,
      payment.reference_number,
    ].some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function refreshPaymentView() {
  displayPayments();
  updateSummary(filteredPayments);
}

function exportPaymentsToCSV() {
  const headers = [
    "Invoice #",
    "Property",
    "Tenant",
    "Type",
    "Amount Due",
    "Amount Paid",
    "Balance Due",
    "Payment Date",
    "Method",
    "Reference",
  ];
  const rows = filteredPayments.map((payment) => {
    const invoiceData = filteredPayments
      .filter((item) => item.invoice_id === payment.invoice_id)
      .reduce((total, item) => total + Number(item.amount_paid || 0), 0);
    return [
      payment.invoice_number,
      payment.property_address,
      payment.tenant_name,
      payment.invoice_type,
      Number(payment.invoice_amount || 0).toFixed(2),
      Number(payment.amount_paid || 0).toFixed(2),
      Math.max(0, Number(payment.invoice_amount || 0) - invoiceData).toFixed(2),
      payment.payment_date,
      payment.payment_method,
      payment.reference_number,
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => csvValue(value)).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `payments-${document.getElementById("paymentYearFilter")?.value || "all-years"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function deletePayment(paymentId) {
  if (!confirm("Are you sure you want to delete this payment record?")) {
    return;
  }

  try {
    const response = await fetch(`${paymentsUrl}/${paymentId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete payment");
    }

    await loadPaymentsData();
  } catch (error) {
    console.error("Error deleting payment:", error);
    alert(`Error: ${error.message}`);
  }
}

function openAddScanDialog(paymentId) {
  const dialog = document.getElementById("addScanDialog");
  if (!dialog) return;
  scanPaymentId = paymentId;
  document.getElementById("addScanForm").reset();
  const payment = payments.find((p) => p.id === paymentId);
  const methodSelect = document.getElementById("scanMethod");
  const method = payment?.payment_method || "";
  // Keep legacy methods that aren't in the standard list selectable.
  if (method && ![...methodSelect.options].some((o) => o.value === method)) {
    methodSelect.add(new Option(method, method));
  }
  methodSelect.value = method;
  document.getElementById("scanReference").value =
    payment?.reference_number || "";
  renderScanAttachmentList();
  dialog.showModal();
}

function renderScanAttachmentList() {
  const list = document.getElementById("scanAttachmentList");
  if (!list) return;

  const attached = ATTACHMENT_TYPES.filter((type) =>
    hasAttachment(scanPaymentId, type.slug),
  );

  if (attached.length === 0) {
    list.innerHTML =
      '<li class="text-muted small">No documents attached yet.</li>';
    return;
  }

  list.innerHTML = attached
    .map(
      (type) => `
        <li class="d-flex align-items-center justify-content-between mb-1">
          <span>${escapeHtml(type.label)}</span>
          <span class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary download-attachment-btn" data-slug="${type.slug}">Download</button>
            <button type="button" class="btn btn-outline-danger delete-attachment-btn" data-slug="${type.slug}">Remove</button>
          </span>
        </li>
      `,
    )
    .join("");

  list.querySelectorAll(".download-attachment-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      downloadAttachmentType(scanPaymentId, btn.dataset.slug),
    );
  });
  list.querySelectorAll(".delete-attachment-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteAttachmentType(btn.dataset.slug));
  });
}

async function deleteAttachmentType(slug) {
  const type = ATTACHMENT_TYPES.find((t) => t.slug === slug);
  if (!confirm(`Remove the ${type?.label || slug}?`)) return;

  try {
    const response = await fetch(`${paymentsUrl}/${scanPaymentId}/${slug}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Failed to remove ${type?.label || slug}`);
    }
    setAttachment(scanPaymentId, slug, false);
    renderScanAttachmentList();
    displayPayments();
  } catch (error) {
    console.error("Error removing attachment:", error);
    alert(`Error: ${error.message}`);
  }
}

async function saveScan(event) {
  event.preventDefault();
  const scanType = document.getElementById("scanType").value;
  const file = document.getElementById("scanFile").files[0];

  try {
    if (file) {
      const fieldName = scanType.replace("-", "_");
      const body = new FormData();
      body.append(fieldName, file);

      const response = await fetch(
        `${paymentsUrl}/${scanPaymentId}/${scanType}`,
        {
          method: "PUT",
          body,
          credentials: "include",
        },
      );
      if (response.status === 401) {
        alert("Your session has expired. Please log in again.");
        window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to upload document");
      }

      // Reflect the new document on the row immediately rather than waiting
      // on a full reload.
      setAttachment(scanPaymentId, scanType, true);
    }

    const payment = payments.find((p) => p.id === scanPaymentId);
    const method = document.getElementById("scanMethod").value;
    const reference = document.getElementById("scanReference").value.trim();
    if (
      payment &&
      (method !== (payment.payment_method || "") ||
        reference !== (payment.reference_number || ""))
    ) {
      const detailsResponse = await fetch(
        `${paymentsUrl}/${scanPaymentId}/details`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_method: method,
            reference_number: reference,
          }),
          credentials: "include",
        },
      );
      if (!detailsResponse.ok) {
        displayPayments();
        throw new Error(
          "Document saved, but the method/reference could not be saved",
        );
      }
      payment.payment_method = method || null;
      payment.reference_number = reference || null;
    }
    displayPayments();

    document.getElementById("addScanDialog").close();
  } catch (error) {
    console.error("Error saving attachment/details:", error);
    alert(`Error: ${error.message}`);
  }
}

async function downloadAttachment(url, defaultFilename) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to download file");
  }
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = defaultFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+?)"/);
    if (match) filename = match[1];
  }
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(objectUrl);
  document.body.removeChild(a);
}

async function downloadAttachmentType(paymentId, slug) {
  try {
    await downloadAttachment(`${paymentsUrl}/${paymentId}/${slug}`, slug);
  } catch (error) {
    console.error(`Error downloading ${slug}:`, error);
    alert(`Error: ${error.message}`);
  }
}

