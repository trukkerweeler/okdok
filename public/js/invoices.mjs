import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const invoicesUrl = `${apiUrl}/accounting/invoices`;
const ownersUrl = `${apiUrl}/accounting/owners`;
const propertiesUrl = `${apiUrl}/accounting/properties`;
const tenantsUrl = `${apiUrl}/accounting/tenants`;
const leasesUrl = `${apiUrl}/accounting/leases`;

let user;
let owners = [];
let properties = [];
let tenants = [];
let leases = [];
let invoices = [];

// Initialize handler function
async function initializeInvoices() {
  console.debug("[invoices.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadReferenceData();
  await loadInvoicesData();
  setDefaultDate();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeInvoices);
} else {
  initializeInvoices();
}

function setupEventListeners() {
  // Add Invoice button
  const addInvoiceBtn = document.getElementById("addInvoiceBtn");
  if (addInvoiceBtn) {
    addInvoiceBtn.addEventListener("click", openAddInvoiceDialog);
  }

  // Close button for add invoice dialog
  const closeAddBtn = document.getElementById("closeAddInvoiceBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addInvoiceDialog").close();
    });
  }

  // Save invoice form
  const addInvoiceForm = document.getElementById("addInvoiceForm");
  if (addInvoiceForm) {
    addInvoiceForm.addEventListener("submit", saveInvoice);
  }

  // Close dialog on outside click
  const addInvoiceDialog = document.getElementById("addInvoiceDialog");
  if (addInvoiceDialog) {
    addInvoiceDialog.addEventListener("click", (e) => {
      if (e.target === addInvoiceDialog) {
        addInvoiceDialog.close();
      }
    });
  }

  // Lease dropdown change - update property and tenants
  const leaseSelect = document.getElementById("invoiceLease");
  if (leaseSelect) {
    leaseSelect.addEventListener("change", updateFieldsForLease);
  }

  // Owner dropdown change - update properties
  const ownerSelect = document.getElementById("invoiceOwner");
  if (ownerSelect) {
    ownerSelect.addEventListener("change", updatePropertiesForOwner);
  }

  // Print dialog
  const closePrintDialog = document.getElementById("closePrintDialog");
  if (closePrintDialog) {
    closePrintDialog.addEventListener("click", () => {
      document.getElementById("printInvoiceDialog").close();
    });
  }

  const closeAfterPrintBtn = document.getElementById("closeAfterPrintBtn");
  if (closeAfterPrintBtn) {
    closeAfterPrintBtn.addEventListener("click", () => {
      document.getElementById("printInvoiceDialog").close();
    });
  }

  const printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", printInvoice);
  }

  const printInvoiceDialog = document.getElementById("printInvoiceDialog");
  if (printInvoiceDialog) {
    printInvoiceDialog.addEventListener("click", (e) => {
      if (e.target === printInvoiceDialog) {
        printInvoiceDialog.close();
      }
    });
  }
}

async function loadReferenceData() {
  try {
    // Load owners
    const ownersResponse = await fetch(ownersUrl, {
      credentials: "include",
    });
    if (ownersResponse.ok) {
      owners = await ownersResponse.json();
      populateOwnerDropdown();
    }

    // Load properties
    const propertiesResponse = await fetch(propertiesUrl, {
      credentials: "include",
    });
    if (propertiesResponse.ok) {
      properties = await propertiesResponse.json();
    }

    // Load tenants
    const tenantsResponse = await fetch(tenantsUrl, {
      credentials: "include",
    });
    if (tenantsResponse.ok) {
      tenants = await tenantsResponse.json();
    }

    // Load leases
    const leasesResponse = await fetch(leasesUrl, {
      credentials: "include",
    });
    if (leasesResponse.ok) {
      leases = await leasesResponse.json();
      populateLeaseDropdown();
    }
  } catch (error) {
    console.error("Error loading reference data:", error);
  }
}

function populateOwnerDropdown() {
  const select = document.getElementById("invoiceOwner");
  if (!select) return;

  select.innerHTML = '<option value="">Select an owner...</option>';
  owners.forEach((owner) => {
    const option = document.createElement("option");
    option.value = owner.id;
    option.textContent = owner.name;
    select.appendChild(option);
  });
}

function populateLeaseDropdown() {
  const select = document.getElementById("invoiceLease");
  if (!select) return;

  select.innerHTML = '<option value="">Select a lease...</option>';
  leases.forEach((lease) => {
    const property = properties.find((p) => p.id === lease.property_id);
    const propertyAddress = property ? property.address : "Unknown";
    const option = document.createElement("option");
    option.value = lease.id;
    option.textContent = `${lease.lease_number} - ${propertyAddress}`;
    option.dataset.leaseId = lease.id;
    select.appendChild(option);
  });
}

async function updateFieldsForLease() {
  const leaseSelect = document.getElementById("invoiceLease");
  const ownerSelect = document.getElementById("invoiceOwner");
  const propertySelect = document.getElementById("invoiceProperty");
  const tenantSelect = document.getElementById("invoiceTenant");

  if (!leaseSelect || !ownerSelect || !propertySelect || !tenantSelect) return;

  const leaseId = leaseSelect.value;

  if (!leaseId) {
    // Clear all fields if no lease selected
    ownerSelect.value = "";
    propertySelect.innerHTML =
      '<option value="">Select a property (optional)...</option>';
    tenantSelect.innerHTML =
      '<option value="">Select a tenant (optional)...</option>';
    return;
  }

  // Find the selected lease
  const selectedLease = leases.find((l) => l.id == leaseId);
  if (!selectedLease) return;

  // Get property details
  const property = properties.find((p) => p.id === selectedLease.property_id);
  if (property) {
    ownerSelect.value = property.owner_id;

    // Update property dropdown
    updatePropertiesForOwner();

    // Set selected property
    propertySelect.value = selectedLease.property_id;

    // Fetch and populate tenants for this lease
    try {
      const response = await fetch(`${leasesUrl}/${leaseId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const leaseData = await response.json();
        if (leaseData.tenants && leaseData.tenants.length > 0) {
          // Populate tenant dropdown with lease tenants
          tenantSelect.innerHTML = "";
          leaseData.tenants.forEach((tenant) => {
            const option = document.createElement("option");
            option.value = tenant.id;
            option.textContent = tenant.name;
            if (tenant.is_primary) {
              option.textContent += " (Primary)";
            }
            tenantSelect.appendChild(option);
          });
          // Select the primary tenant if available
          const primaryTenant = leaseData.tenants.find((t) => t.is_primary);
          if (primaryTenant) {
            tenantSelect.value = primaryTenant.id;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching lease details:", error);
    }
  }
}

function updatePropertiesForOwner() {
  const ownerSelect = document.getElementById("invoiceOwner");
  const propertySelect = document.getElementById("invoiceProperty");

  if (!ownerSelect || !propertySelect) return;

  const ownerId = ownerSelect.value;
  propertySelect.innerHTML =
    '<option value="">Select a property (optional)...</option>';

  if (ownerId) {
    const ownerProperties = properties.filter((p) => p.owner_id == ownerId);
    ownerProperties.forEach((prop) => {
      const option = document.createElement("option");
      option.value = prop.id;
      option.textContent = `${prop.address}, ${prop.city}, ${prop.state}`;
      propertySelect.appendChild(option);
    });
  }

  // Clear tenant dropdown
  const tenantSelect = document.getElementById("invoiceTenant");
  if (tenantSelect) {
    tenantSelect.innerHTML =
      '<option value="">Select a tenant (optional)...</option>';
  }
}

function setDefaultDate() {
  const dateInput = document.getElementById("invoiceDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
}

async function openAddInvoiceDialog() {
  const dialog = document.getElementById("addInvoiceDialog");
  if (dialog) {
    const form = document.getElementById("addInvoiceForm");
    form.reset();
    setDefaultDate();

    // Set default invoice number
    const nextNumber = await getNextInvoiceNumber();
    const invoiceNumberInput = document.getElementById("invoiceNumber");
    if (invoiceNumberInput) {
      invoiceNumberInput.value = nextNumber;
    }

    // Set default description
    const descriptionInput = document.getElementById("invoiceDescription");
    if (descriptionInput) {
      descriptionInput.value = "Deposit + First Month Rent";
    }

    // Set default status
    const statusSelect = document.getElementById("invoiceStatus");
    if (statusSelect) {
      statusSelect.value = "pending";
    }

    dialog.showModal();
  }
}

async function getNextInvoiceNumber() {
  // Generate invoice number in format YY-XXX (starts at 101 per year)
  const currentYear = new Date().getFullYear();
  const twoDigitYear = String(currentYear).slice(-2);

  // Count invoices for current year only
  const currentYearInvoices = invoices.filter(
    (i) => new Date(i.created_at).getFullYear() === currentYear,
  ).length;

  // Start numbering at 101, increment from there
  const sequenceNumber = 101 + currentYearInvoices;
  return `${twoDigitYear}-${String(sequenceNumber).padStart(3, "0")}`;
}

async function saveInvoice(event) {
  event.preventDefault();
  const form = document.getElementById("addInvoiceForm");
  const formData = new FormData(form);

  try {
    const dataJson = {
      lease_id: formData.get("lease_id")
        ? parseInt(formData.get("lease_id"))
        : null,
      owner_id: parseInt(formData.get("owner_id")),
      property_id: formData.get("property_id")
        ? parseInt(formData.get("property_id"))
        : null,
      invoice_number: formData.get("invoice_number"),
      amount: parseFloat(formData.get("amount")),
      invoice_date: formData.get("invoice_date"),
      due_date: formData.get("due_date") || null,
      description: formData.get("description"),
      status: formData.get("status"),
      notes: formData.get("notes") || null,
    };

    const response = await fetch(invoicesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to save invoice"}`);
      return;
    }

    const newInvoice = await response.json();
    console.log("Invoice saved:", newInvoice);

    // Close dialog and refresh list
    document.getElementById("addInvoiceDialog").close();
    await loadInvoicesData();
  } catch (error) {
    console.error("Error saving invoice:", error);
    alert(`Error: ${error.message}`);
  }
}

async function loadInvoicesData() {
  try {
    const response = await fetch(invoicesUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch invoices");
    }

    invoices = await response.json();

    // Fetch lease/tenant data for each invoice
    for (let i = 0; i < invoices.length; i++) {
      if (invoices[i].lease_id && !invoices[i].tenant_name) {
        try {
          const leaseResponse = await fetch(
            `${apiUrl}/accounting/leases/${invoices[i].lease_id}`,
            { credentials: "include" },
          );
          if (leaseResponse.ok) {
            const leaseData = await leaseResponse.json();
            // Get first tenant name from the lease
            if (leaseData.tenants && leaseData.tenants.length > 0) {
              invoices[i].tenant_name = leaseData.tenants[0].name;
            }
          }
        } catch (error) {
          console.warn(`Could not fetch lease ${invoices[i].lease_id}:`, error);
        }
      }
    }

    console.debug("Invoices loaded:", invoices);
    displayInvoices();
  } catch (error) {
    console.error("Error loading invoices:", error);
    alert(`Error loading invoices: ${error.message}`);
  }
}

function displayInvoices() {
  const tbody = document.getElementById("invoicesTableBody");
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="text-center text-muted py-4">No invoices found. Click + to create one.</td></tr>';
    return;
  }

  // Create a map of property addresses to colors for consistent shading
  const addressColorMap = {};
  const colors = [
    "invoice-shade-1", // Light blue
    "invoice-shade-2", // Light green
    "invoice-shade-3", // Light orange
    "invoice-shade-4", // Light pink
    "invoice-shade-5", // Light lavender
  ];
  let colorIndex = 0;

  invoices.forEach((invoice) => {
    const address = invoice.property_address || "—";
    if (!addressColorMap[address]) {
      addressColorMap[address] = colors[colorIndex % colors.length];
      colorIndex++;
    }
  });

  tbody.innerHTML = invoices
    .map((invoice) => {
      const statusBadgeClass = getStatusBadgeClass(invoice.status);
      const invoiceDate = formatDate(invoice.invoice_date);
      const dueDate = invoice.due_date ? formatDate(invoice.due_date) : "—";
      const address = invoice.property_address || "—";
      const shadeClass = addressColorMap[address];

      const totalPaid = parseFloat(invoice.total_paid) || 0;
      const invoiceAmount = parseFloat(invoice.amount) || 0;
      const remaining = invoiceAmount - totalPaid;
      const isPartial = totalPaid > 0 && remaining > 0.005;

      const amountCell = isPartial
        ? `<div>${formatCurrency(invoiceAmount)}</div>
           <div style="font-size:0.8em;color:#666;">paid ${formatCurrency(totalPaid)}</div>`
        : formatCurrency(invoice.amount);

      const partialBadge = isPartial
        ? `<span class="badge bg-warning text-dark ms-1">Partial</span>`
        : "";

      return `
        <tr class="${shadeClass}${isPartial ? " table-warning" : ""}">
          <td><strong>${escapeHtml(invoice.invoice_number)}</strong></td>
          <td>${escapeHtml(invoice.tenant_name || "—")}</td>
          <td>${
            invoice.property_address
              ? `${escapeHtml(invoice.property_address)}`
              : "—"
          }</td>
          <td>${escapeHtml(invoice.lease_number || "—")}</td>
          <td class="text-end">${amountCell}</td>
          <td>${invoiceDate}</td>
          <td>${dueDate}</td>
          <td><span class="badge ${statusBadgeClass}">${escapeHtml(invoice.status)}</span>${partialBadge}</td>
          <td>
            <button class="btn btn-sm btn-info print-btn" data-id="${invoice.id}" title="Print Invoice">🖨️</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${invoice.id}" title="Delete Invoice">🗑️</button>
          </td>
        </tr>
      `;
    })
    .join("");

  // Add event listeners for action buttons
  tbody.querySelectorAll(".print-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const invoiceId = parseInt(e.target.dataset.id);
      showPrintDialog(invoiceId);
    });
  });

  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const invoiceId = parseInt(e.target.dataset.id);
      deleteInvoice(invoiceId);
    });
  });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "paid":
      return "bg-success";
    case "sent":
      return "bg-info";
    case "pending":
      return "bg-warning";
    case "cancelled":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
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

async function showPrintDialog(invoiceId) {
  try {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      alert("Invoice not found");
      return;
    }

    // If invoice has a lease_id, fetch all tenants for that lease
    if (invoice.lease_id) {
      try {
        const leaseResponse = await fetch(
          `/accounting/leases/${invoice.lease_id}`,
        );
        if (leaseResponse.ok) {
          const leaseData = await leaseResponse.json();
          invoice.lease_tenants = leaseData.tenants || [];
        }
      } catch (error) {
        console.warn("Could not fetch lease tenants:", error);
      }
    }

    // Fetch company settings
    let settings = {};
    try {
      const settingsResponse = await fetch("/accounting/company-settings");
      if (settingsResponse.ok) {
        settings = await settingsResponse.json();
      }
    } catch (error) {
      console.warn("Could not fetch company settings:", error);
    }

    const printContent = document.getElementById("printContent");
    if (printContent) {
      printContent.innerHTML = generateInvoiceHTML(invoice, settings);
      document.getElementById("printInvoiceDialog").showModal();
    }
  } catch (error) {
    console.error("Error showing print dialog:", error);
    alert(`Error: ${error.message}`);
  }
}

function generateInvoiceHTML(invoice, settings = {}) {
  const invoiceDate = formatDate(invoice.invoice_date);
  const dueDate = invoice.due_date
    ? formatDate(invoice.due_date)
    : "Not specified";
  const amount = formatCurrency(invoice.amount);

  // Get settings with defaults
  const companyName = settings.company_name || "OKPM LLC";
  const contactName = settings.invoice_contact_name || "Tim Kent";
  const contactPhone = settings.invoice_contact_phone || "801-367-6587";
  const contactEmail = settings.invoice_contact_email || "";
  const companyAddress = settings.company_address || "149 S Canyon View Drive";
  const companyCity = settings.company_city || "Elk Ridge";
  const companyState = settings.company_state || "UT";
  const companyZip = settings.company_zip || "84651";

  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #007bff;">INVOICE</h1>
          <p style="margin: 5px 0; color: #333; font-weight: bold;">${escapeHtml(companyName)}</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">${escapeHtml(companyAddress)}, ${escapeHtml(companyCity)}, ${escapeHtml(companyState)} ${escapeHtml(companyZip)}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: bold;">Invoice #: ${escapeHtml(invoice.invoice_number)}</p>
          <p style="margin: 5px 0;">Date: ${invoiceDate}</p>
          <p style="margin: 5px 0;">Due: ${dueDate}</p>
        </div>
      </div>

      <!-- Bill To / From -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;">
        <div>
          <h3 style="margin: 0 0 10px 0; color: #007bff; font-size: 14px; text-transform: uppercase;">Contact:</h3>
          <p style="margin: 0 0 5px 0;"><strong>${escapeHtml(contactName)}</strong></p>
          <p style="margin: 0 0 5px 0;">Phone: ${escapeHtml(contactPhone)}</p>
          ${contactEmail ? `<p style="margin: 0 0 5px 0;">Email: ${escapeHtml(contactEmail)}</p>` : ""}
        </div>
        <div>
          <h3 style="margin: 0 0 10px 0; color: #007bff; font-size: 14px; text-transform: uppercase;">Bill To:</h3>
          ${
            invoice.lease_tenants && invoice.lease_tenants.length > 0
              ? `
            <p style="margin: 0 0 5px 0;"><strong>Tenants:</strong></p>
            ${invoice.lease_tenants
              .map(
                (tenant) =>
                  `<p style="margin: 0 0 3px 0;">• ${escapeHtml(tenant.name)}</p>`,
              )
              .join("")}
          `
              : `<p style="margin: 0 0 5px 0;"><strong>${escapeHtml(invoice.tenant_name || "")}</strong></p>`
          }
          ${
            invoice.property_address
              ? `<p style="margin: 10px 0 5px 0;"><strong>Property:</strong></p>
                 <p style="margin: 0 0 5px 0;">${escapeHtml(invoice.property_address)}</p>
                 <p style="margin: 0 0 5px 0;">${escapeHtml(invoice.property_city)}, ${escapeHtml(invoice.property_state)} ${escapeHtml(invoice.property_zip)}</p>`
              : ""
          }
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f0f0f0; border-bottom: 2px solid #007bff;">
            <th style="padding: 12px; text-align: left; font-weight: bold;">Description</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px; text-align: left;">${escapeHtml(invoice.description)}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold;">${amount}</td>
          </tr>
        </tbody>
      </table>

      <!-- Total -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 300px;">
          <div style="display: flex; justify-content: space-between; padding: 10px; border-top: 2px solid #007bff; border-bottom: 2px solid #007bff; font-size: 18px; font-weight: bold; color: #007bff;">
            <span>TOTAL DUE:</span>
            <span>${amount}</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      ${
        invoice.notes
          ? `
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #007bff;">Notes:</h4>
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(invoice.notes)}</p>
        </div>
      `
          : ""
      }

      <!-- Footer -->
      <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p>Thank you for your business!</p>
        <p>Please make payment within the due date to avoid late fees.</p>
      </div>
    </div>
  `;
}

function printInvoice() {
  const printContent = document.getElementById("printContent").innerHTML;
  const printWindow = window.open("", "", "height=800,width=800");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice Print</title>
      <style>
        body { margin: 20px; }
        @media print {
          body { margin: 0; }
          #noprint { display: none; }
        }
      </style>
    </head>
    <body>
      ${printContent}
      <div id="noprint" style="margin-top: 20px; text-align: center;">
        <p><em>This window will close after printing</em></p>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

async function deleteInvoice(invoiceId) {
  if (!confirm("Are you sure you want to delete this invoice?")) {
    return;
  }

  try {
    const response = await fetch(`${invoicesUrl}/${invoiceId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete invoice");
    }

    await loadInvoicesData();
  } catch (error) {
    console.error("Error deleting invoice:", error);
    alert(`Error: ${error.message}`);
  }
}
