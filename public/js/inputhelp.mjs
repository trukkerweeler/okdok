import {
  loadHeaderFooter,
  getSessionUser,
  getApiUrl,
  getConfig,
} from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
let url = "";
let sortOrder = "asc";
let user; // Will be set in initialization
let config; // Will be set in initialization

document.addEventListener("DOMContentLoaded", async function () {
  const apiUrl = await getApiUrl();
  url = `${apiUrl}/inputhelp`;
  user = await getSessionUser();
  config = await getConfig();
  setupEventListeners();
  await loadInputHelpData();
});

function setupEventListeners() {
  // Add Help button
  const addHelpBtn = document.getElementById("addHelpBtn");
  if (addHelpBtn) {
    addHelpBtn.addEventListener("click", openAddHelpDialog);
  }

  // Close button for add help dialog
  const closeAddBtn = document.getElementById("closeAddBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addHelpDialog").close();
    });
  }

  // Save Help form
  const saveHelpBtn = document.getElementById("saveHelpBtn");
  if (saveHelpBtn) {
    saveHelpBtn.addEventListener("click", saveHelp);
  }

  // Close dialog on outside click for add help dialog
  const addHelpDialog = document.getElementById("addHelpDialog");
  if (addHelpDialog) {
    addHelpDialog.addEventListener("click", (e) => {
      if (e.target === addHelpDialog) {
        addHelpDialog.close();
      }
    });
  }

  // File input handler
  const linkFileInput = document.getElementById("linkFile");
  if (linkFileInput) {
    linkFileInput.addEventListener("change", handleFileSelect);
  }
}

async function openAddHelpDialog() {
  const dialog = document.getElementById("addHelpDialog");
  if (dialog) {
    // Reset form
    const form = document.getElementById("addHelpForm");
    form.reset();

    dialog.showModal();
  }
}

async function saveHelp(event) {
  event.preventDefault();
  const form = document.getElementById("addHelpForm");

  try {
    // Build data object manually to ensure proper handling
    const dataJson = {
      SUBJECT: document.getElementById("subject").value.trim(),
      DESCRIPTION: document.getElementById("description").value.trim(),
      LINK: document.getElementById("link").value.trim(),
    };

    // Validate required fields
    if (!dataJson.SUBJECT) {
      alert("Subject is required");
      return;
    }
    if (!dataJson.DESCRIPTION) {
      alert("Description is required");
      return;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
    });

    if (response.ok) {
      document.getElementById("addHelpDialog").close();
      await loadInputHelpData(); // Reload the data
    } else {
      const errorText = await response.text();
      alert(`Failed to save help record: ${errorText}`);
    }
  } catch (error) {
    console.error("Error saving help record:", error);
    alert("Failed to save help record. Please try again.");
  }
}

async function loadInputHelpData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    displayInputHelpTable(data);
  } catch (error) {
    console.error("Error loading input help data:", error);
    document.getElementById("inputHelpTableContainer").innerHTML =
      '<p class="error">Failed to load input help data. Please refresh the page.</p>';
  }
}

function displayInputHelpTable(data) {
  const container = document.getElementById("inputHelpTableContainer");
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = "<p>No help records found.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "data-table";
  table.style.marginBottom = "0";

  // Create header
  const thead = document.createElement("thead");
  thead.style.position = "sticky";
  thead.style.top = "0";
  thead.style.zIndex = "1";

  const headerRow = document.createElement("tr");

  const headers = ["Subject", "Description", "Link"];

  headers.forEach((header, index) => {
    const th = document.createElement("th");
    th.textContent = header;
    th.style.cursor = "pointer";
    th.addEventListener("click", () => sortTable(index));
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement("tbody");
  tbody.id = "inputHelpTableBody";

  data.forEach((item) => {
    const row = document.createElement("tr");

    const subjectCell = document.createElement("td");
    subjectCell.textContent = item.SUBJECT || "";
    row.appendChild(subjectCell);

    const descriptionCell = document.createElement("td");
    descriptionCell.innerHTML = (item.DESCRIPTION || "").replace(/\n/g, "<br>");
    row.appendChild(descriptionCell);

    const linkCell = document.createElement("td");
    if (item.LINK) {
      const linkElement = document.createElement("a");
      // Ensure the link has a proper URL format
      let href = item.LINK;
      if (
        !href.startsWith("http://") &&
        !href.startsWith("https://") &&
        !href.startsWith("/")
      ) {
        // If it's just a filename, assume it's in the input-files directory
        href = `/input-files/${href}`;
      }
      linkElement.href = href;
      linkElement.target = "_blank";
      linkElement.textContent = "View Document";
      linkCell.appendChild(linkElement);
    } else {
      linkCell.textContent = "";
    }
    row.appendChild(linkCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

function sortTable(columnIndex) {
  const tbody = document.getElementById("inputHelpTableBody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const headerCells = document.querySelectorAll("thead th");

  // Toggle sort order
  sortOrder = sortOrder === "asc" ? "desc" : "asc";

  rows.sort((a, b) => {
    const aVal = a.cells[columnIndex].textContent.trim();
    const bVal = b.cells[columnIndex].textContent.trim();

    // Handle text columns
    return sortOrder === "asc"
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });

  // Clear tbody and append sorted rows
  tbody.innerHTML = "";
  rows.forEach((row) => tbody.appendChild(row));

  // Update sort indicators
  updateSortIndicators(headerCells, columnIndex);
}

function updateSortIndicators(headerCells, activeColumnIndex) {
  headerCells.forEach((th, index) => {
    // Remove existing sort indicators
    th.textContent = th.textContent.replace(/ [↑↓]$/, "");

    // Add indicator to active column
    if (index === activeColumnIndex) {
      const indicator = sortOrder === "asc" ? " ↑" : " ↓";
      th.textContent += indicator;
    }
  });
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    try {
      // Show loading state
      const linkInput = document.getElementById("link");
      linkInput.value = "Uploading...";
      linkInput.disabled = true;

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload the file
      const response = await fetch(`${url}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        linkInput.value = result.path;
        linkInput.disabled = false;
      } else {
        const error = await response.json();
        alert(`File upload failed: ${error.error}`);
        linkInput.value = "";
        linkInput.disabled = false;
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
      const linkInput = document.getElementById("link");
      linkInput.value = "";
      linkInput.disabled = false;
    }
  }
}
