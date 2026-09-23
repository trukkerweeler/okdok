import { loadHeaderFooter, getApiUrl } from "./utils.mjs";

loadHeaderFooter();
const apiUrl = await getApiUrl();
const tenantsUrl = `${apiUrl}/accounting/tenants`;
const reportUrl = `${apiUrl}/accounting/payments/tenant-report`;

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});
let today;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeReport);
} else {
  initializeReport();
}

async function initializeReport() {
  today = new Date();
  setPreviousMonth();
  document
    .getElementById("generateReportBtn")
    .addEventListener("click", generateReport);
  document
    .getElementById("includeThroughToday")
    .addEventListener("change", generateReport);
  document
    .getElementById("printReportBtn")
    .addEventListener("click", () => window.print());

  const response = await fetch(tenantsUrl, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load tenants");
  const tenants = await response.json();
  const select = document.getElementById("reportTenant");
  tenants.sort((left, right) => left.name.localeCompare(right.name));
  tenants.forEach((tenant) => {
    const option = document.createElement("option");
    option.value = tenant.id;
    option.textContent = tenant.name;
    select.appendChild(option);
  });
}

function setPreviousMonth() {
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  document.getElementById("reportMonth").value =
    `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
}

function getDateRange() {
  const [year, month] = document
    .getElementById("reportMonth")
    .value.split("-")
    .map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month, 0);
  const dueEnd = `${year}-${String(month).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
  const paymentEnd = document.getElementById("includeThroughToday").checked
    ? today.toISOString().split("T")[0]
    : dueEnd;
  return { start, dueEnd, paymentEnd };
}

async function generateReport() {
  const tenantId = document.getElementById("reportTenant").value;
  const month = document.getElementById("reportMonth").value;
  if (!tenantId || !month) return;

  const { start, dueEnd, paymentEnd } = getDateRange();
  const params = new URLSearchParams({
    tenant_id: tenantId,
    start_date: start,
    due_end_date: dueEnd,
    end_date: paymentEnd,
  });
  const response = await fetch(`${reportUrl}?${params}`, {
    credentials: "include",
  });
  if (!response.ok) {
    document.getElementById("reportTitle").textContent =
      "Unable to generate report";
    return;
  }

  const report = await response.json();
  document.getElementById("reportTitle").textContent =
    `${report.tenant.name} - Payment Summary`;
  document.getElementById("reportPeriod").textContent =
    `Invoices due: ${formatMonth(start)}${document.getElementById("includeThroughToday").checked ? ` (receipts through ${formatDate(paymentEnd)})` : " (receipts received by month end)"}`;
  document.getElementById("tenantDetails").textContent = [
    report.tenant.email,
    report.tenant.phone,
  ]
    .filter(Boolean)
    .join(" | ");
  renderPayments(report.payments);
}

function renderPayments(payments) {
  const body = document.getElementById("reportTableBody");
  const totalDue = payments.reduce(
    (sum, payment) => sum + Number(payment.amount_due || 0),
    0,
  );
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount_paid || 0),
    0,
  );
  const totalBalance = payments.reduce(
    (sum, payment) => sum + Number(payment.balance_due || 0),
    0,
  );
  body.innerHTML = payments.length
    ? payments
        .map(
          (payment) =>
            `<tr><td>${formatDate(payment.due_date)}</td><td>${escapeHtml(payment.invoice_number || "-")}</td><td>${escapeHtml(payment.invoice_type || "-")}</td><td>${formatDate(payment.payment_date)}</td><td>${escapeHtml(payment.property_address || "-")}</td><td>${escapeHtml(payment.payment_method || "-")}</td><td>${escapeHtml(payment.reference_number || "-")}</td><td class="amount">${currency.format(Number(payment.amount_due || 0))}</td><td class="amount">${currency.format(Number(payment.amount_paid || 0))}</td><td class="amount">${currency.format(Number(payment.balance_due || 0))}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="10" class="text-center text-muted py-4">No invoices found for this period.</td></tr>';
  document.getElementById("reportAmountDue").textContent =
    currency.format(totalDue);
  document.getElementById("reportTotal").textContent =
    currency.format(totalPaid);
  document.getElementById("reportBalance").textContent =
    currency.format(totalBalance);
  document
    .getElementById("reportBalance")
    .classList.toggle("text-danger", totalBalance > 0);
  document.getElementById("reportNote").textContent = document.getElementById(
    "includeThroughToday",
  ).checked
    ? "This report includes payments for invoices due in the selected month, including receipts received through today."
    : "This report includes payments for invoices due in the selected month, with receipts received by month end.";
}

function formatDate(value) {
  if (!value) return "-";

  const valueText = String(value);
  const dateOnly = valueText.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = dateOnly
    ? new Date(`${dateOnly}T00:00:00`)
    : new Date(valueText);

  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function formatMonth(value) {
  if (!value) return "-";

  const dateOnly = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!dateOnly) return "-";

  const date = new Date(`${dateOnly}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
