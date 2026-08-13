import { loadHeaderFooter, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const alertsUrl = `${apiUrl}/alerts`;

let carriers = [];
let alertsList = [];

async function init() {
  setupEventListeners();
  await checkSmtpConfig();
  await loadCarriers();
  await loadAlerts();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// ── Event Listeners ──────────────────────────────────────────────────────────

function setupEventListeners() {
  document.getElementById("addAlertBtn").addEventListener("click", openAdd);
  document
    .getElementById("closeAddAlertBtn")
    .addEventListener("click", () =>
      document.getElementById("addAlertDialog").close(),
    );
  document
    .getElementById("closeEditAlertBtn")
    .addEventListener("click", () =>
      document.getElementById("editAlertDialog").close(),
    );

  document.getElementById("addAlertForm").addEventListener("submit", saveAdd);
  document.getElementById("editAlertForm").addEventListener("submit", saveEdit);

  // Character counters
  document.getElementById("addMessage").addEventListener("input", (e) => {
    document.getElementById("addCharCount").textContent = e.target.value.length;
  });
  document.getElementById("editMessage").addEventListener("input", (e) => {
    document.getElementById("editCharCount").textContent =
      e.target.value.length;
  });

  // Close dialogs on outside click
  ["addAlertDialog", "editAlertDialog"].forEach((id) => {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) document.getElementById(id).close();
    });
  });
}

// ── SMTP Config Check ─────────────────────────────────────────────────────────

async function checkSmtpConfig() {
  try {
    const res = await fetch(`${alertsUrl}/smtp-status`);
    const { configured, missing } = await res.json();
    if (!configured) {
      const names = missing.join(", ");
      document.getElementById("smtpWarning").innerHTML = `
        <div class="alert alert-warning d-flex align-items-start gap-2 mb-4" role="alert">
          <span style="font-size:1.2rem;">⚠️</span>
          <div>
            <strong>SMTP not configured — alerts cannot be sent.</strong>
            <div class="mt-1">Missing environment variable${missing.length > 1 ? "s" : ""}:
              <code>${names}</code>.
              Add ${missing.length > 1 ? "them" : "it"} to your <code>.env</code> file and restart the server.
            </div>
          </div>
        </div>`;
      document.getElementById("addAlertBtn").disabled = true;
      document.getElementById("addAlertBtn").title =
        "SMTP must be configured before adding alerts";
    }
  } catch (err) {
    console.warn("Could not check SMTP config:", err);
  }
}

// ── Data Loading ─────────────────────────────────────────────────────────────

async function loadCarriers() {
  try {
    const res = await fetch(`${alertsUrl}/carriers`);
    carriers = await res.json();
    populateCarrierSelects();
  } catch (err) {
    console.error("Error loading carriers:", err);
  }
}

function populateCarrierSelects() {
  ["addCarrier", "editCarrier"].forEach((id) => {
    const sel = document.getElementById(id);
    carriers.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.value;
      opt.textContent = `${c.label} (${c.gateway})`;
      sel.appendChild(opt);
    });
  });
}

async function loadAlerts() {
  try {
    const res = await fetch(alertsUrl);
    alertsList = await res.json();
    renderTable();
  } catch (err) {
    console.error("Error loading alerts:", err);
    document.getElementById("alertsTableBody").innerHTML =
      `<tr><td colspan="8" class="text-center text-danger">Error loading alerts</td></tr>`;
  }
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById("alertsTableBody");
  if (alertsList.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="8" class="text-center text-muted py-4">` +
      `No alerts yet. Click <strong>+</strong> to add one.</td></tr>`;
    return;
  }

  tbody.innerHTML = alertsList
    .map((a) => {
      const carrierLabel =
        carriers.find((c) => c.value === a.carrier)?.label || a.carrier;
      const lastSent = a.last_sent_date
        ? new Date(a.last_sent_date).toLocaleDateString()
        : "Never";
      const activeBadge = a.active
        ? `<span class="badge bg-success">Yes</span>`
        : `<span class="badge bg-secondary">No</span>`;
      const dayOrdinal = ordinal(a.day_of_month);

      return `
      <tr>
        <td>${escHtml(a.name)}</td>
        <td><span class="text-truncate d-inline-block" style="max-width:200px" title="${escHtml(a.message)}">${escHtml(a.message)}</span></td>
        <td>${escHtml(a.phone_number)}</td>
        <td>${escHtml(carrierLabel)}</td>
        <td class="text-center">${dayOrdinal}</td>
        <td class="text-center">${activeBadge}</td>
        <td>${lastSent}</td>
        <td class="text-center text-nowrap">
          <button class="btn btn-sm btn-outline-success me-1" title="Send now" onclick="sendNow(${a.id})">▶ Send</button>
          <button class="btn btn-sm btn-outline-primary me-1" title="Edit" onclick="openEdit(${a.id})">✏</button>
          <button class="btn btn-sm btn-outline-danger" title="Delete" onclick="deleteAlert(${a.id})">🗑</button>
        </td>
      </tr>`;
    })
    .join("");
}

// ── Add ───────────────────────────────────────────────────────────────────────

function openAdd() {
  document.getElementById("addAlertForm").reset();
  document.getElementById("addCharCount").textContent = "0";
  document.getElementById("addAlertDialog").showModal();
}

async function saveAdd(e) {
  e.preventDefault();
  const form = e.target;
  const data = formToObj(form);
  data.active = form.active.checked ? 1 : 0;

  try {
    const res = await fetch(alertsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Save failed");
    }
    document.getElementById("addAlertDialog").close();
    await loadAlerts();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

window.openEdit = async function (id) {
  const alert = alertsList.find((a) => a.id === id);
  if (!alert) return;

  document.getElementById("editAlertId").value = alert.id;
  document.getElementById("editName").value = alert.name;
  document.getElementById("editMessage").value = alert.message;
  document.getElementById("editCharCount").textContent = alert.message.length;
  document.getElementById("editPhone").value = alert.phone_number;
  document.getElementById("editCarrier").value = alert.carrier;
  document.getElementById("editDayOfMonth").value = alert.day_of_month;
  document.getElementById("editActive").checked = !!alert.active;

  document.getElementById("editAlertDialog").showModal();
};

async function saveEdit(e) {
  e.preventDefault();
  const form = e.target;
  const id = document.getElementById("editAlertId").value;
  const data = formToObj(form);
  data.active = form.active.checked ? 1 : 0;

  try {
    const res = await fetch(`${alertsUrl}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Update failed");
    }
    document.getElementById("editAlertDialog").close();
    await loadAlerts();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ── Send Now ──────────────────────────────────────────────────────────────────

window.sendNow = async function (id) {
  const a = alertsList.find((x) => x.id === id);
  if (!confirm(`Send "${a?.name}" right now?`)) return;

  try {
    const res = await fetch(`${alertsUrl}/${id}/send`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Send failed");
    alert(json.message);
    await loadAlerts();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────

window.deleteAlert = async function (id) {
  const a = alertsList.find((x) => x.id === id);
  if (!confirm(`Delete alert "${a?.name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`${alertsUrl}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }
    await loadAlerts();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formToObj(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
