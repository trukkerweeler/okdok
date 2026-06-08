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
let paymentCheckStubs = {}; // Map of payment_id -> has_check_stub
let paymentDepositReceipts = {}; // Map of payment_id -> has_deposit_receipt

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

  // Invoice dropdown change - update balance display
  const invoiceSelect = document.getElementById("paymentInvoice");
  if (invoiceSelect) {
    invoiceSelect.addEventListener("change", updateBalanceDisplay);
  }
}

async function loadReferenceData() {
  try {
    // Load invoices with pending/sent status
    const response = await fetch(invoicesUrl, {
      credentials: "include",
    });
    if (response.ok) {
      const allInvoices = await response.json();
      // Filter to unpaid invoices
      invoices = allInvoices.filter((inv) => inv.status !== "cancelled");
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
    option.textContent = `${invoice.invoice_number} - ${invoice.owner_name} - $${parseFloat(invoice.amount).toFixed(2)}`;
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
    console.debug("Payments loaded:", payments);
    // if (payments.length > 0) {
    //   console.log("First payment keys:", Object.keys(payments[0]));
    //   console.log("First payment tenant_name:", payments[0].tenant_name);
    //   console.log("First payment full object:", payments[0]);
    // }

    // Check which payments have check stubs and deposit receipts
    paymentCheckStubs = {};
    paymentDepositReceipts = {};
    for (const payment of payments) {
      try {
        const [stubResponse, receiptResponse] = await Promise.all([
          fetch(`${paymentsUrl}/${payment.id}/check-stub`, {
            credentials: "include",
          }),
          fetch(`${paymentsUrl}/${payment.id}/deposit-receipt`, {
            credentials: "include",
          }),
        ]);
        paymentCheckStubs[payment.id] = stubResponse.ok;
        paymentDepositReceipts[payment.id] = receiptResponse.ok;
      } catch (error) {
        paymentCheckStubs[payment.id] = false;
        paymentDepositReceipts[payment.id] = false;
      }
    }

    displayPayments();
    updateSummary();
  } catch (error) {
    console.error("Error loading payments:", error);
    alert(`Error loading payments: ${error.message}`);
  }
}

function displayPayments() {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="text-center text-muted py-4">No payments recorded yet. Click + to record a payment.</td></tr>';
    return;
  }

  // Calculate balance for each payment's invoice
  const paymentsByInvoice = {};
  payments.forEach((p) => {
    if (!paymentsByInvoice[p.invoice_id]) {
      paymentsByInvoice[p.invoice_id] = {
        total: 0,
        invoiceAmount: p.invoice_amount,
      };
    }
    paymentsByInvoice[p.invoice_id].total += parseFloat(p.amount_paid);
  });

  tbody.innerHTML = payments
    .map((payment) => {
      const amountPaid = formatCurrency(payment.amount_paid);
      const paymentDate = formatDate(payment.payment_date);

      const invoiceData = paymentsByInvoice[payment.invoice_id];
      const balance = parseFloat(payment.invoice_amount) - invoiceData.total;
      const balanceCurrency = formatCurrency(Math.max(0, balance));

      const checkStubButton = paymentCheckStubs[payment.id]
        ? `<button class="btn btn-sm btn-info download-check-stub-btn" data-id="${payment.id}" title="Download Check Stub">📄</button>`
        : `<button class="btn btn-sm btn-outline-secondary" disabled title="No check stub">📄</button>`;

      const depositReceiptButton = paymentDepositReceipts[payment.id]
        ? `<button class="btn btn-sm btn-info download-deposit-receipt-btn" data-id="${payment.id}" title="Download Deposit Receipt">🏦</button>`
        : `<button class="btn btn-sm btn-outline-secondary" disabled title="No deposit receipt">🏦</button>`;

      // Show recipient based on transaction type
      const recipientDisplay =
        payment.transaction_type === "manager_to_owner"
          ? escapeHtml(payment.owner_name || "—")
          : "—";

      return `
        <tr>
          <td><strong>${escapeHtml(payment.invoice_number)}</strong></td>
          <td>${escapeHtml(payment.property_address || "—")}</td>
          <td>${escapeHtml(payment.tenant_name || "—")}</td>
          <td>${escapeHtml(payment.invoice_type || "—")}</td>
          <td class="text-end">${amountPaid}</td>
          <td>${paymentDate}</td>
          <td>${recipientDisplay}</td>
          <td class="text-end">${balanceCurrency}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              ${checkStubButton}
              ${depositReceiptButton}
              <button class="btn btn-sm btn-danger delete-btn" data-id="${payment.id}" title="Delete Payment">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Add event listeners for download check stub buttons
  tbody.querySelectorAll(".download-check-stub-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const paymentId = parseInt(e.currentTarget.dataset.id);
      downloadCheckStub(paymentId);
    });
  });

  // Add event listeners for download deposit receipt buttons
  tbody.querySelectorAll(".download-deposit-receipt-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const paymentId = parseInt(e.currentTarget.dataset.id);
      downloadDepositReceipt(paymentId);
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

function updateSummary() {
  // Calculate total payments
  const totalPaid = payments.reduce(
    (sum, p) => sum + parseFloat(p.amount_paid),
    0,
  );

  // Calculate outstanding balance by invoice
  const invoiceTotals = {};
  payments.forEach((p) => {
    if (!invoiceTotals[p.invoice_id]) {
      invoiceTotals[p.invoice_id] = {
        invoiceAmount: parseFloat(p.invoice_amount),
        totalPaid: 0,
      };
    }
    invoiceTotals[p.invoice_id].totalPaid += parseFloat(p.amount_paid);
  });

  // Add unpaid invoices
  invoices.forEach((inv) => {
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

async function downloadCheckStub(paymentId) {
  try {
    await downloadAttachment(
      `${paymentsUrl}/${paymentId}/check-stub`,
      "check-stub",
    );
  } catch (error) {
    console.error("Error downloading check stub:", error);
    alert(`Error: ${error.message}`);
  }
}

async function downloadDepositReceipt(paymentId) {
  try {
    await downloadAttachment(
      `${paymentsUrl}/${paymentId}/deposit-receipt`,
      "deposit-receipt",
    );
  } catch (error) {
    console.error("Error downloading deposit receipt:", error);
    alert(`Error: ${error.message}`);
  }
}
