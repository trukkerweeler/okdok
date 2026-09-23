import { getApiUrl, loadHeaderFooter } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const expensesUrl = `${apiUrl}/accounting/expenses/owner`;
const propertiesUrl = `${apiUrl}/accounting/properties`;
const vendorsUrl = `${apiUrl}/accounting/vendors`;

let expenses = [];
let properties = [];
let vendors = [];
let submitting = false;

initialize();

async function initialize() {
  setTodayDate();
  setupListeners();
  try {
    const [propertiesResponse, vendorsResponse] = await Promise.all([
      fetch(propertiesUrl, { credentials: "include" }),
      fetch(vendorsUrl, { credentials: "include" }),
    ]);
    if (!propertiesResponse.ok || !vendorsResponse.ok) throw new Error("Could not load properties and vendors");
    properties = await propertiesResponse.json();
    vendors = await vendorsResponse.json();
    populateProperties();
    populateVendors();
    await loadExpenses();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function setupListeners() {
  document.getElementById("expenseForm").addEventListener("submit", submitExpense);
  document.getElementById("refreshBtn").addEventListener("click", loadExpenses);
  document.getElementById("propertyFilter").addEventListener("change", render);
  document.getElementById("statusFilter").addEventListener("change", render);
}

function populateProperties() {
  const options = properties.map((property) => `<option value="${property.id}">${escapeHtml(property.address)}</option>`).join("");
  document.getElementById("property").insertAdjacentHTML("beforeend", options);
  document.getElementById("propertyFilter").insertAdjacentHTML("beforeend", properties.map((property) => `<option value="${property.id}">${escapeHtml(property.address)}</option>`).join(""));
}

function populateVendors() {
  document.getElementById("vendor").insertAdjacentHTML("beforeend", vendors.map((vendor) => `<option value="${vendor.id}">${escapeHtml(vendor.name)}</option>`).join(""));
}

async function loadExpenses() {
  const response = await fetch(expensesUrl, { credentials: "include" });
  if (!response.ok) throw new Error("Could not load landlord expenses");
  expenses = await response.json();
  render();
}

async function submitExpense(event) {
  event.preventDefault();
  if (submitting) return;

  const propertyId = Number.parseInt(document.getElementById("property").value, 10);
  const property = properties.find((item) => item.id === propertyId);
  const amount = Number.parseFloat(document.getElementById("amount").value);
  const vendorId = Number.parseInt(document.getElementById("vendor").value, 10);
  const memo = document.getElementById("memo").value.trim();
  const date = document.getElementById("date").value;

  if (!property || !Number.isFinite(amount) || amount <= 0 || !vendorId || !memo || !date) {
    showMessage("Property, amount, description, vendor, and date are required", "error");
    return;
  }

  submitting = true;
  try {
    const response = await fetch(expensesUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        amount: Math.round(amount * 100) / 100,
        owner_id: property.owner_id,
        property_id: propertyId,
        vendor_id: vendorId,
        memo,
        date,
      }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Could not record landlord expense");
    }
    document.getElementById("expenseForm").reset();
    setTodayDate();
    showMessage("Landlord expense recorded", "success");
    await loadExpenses();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submitting = false;
  }
}

function render() {
  const propertyFilter = document.getElementById("propertyFilter").value;
  const statusFilter = document.getElementById("statusFilter").value;
  const filtered = expenses.filter((expense) => {
    const matchesProperty = !propertyFilter || String(expense.property_id) === propertyFilter;
    const status = expense.reimbursement_status || "unreimbursed";
    return matchesProperty && (!statusFilter || status === statusFilter);
  });

  const pending = expenses.filter((expense) => !expense.reimbursement_status || expense.reimbursement_status === "unreimbursed");
  const reimbursed = expenses.filter((expense) => expense.reimbursement_status === "reimbursed");
  setText("pendingTotal", formatMoney(sum(pending)));
  setText("reimbursedTotal", formatMoney(sum(reimbursed)));
  setText("allTotal", formatMoney(sum(expenses)));

  const log = document.getElementById("expenseLog");
  if (filtered.length === 0) {
    log.innerHTML = '<div class="empty-state">No landlord expenses match this filter.</div>';
    return;
  }
  log.innerHTML = filtered.map((expense) => {
    const status = expense.reimbursement_status === "reimbursed" ? "reimbursed" : "unreimbursed";
    return `<div class="expense-row">
      <div class="expense-date">${formatDate(expense.date)}</div>
      <div class="expense-amount">${formatMoney(expense.amount)}</div>
      <div class="expense-description" title="${escapeHtml(expense.memo || "")}">${escapeHtml(expense.memo || "")}${expense.vendor_name ? ` <span class="text-muted">(${escapeHtml(expense.vendor_name)})</span>` : ""}</div>
      <div class="expense-property" title="${escapeHtml(expense.property_address || "")}">${escapeHtml(expense.property_address || "-")}</div>
      <div><span class="status ${status === "reimbursed" ? "status-reimbursed" : "status-pending"}">${status === "reimbursed" ? "Reimbursed" : "Pending"}</span></div>
    </div>`;
  }).join("");
}

function sum(items) { return items.reduce((total, item) => total + Number.parseFloat(item.amount || 0), 0); }
function formatMoney(amount) { return `$${amount.toFixed(2)}`; }
function formatDate(value) { return new Date(value).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }); }
function setTodayDate() { document.getElementById("date").value = new Date().toISOString().slice(0, 10); }
function setText(id, value) { document.getElementById(id).textContent = value; }
function showMessage(text, type) { const container = document.getElementById("messageContainer"); container.innerHTML = `<div class="alert alert-${type === "error" ? "danger" : "success"} py-2 small">${escapeHtml(text)}</div>`; setTimeout(() => { container.innerHTML = ""; }, 4000); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }