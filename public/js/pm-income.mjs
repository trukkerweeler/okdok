/**
 * PM Income Summary Page
 * Fetches and renders management fee income vs PM operating expenses.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// -----------------------------------------------
// State
// -----------------------------------------------
let currentStartDate = "";
let currentEndDate = "";
let summaryData = null;
let activeTab = "monthly";

// -----------------------------------------------
// Init
// -----------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates(new Date().getFullYear());
  setupTabs();
  setupFilterForm();
  loadSummary();
});

function setDefaultDates(year) {
  currentStartDate = `${year}-01-01`;
  currentEndDate = `${year}-12-31`;
  document.getElementById("startDate").value = currentStartDate;
  document.getElementById("endDate").value = currentEndDate;
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });
}

function setupFilterForm() {
  document.getElementById("filterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    currentStartDate = document.getElementById("startDate").value;
    currentEndDate = document.getElementById("endDate").value;
    loadSummary();
  });

  document.getElementById("btnCurrentYear").addEventListener("click", () => {
    setDefaultDates(new Date().getFullYear());
    loadSummary();
  });

  document.getElementById("btnLastYear").addEventListener("click", () => {
    setDefaultDates(new Date().getFullYear() - 1);
    loadSummary();
  });
}

// -----------------------------------------------
// Data loading
// -----------------------------------------------
async function loadSummary() {
  showLoading(true);
  hideError();

  try {
    const params = new URLSearchParams({
      start_date: currentStartDate,
      end_date: currentEndDate,
    });
    const res = await fetch(`/accounting/pm/income-summary?${params}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    summaryData = await res.json();
    render(summaryData);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// -----------------------------------------------
// Rendering
// -----------------------------------------------
function render(data) {
  renderMetrics(data.totals);
  renderMonthlyTab(data.monthly_breakdown);
  renderFeeTab(data.fee_entries);
  renderExpenseTab(data.expense_entries);
  renderMileageTab(data.mileage_entries || []);
  showTabContent(activeTab);
}

function renderMetrics(totals) {
  document.getElementById("metricFees").textContent = fmt(
    totals.management_fee_income,
  );
  document.getElementById("metricExpenses").textContent = fmt(
    totals.pm_operating_expenses,
  );
  document.getElementById("metricMileage").textContent = fmt(
    totals.mileage_expense || 0,
  );

  const netEl = document.getElementById("metricNet");
  netEl.textContent = fmt(totals.net_income);
  netEl.className =
    "metric-value " +
    (totals.net_income >= 0 ? "metric-net-positive" : "metric-net-negative");
}

function renderMonthlyTab(months) {
  const tbody = document.getElementById("monthlyBody");
  const tfoot = document.getElementById("monthlyFoot");
  tbody.innerHTML = "";
  tfoot.innerHTML = "";

  if (!months.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No data for the selected period.</td></tr>`;
    return;
  }

  let totFee = 0;
  let totExp = 0;
  let totMileage = 0;

  months.forEach((m) => {
    totFee += m.fee_income;
    totExp += m.pm_expenses;
    totMileage += m.mileage_expense || 0;
    const net = m.net;
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${MONTH_SHORT[m.month - 1]} ${m.year}</td>
      <td class="text-right text-mono text-green">${fmt(m.fee_income)}</td>
      <td class="text-right text-mono text-red">${fmt(m.pm_expenses)}</td>
      <td class="text-right text-mono text-red">${fmt(m.mileage_expense || 0)}</td>
      <td class="text-right text-mono" style="font-weight:700;color:${net >= 0 ? "#28a745" : "#dc3545"}">${fmt(net)}</td>
    `;
  });

  const totNet = totFee - totExp - totMileage;
  tfoot.innerHTML = `
    <tr>
      <td>TOTAL</td>
      <td class="text-right text-mono text-green">${fmt(totFee)}</td>
      <td class="text-right text-mono text-red">${fmt(totExp)}</td>
      <td class="text-right text-mono text-red">${fmt(totMileage)}</td>
      <td class="text-right text-mono" style="color:${totNet >= 0 ? "#28a745" : "#dc3545"}">${fmt(totNet)}</td>
    </tr>
  `;
}

function renderFeeTab(entries) {
  const tbody = document.getElementById("feeBody");
  tbody.innerHTML = "";

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No management fee income in the selected period.</td></tr>`;
    return;
  }

  entries.forEach((e) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td class="text-mono">${fmtDate(e.date)}</td>
      <td class="text-right text-mono text-green">${fmt(e.amount)}</td>
      <td>${e.owner_name || "<span class='text-muted'>—</span>"}</td>
      <td>${e.property_address || "<span class='text-muted'>—</span>"}</td>
      <td class="text-muted">${escHtml(e.memo || "")}</td>
    `;
  });
}

function renderExpenseTab(entries) {
  const tbody = document.getElementById("expenseBody");
  tbody.innerHTML = "";

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No PM operating expenses recorded in the ledger for the selected period.</td></tr>`;
    return;
  }

  entries.forEach((e) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td class="text-mono">${fmtDate(e.date)}</td>
      <td class="text-right text-mono text-red">${fmt(e.amount)}</td>
      <td>${e.vendor_name || "<span class='text-muted'>—</span>"}</td>
      <td class="text-muted">${escHtml(e.memo || "")}</td>
    `;
  });
}

function renderMileageTab(entries) {
  const tbody = document.getElementById("mileageBody");
  const tfoot = document.getElementById("mileageFoot");
  tbody.innerHTML = "";
  tfoot.innerHTML = "";

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No mileage entries in the selected period.</td></tr>`;
    return;
  }

  let totMiles = 0;
  let totValue = 0;

  entries.forEach((e) => {
    const miles = parseFloat(e.miles_driven) || 0;
    totMiles += miles;
    totValue += e.calculated_value || 0;
    const row = tbody.insertRow();
    const loc =
      e.starting_location && e.ending_location
        ? `${escHtml(e.starting_location)} → ${escHtml(e.ending_location)}`
        : escHtml(e.purpose || "");
    const propOwner = [e.owner_name, e.property_address]
      .filter(Boolean)
      .join(" / ");
    row.innerHTML = `
      <td class="text-mono">${fmtDate(e.date)}</td>
      <td class="text-right text-mono">${miles.toFixed(1)}</td>
      <td class="text-right text-mono text-muted">$${(e.rate_used || 0).toFixed(3)}</td>
      <td class="text-right text-mono text-red">${fmt(e.calculated_value || 0)}</td>
      <td class="text-muted" style="font-size:12px">${loc}</td>
      <td class="text-muted" style="font-size:12px">${propOwner || "—"}</td>
    `;
  });

  tfoot.innerHTML = `
    <tr>
      <td>TOTAL</td>
      <td class="text-right text-mono">${totMiles.toFixed(1)} mi</td>
      <td></td>
      <td class="text-right text-mono text-red">${fmt(totValue)}</td>
      <td colspan="2"></td>
    </tr>
  `;
}

// -----------------------------------------------
// Tab switching
// -----------------------------------------------
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  showTabContent(tab);
}

function showTabContent(tab) {
  document.getElementById("tabMonthly").style.display =
    tab === "monthly" ? "" : "none";
  document.getElementById("tabFees").style.display =
    tab === "fees" ? "" : "none";
  document.getElementById("tabExpenses").style.display =
    tab === "expenses" ? "" : "none";
  document.getElementById("tabMileage").style.display =
    tab === "mileage" ? "" : "none";
}

// -----------------------------------------------
// UI helpers
// -----------------------------------------------
function showLoading(visible) {
  document.getElementById("loadingState").style.display = visible ? "" : "none";
  if (visible) {
    document.getElementById("tabMonthly").style.display = "none";
    document.getElementById("tabFees").style.display = "none";
    document.getElementById("tabExpenses").style.display = "none";
    document.getElementById("tabMileage").style.display = "none";
  }
}

function showError(msg) {
  const el = document.getElementById("errorBanner");
  el.textContent = "Error: " + msg;
  el.style.display = "";
}

function hideError() {
  document.getElementById("errorBanner").style.display = "none";
}

function fmt(n) {
  const v = parseFloat(n) || 0;
  return "$" + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
