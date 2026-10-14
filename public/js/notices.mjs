import { loadHeaderFooter } from "./utils.mjs";

const tenantsUrl = "/accounting/tenants";
const propertiesUrl = "/accounting/properties";
const noticesUrl = "/notices";

let tenants = [];
let properties = [];

loadHeaderFooter();
initializeNotices();

async function initializeNotices() {
  setDefaultDate();
  setupEventListeners();
  await Promise.all([loadReferenceData(), loadSavedNotices()]);
  updatePreview();
}

function setupEventListeners() {
  document
    .getElementById("noticeForm")
    ?.addEventListener("input", updatePreview);
  document
    .getElementById("noticeForm")
    ?.addEventListener("change", updatePreview);
  document
    .getElementById("noticeForm")
    ?.addEventListener("submit", saveNotice);
  document
    .getElementById("noticeTenant")
    ?.addEventListener("change", updatePropertyForTenant);
  document
    .getElementById("printNoticeBtn")
    ?.addEventListener("click", printNotice);
}

async function loadReferenceData() {
  try {
    const [tenantsResponse, propertiesResponse] = await Promise.all([
      fetch(tenantsUrl, { credentials: "include" }),
      fetch(propertiesUrl, { credentials: "include" }),
    ]);
    if (!tenantsResponse.ok || !propertiesResponse.ok) {
      throw new Error("Could not load tenants and properties");
    }

    tenants = await tenantsResponse.json();
    properties = await propertiesResponse.json();
    populateTenantDropdown();
    populatePropertyDropdown();
  } catch (error) {
    console.error("Error loading notice reference data:", error);
    showMessage("Could not load tenant and property lists.", "danger");
  }
}

function populateTenantDropdown() {
  const select = document.getElementById("noticeTenant");
  if (!select) return;

  select.innerHTML = '<option value="">Select a tenant (optional)</option>';
  tenants
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((tenant) => {
      const option = document.createElement("option");
      option.value = tenant.id;
      option.textContent = tenant.name;
      select.appendChild(option);
    });
}

function populatePropertyDropdown() {
  const select = document.getElementById("noticeProperty");
  if (!select) return;

  select.innerHTML = '<option value="">Select an address (optional)</option>';
  properties
    .slice()
    .sort((a, b) => a.address.localeCompare(b.address))
    .forEach((property) => {
      const option = document.createElement("option");
      option.value = property.id;
      option.textContent = formatPropertyAddress(property);
      select.appendChild(option);
    });
}

function updatePropertyForTenant() {
  const tenantId = document.getElementById("noticeTenant")?.value;
  const tenant = tenants.find((item) => String(item.id) === tenantId);
  const propertySelect = document.getElementById("noticeProperty");

  if (tenant?.property_id && propertySelect) {
    propertySelect.value = String(tenant.property_id);
  }
  updatePreview();
}

function setDefaultDate() {
  const dateInput = document.getElementById("noticeDate");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
}

function updatePreview() {
  const values = getFormValues();
  const preview = document.getElementById("noticePreview");
  if (!preview) return;

  const amount = Number.parseFloat(values.amount_owed);
  const amountText = Number.isFinite(amount) ? formatCurrency(amount) : "$__________";
  const dateText = formatDate(values.notice_date) || "______________________";
  const periodText = formatPeriod(values.rent_period_start, values.rent_period_end);
  const tenantName = values.tenant_name || "______________________";
  const propertyAddress = values.property_address || "______________________";

  preview.innerHTML = `
    <p><strong>Date:</strong> ${escapeHtml(dateText)}</p>
    <p><strong>To:</strong> ${escapeHtml(tenantName)}</p>
    <p>This is a <strong>3-Day Notice to Pay Rent or Vacate</strong>.</p>
    <p>You are hereby notified that you are in default for <strong>nonpayment of rent</strong> at the property located at:</p>
    <p><strong>${escapeHtml(propertyAddress)}</strong></p>
    <p class="notice-amount-heading"><strong>Amount Owed:</strong></p>
    <p class="notice-amount-intro">As of today, the total past-due rent owed is:</p>
    <p><strong>${escapeHtml(amountText)}</strong></p>
    <p>This amount represents unpaid rent for the period <strong>${escapeHtml(periodText)}</strong>, minus payments received.</p>
    <p>You must do <strong>ONE</strong> of the following within 3 calendar days:</p>
    <ol>
      <li><strong>Pay the full amount of ${escapeHtml(amountText)}</strong>, OR</li>
      <li><strong>Vacate and surrender possession of the property.</strong></li>
    </ol>
    <p>Payment must be made <strong>in full</strong>. Partial payments will <strong>not</strong> stop the eviction process.</p>
    <p>If you fail to pay the full amount or vacate within 3 calendar days after service of this notice, the landlord will file an <strong>Unlawful Detainer (eviction)</strong> action against you in court. You may be liable for:</p>
    <ul>
      <li>Court costs</li>
      <li>Attorney fees (if applicable)</li>
      <li>Treble damages as allowed by Utah law</li>
    </ul>
    <p><strong>Landlord / Agent Information:</strong></p>
    <p>Name: <strong>${escapeHtml(values.landlord_name)}</strong><br />Phone: ${escapeHtml(values.landlord_phone)}<br />Address: ${escapeHtml(values.landlord_address)}</p>
    <p>Signature: _______________________ Date: _________________________</p>
  `;
}

function getFormValues() {
  const form = document.getElementById("noticeForm");
  const formData = new FormData(form);
  const tenant = tenants.find((item) => String(item.id) === formData.get("tenant_id"));
  const property = properties.find((item) => String(item.id) === formData.get("property_id"));

  return {
    notice_type: "three_day_pay_or_vacate",
    notice_date: formData.get("notice_date"),
    tenant_id: formData.get("tenant_id") || null,
    property_id: formData.get("property_id") || null,
    tenant_name: tenant?.name || "",
    tenant_mailing_address: formData.get("tenant_mailing_address")?.trim() || "",
    property_address: property ? formatPropertyAddress(property) : "",
    amount_owed: formData.get("amount_owed"),
    rent_period_start: formData.get("rent_period_start") || null,
    rent_period_end: formData.get("rent_period_end") || null,
    landlord_name: formData.get("landlord_name")?.trim() || "",
    landlord_phone: formData.get("landlord_phone")?.trim() || "",
    landlord_address: formData.get("landlord_address")?.trim() || "",
  };
}

async function saveNotice(event) {
  event.preventDefault();
  const values = getFormValues();
  const preview = document.getElementById("noticePreview");
  const noticeId = document.getElementById("noticeId")?.value;

  try {
    const response = await fetch(noticeId ? `${noticesUrl}/${noticeId}` : noticesUrl, {
      method: noticeId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...values,
        status: "draft",
        content_snapshot: preview?.innerHTML || "",
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Could not save notice");
    }

    document.getElementById("noticeId").value = "";
    showMessage(noticeId ? "Notice updated successfully." : "Notice saved successfully.", "success");
    await loadSavedNotices();
  } catch (error) {
    console.error("Error saving notice:", error);
    showMessage(error.message, "danger");
  }
}

async function loadSavedNotices() {
  try {
    const response = await fetch(noticesUrl, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load saved notices");
    const notices = await response.json();
    const tbody = document.getElementById("savedNoticesBody");
    if (!tbody) return;

    tbody.innerHTML = notices.length
      ? notices.map((notice) => `
          <tr>
            <td>${escapeHtml(formatDate(notice.notice_date))}</td>
            <td>${escapeHtml(notice.tenant_name || "—")}</td>
            <td>${escapeHtml(notice.property_address || "—")}</td>
            <td>${escapeHtml(formatCurrency(notice.amount_owed))}</td>
            <td><span class="badge bg-secondary">${escapeHtml(notice.status || "draft")}</span></td>
            <td><button type="button" class="btn btn-sm btn-outline-primary load-notice-btn" data-id="${notice.id}">Load</button></td>
          </tr>
        `).join("")
      : '<tr><td colspan="6" class="text-muted">No notices saved yet.</td></tr>';

    tbody.querySelectorAll(".load-notice-btn").forEach((button) => {
      button.addEventListener("click", () => loadNotice(button.dataset.id));
    });
  } catch (error) {
    console.error("Error loading saved notices:", error);
    showMessage("Could not load saved notices.", "danger");
  }
}

async function loadNotice(noticeId) {
  try {
    const response = await fetch(`${noticesUrl}/${noticeId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Could not load notice");
    const notice = await response.json();

    document.getElementById("noticeId").value = notice.id;
    document.getElementById("noticeDate").value = toDateInputValue(notice.notice_date);
    document.getElementById("noticeTenant").value = notice.tenant_id || "";
    document.getElementById("noticeProperty").value = notice.property_id || "";
    document.getElementById("tenantMailingAddress").value = notice.tenant_mailing_address || "";
    document.getElementById("amountOwed").value = notice.amount_owed || "";
    document.getElementById("rentPeriodStart").value = toDateInputValue(notice.rent_period_start);
    document.getElementById("rentPeriodEnd").value = toDateInputValue(notice.rent_period_end);
    document.getElementById("landlordName").value = notice.landlord_name || "";
    document.getElementById("landlordPhone").value = notice.landlord_phone || "";
    document.getElementById("landlordAddress").value = notice.landlord_address || "";
    updatePreview();
    document.getElementById("noticeForm").scrollIntoView({ behavior: "smooth" });
    showMessage("Draft loaded.", "info");
  } catch (error) {
    console.error("Error loading notice:", error);
    showMessage(error.message, "danger");
  }
}

function printNotice() {
  updatePreview();
  window.print();
}

function formatPropertyAddress(property) {
  return [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(", ");
}

function formatPeriod(start, end) {
  if (!start && !end) return "____________________________";
  if (!start) return `through ${formatDate(end)}`;
  if (!end) return `${formatDate(start)} through ____________`;
  return `${formatDate(start)} through ${formatDate(end)}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function showMessage(message, type) {
  let element = document.getElementById("noticeMessage");
  if (!element) {
    element = document.createElement("div");
    element.id = "noticeMessage";
    document.querySelector("main")?.prepend(element);
  }
  element.className = `alert alert-${type}`;
  element.textContent = message;
}
