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
  const amountInput = document.getElementById("paymentAmount");

  if (!invoiceSelect || !balanceDisplay) return;

  const invoiceId = invoiceSelect.value;
  balanceDisplay.value = "";
  balanceDisplay.classList.remove("balance-zero", "balance-pending");
  if (amountInput) amountInput.max = "";

  if (invoiceId) {
    try {
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

  try {
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
      const invoiceAmount = formatCurrency(payment.invoice_amount);
      const paymentDate = formatDate(payment.payment_date);

      const invoiceData = paymentsByInvoice[payment.invoice_id];
      const balance = parseFloat(payment.invoice_amount) - invoiceData.total;
      const balanceCurrency = formatCurrency(Math.max(0, balance));

      return `
        <tr>
          <td><strong>${escapeHtml(payment.invoice_number)}</strong></td>
          <td>${escapeHtml(payment.owner_name || "—")}</td>
          <td class="text-end">${invoiceAmount}</td>
          <td class="text-end">${amountPaid}</td>
          <td>${paymentDate}</td>
          <td>${escapeHtml(payment.payment_method || "—")}</td>
          <td>${escapeHtml(payment.reference_number || "—")}</td>
          <td class="text-end">${balanceCurrency}</td>
          <td>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${payment.id}" title="Delete Payment">🗑️</button>
          </td>
        </tr>
      `;
    })
    .join("");

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
