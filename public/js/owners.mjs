import { loadHeaderFooter, getSessionUser, getApiUrl } from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const url = `${apiUrl}/accounting/owners`;
let user;

// Initialize handler function
async function initializeOwners() {
  console.debug("[owners.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadOwnersData();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeOwners);
} else {
  initializeOwners();
}

function setupEventListeners() {
  // Add Owner button
  const addOwnerBtn = document.getElementById("addOwnerBtn");
  if (addOwnerBtn) {
    addOwnerBtn.addEventListener("click", openAddOwnerDialog);
  }

  // Close button for add owner dialog
  const closeAddBtn = document.getElementById("closeAddOwnerBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addOwnerDialog").close();
    });
  }

  // Save owner form
  const addOwnerForm = document.getElementById("addOwnerForm");
  if (addOwnerForm) {
    addOwnerForm.addEventListener("submit", saveOwner);
  }

  // Close dialog on outside click
  const addOwnerDialog = document.getElementById("addOwnerDialog");
  if (addOwnerDialog) {
    addOwnerDialog.addEventListener("click", (e) => {
      if (e.target === addOwnerDialog) {
        addOwnerDialog.close();
      }
    });
  }
}

async function openAddOwnerDialog() {
  const dialog = document.getElementById("addOwnerDialog");
  if (dialog) {
    const form = document.getElementById("addOwnerForm");
    form.reset();
    dialog.showModal();
  }
}

async function saveOwner(event) {
  event.preventDefault();
  const form = document.getElementById("addOwnerForm");
  const formData = new FormData(form);

  try {
    const dataJson = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || null,
      payout_bank_account: formData.get("payout_bank_account"),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || "Failed to save owner"}`);
      return;
    }

    const newOwner = await response.json();
    console.log("Owner saved:", newOwner);

    // Close dialog and refresh list
    document.getElementById("addOwnerDialog").close();
    await loadOwnersData();

    // Show success message
    alert(`Owner "${newOwner.name}" created successfully!`);
  } catch (error) {
    console.error("Error saving owner:", error);
    alert("Error saving owner. Check console for details.");
  }
}

async function loadOwnersData() {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const owners = await response.json();
    displayOwners(owners);
  } catch (error) {
    console.error("Error loading owners:", error);
    const tbody = document.getElementById("ownersTableBody");
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger py-4">Error loading owners</td></tr>';
  }
}

function displayOwners(owners) {
  const tbody = document.getElementById("ownersTableBody");

  if (!owners || owners.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-4">No owners found. Click + to add one.</td></tr>';
    return;
  }

  tbody.innerHTML = owners
    .map(
      (owner) => `
    <tr>
      <td>${owner.id}</td>
      <td>${escapeHtml(owner.name)}</td>
      <td>${escapeHtml(owner.email)}</td>
      <td>${escapeHtml(owner.phone || "-")}</td>
      <td>${escapeHtml(owner.payout_bank_account || "-")}</td>
      <td>${formatDate(owner.created_at)}</td>
    </tr>
  `,
    )
    .join("");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
