import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();

let accounts = [];
let owners = [];
let properties = [];
let vendors = [];
let journalEntries = [];
let isSubmitting = false;

async function init() {
  await getSessionUser();
  await loadData();
  setupForm();
  setTodayDate();
  await loadJournalEntries();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function loadData() {
  const [acctRes, ownersRes, propsRes, vendorsRes] = await Promise.all([
    fetch(`${apiUrl}/accounting/accounts`, { credentials: "include" }),
    fetch(`${apiUrl}/accounting/owners`, { credentials: "include" }),
    fetch(`${apiUrl}/accounting/properties`, { credentials: "include" }),
    fetch(`${apiUrl}/accounting/vendors`, { credentials: "include" }),
  ]);

  if (acctRes.ok) accounts = await acctRes.json();
  if (ownersRes.ok) owners = await ownersRes.json();
  if (propsRes.ok) properties = await propsRes.json();
  if (vendorsRes.ok) vendors = await vendorsRes.json();

  populateAccountDropdowns();
  populateOwnerDropdown();
  populatePropertyDropdown();
  populateVendorDropdown();
}

function populateAccountDropdowns() {
  const grouped = groupAccountsByType(accounts);

  [
    document.getElementById("debitAccount"),
    document.getElementById("creditAccount"),
  ].forEach((sel) => {
    sel.innerHTML = '<option value="">Select account...</option>';
    for (const [type, accts] of Object.entries(grouped)) {
      const group = document.createElement("optgroup");
      group.label = type.replace(/_/g, " ").toUpperCase();
      accts.forEach((a) => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        group.appendChild(opt);
      });
      sel.appendChild(group);
    }
  });
}

function groupAccountsByType(accts) {
  const groups = {};
  accts.forEach((a) => {
    const t = a.type || "other";
    if (!groups[t]) groups[t] = [];
    groups[t].push(a);
  });
  return groups;
}

function populateOwnerDropdown() {
  const sel = document.getElementById("entryOwner");
  sel.innerHTML = '<option value="">— None —</option>';
  owners.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.name;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", populatePropertyDropdown);
}

function populatePropertyDropdown() {
  const ownerId = document.getElementById("entryOwner").value;
  const sel = document.getElementById("entryProperty");
  const filtered = ownerId
    ? properties.filter((p) => p.owner_id == ownerId)
    : properties;

  sel.innerHTML = '<option value="">— None —</option>';
  filtered.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.address;
    sel.appendChild(opt);
  });
}

function populateVendorDropdown() {
  const sel = document.getElementById("entryVendor");
  sel.innerHTML = '<option value="">— None —</option>';
  vendors.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name;
    sel.appendChild(opt);
  });
}

function setTodayDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  document.getElementById("entryDate").value = `${y}-${m}-${d}`;
}

function setupForm() {
  const confirmCheck = document.getElementById("confirmCheck");
  const postBtn = document.getElementById("postBtn");

  confirmCheck.addEventListener("change", () => {
    postBtn.disabled = !confirmCheck.checked;
  });

  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await loadJournalEntries();
    showMessage("Refreshed", "success");
  });

  document
    .getElementById("journalForm")
    .addEventListener("submit", submitJournalEntry);
}

async function submitJournalEntry(e) {
  e.preventDefault();

  if (isSubmitting) return;

  const debitAccountId = parseInt(
    document.getElementById("debitAccount").value,
  );
  const creditAccountId = parseInt(
    document.getElementById("creditAccount").value,
  );
  const amount = parseFloat(document.getElementById("entryAmount").value);
  const memo = document.getElementById("entryMemo").value.trim();
  const date = document.getElementById("entryDate").value;
  const ownerId = document.getElementById("entryOwner").value
    ? parseInt(document.getElementById("entryOwner").value)
    : null;
  const propertyId = document.getElementById("entryProperty").value
    ? parseInt(document.getElementById("entryProperty").value)
    : null;
  const vendorId = document.getElementById("entryVendor").value
    ? parseInt(document.getElementById("entryVendor").value)
    : null;

  if (!debitAccountId || !creditAccountId) {
    showMessage("Both debit and credit accounts are required", "error");
    return;
  }

  if (debitAccountId === creditAccountId) {
    showMessage("Debit and credit accounts must be different", "error");
    return;
  }

  if (!amount || amount <= 0) {
    showMessage("Amount must be greater than zero", "error");
    return;
  }

  if (!memo) {
    showMessage(
      "Memo is required — document the reason for this entry",
      "error",
    );
    return;
  }

  isSubmitting = true;
  document.getElementById("postBtn").disabled = true;

  try {
    const payload = {
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      amount,
      memo,
      date,
      owner_id: ownerId,
      property_id: propertyId,
      vendor_id: vendorId,
    };

    const response = await fetch(`${apiUrl}/accounting/ledger/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to post journal entry");
    }

    const result = await response.json();

    showMessage(`✓ Journal entry #${result.id} posted`, "success");

    // Reset form (but keep date)
    const savedDate = document.getElementById("entryDate").value;
    document.getElementById("journalForm").reset();
    document.getElementById("entryDate").value = savedDate;
    document.getElementById("confirmCheck").checked = false;
    document.getElementById("postBtn").disabled = true;

    await loadJournalEntries();
  } catch (error) {
    console.error("Error posting journal entry:", error);
    showMessage(error.message, "error");
    // Re-enable post if confirm is still checked
    if (document.getElementById("confirmCheck").checked) {
      document.getElementById("postBtn").disabled = false;
    }
  } finally {
    isSubmitting = false;
  }
}

async function loadJournalEntries() {
  try {
    const response = await fetch(`${apiUrl}/accounting/ledger`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to load ledger");

    const allEntries = await response.json();

    // Sort newest first
    journalEntries = allEntries.sort(
      (a, b) =>
        new Date(b.created_at || b.date) - new Date(a.created_at || a.date),
    );

    renderJournalLog();
  } catch (error) {
    console.error("Error loading journal entries:", error);
    showMessage("Failed to load journal entries", "error");
  }
}

function renderJournalLog() {
  const log = document.getElementById("journalLog");
  const summary = document.getElementById("logSummary");

  if (!journalEntries.length) {
    log.innerHTML = `
      <div class="empty-log">
        <div class="empty-log-icon">📒</div>
        <div>No journal entries yet.</div>
      </div>`;
    summary.textContent = "";
    return;
  }

  const accountMap = {};
  accounts.forEach((a) => (accountMap[a.id] = a.name));

  summary.textContent = `${journalEntries.length} entries`;

  const html = journalEntries.slice(0, 100).map((e) => {
    const debitName =
      accountMap[e.debit_account_id] ||
      e.debit_account_name ||
      `Acct #${e.debit_account_id}`;
    const creditName =
      accountMap[e.credit_account_id] ||
      e.credit_account_name ||
      `Acct #${e.credit_account_id}`;
    const amount = parseFloat(e.amount) || 0;
    const dateStr = formatDateShort(e.date);

    return `
      <div class="log-entry">
        <div class="log-date">${dateStr}</div>
        <div class="log-amount">$${amount.toFixed(2)}</div>
        <div class="log-account log-debit" title="${escapeHtml(debitName)}">${escapeHtml(debitName)}</div>
        <div class="log-account log-credit" title="${escapeHtml(creditName)}">${escapeHtml(creditName)}</div>
        <div class="log-memo" title="${escapeHtml(e.memo || "")}">
          <span class="badge-journal">#${e.id}</span>${escapeHtml(e.memo || "")}
        </div>
        <div></div>
      </div>`;
  });

  log.innerHTML = html.join("");
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function showMessage(text, type = "info") {
  const container = document.getElementById("messageContainer");
  const cls = type === "error" ? "error-message" : "success-message";
  container.innerHTML = `<div class="${cls}">${escapeHtml(text)}</div>`;
  setTimeout(() => (container.innerHTML = ""), 4000);
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
