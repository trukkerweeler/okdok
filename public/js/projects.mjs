import {
  loadHeaderFooter,
  getSessionUser,
  myport,
  getApiUrl,
} from "./utils.mjs";

// Initialize header/footer
loadHeaderFooter();

// Configuration
const apiUrl = await getApiUrl();
const url = `${apiUrl}/project`;
const skippers = ["ENTITY_ID", "MODIFIED_DATE", "MODIFIED_BY", "COST_SAVINGS"];
let sortOrder = "asc";
let user; // Will be set in initialization

// Initialize handler function
async function initializeProjects() {
  console.debug("[projects.mjs] Initializing");
  user = await getSessionUser();
  setupEventListeners();
  await loadProjectData();
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeProjects);
} else {
  initializeProjects();
}

function setupEventListeners() {
  // Add Project button
  const addProjectBtn = document.getElementById("addProjectBtn");
  if (addProjectBtn) {
    addProjectBtn.addEventListener("click", openAddProjectDialog);
  }

  // Close button for add project dialog
  const closeAddBtn = document.getElementById("closeAddProjectBtn");
  if (closeAddBtn) {
    closeAddBtn.addEventListener("click", () => {
      document.getElementById("addProjectDialog").close();
    });
  }

  // Save project form
  const saveProjectBtn = document.getElementById("saveProjectBtn");
  if (saveProjectBtn) {
    saveProjectBtn.addEventListener("click", saveProject);
  }

  // Close dialog on outside click for add project dialog
  const addProjectDialog = document.getElementById("addProjectDialog");
  if (addProjectDialog) {
    addProjectDialog.addEventListener("click", (e) => {
      if (e.target === addProjectDialog) {
        addProjectDialog.close();
      }
    });
  }
}

async function openAddProjectDialog() {
  const dialog = document.getElementById("addProjectDialog");
  if (dialog) {
    // Reset form
    const form = document.getElementById("addProjectForm");
    form.reset();

    dialog.showModal();
  }
}

async function saveProject(event) {
  event.preventDefault();
  const form = document.getElementById("addProjectForm");
  const formData = new FormData(form);

  try {
    // Prepare current timestamp
    const mytoday = new Date();
    const myCreateDate = mytoday.toISOString().slice(0, 10);

    // Build data object
    const dataJson = {
      CREATE_DATE: myCreateDate,
      CREATE_BY: user || "TKENT",
      CLOSED: "N",
    };

    // Add form data with proper case handling
    for (let field of formData.keys()) {
      const value = formData.get(field);

      switch (field) {
        case "LEADER":
        case "ASSIGNED_TO":
        case "SUBJECT":
        case "PROJECT_ID":
        case "PROJECT_TYPE":
          dataJson[field] = value ? value.toUpperCase() : value;
          break;
        default:
          if (field.endsWith("_DATE")) {
            dataJson[field] = value ? value.slice(0, 10) : value;
          } else {
            dataJson[field] = value;
          }
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataJson),
    });

    if (response.ok) {
      document.getElementById("addProjectDialog").close();
      await loadProjectData(); // Reload the data
    } else {
      const errorText = await response.text();
      alert(`Failed to save project: ${errorText}`);
    }
  } catch (error) {
    console.error("Error saving project:", error);
    alert("Failed to save project. Please try again.");
  }
}

async function loadProjectData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    displayProjectTable(data);
  } catch (error) {
    console.error("Error loading project data:", error);
    const container = document.getElementById("projectTableContainer");
    const msg =
      '<p class="error">Failed to load project data. Please refresh the page.</p>';
    if (container) {
      container.innerHTML = msg;
    } else {
      console.error("projectTableContainer not found in DOM.", msg);
    }
  }
}

function displayProjectTable(data) {
  const container = document.getElementById("projectTableContainer");
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = "<p>No project records found.</p>";
    return;
  }

  // Use Bootstrap table classes for nicer styling and responsive wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "table-responsive";

  const table = document.createElement("table");
  table.className = "table table-striped table-hover table-bordered mb-0";

  // Create header
  const thead = document.createElement("thead");
  thead.className = "table-light";
  thead.style.position = "sticky";
  thead.style.top = "0";
  thead.style.zIndex = "1";

  const headerRow = document.createElement("tr");

  // Get headers from first record, excluding skipped fields
  const headers = [];
  const keys = [];
  for (let key in data[0]) {
    if (!skippers.includes(key)) {
      headers.push(formatFieldName(key));
      keys.push(key);
    }
  }

  headers.forEach((header, index) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = header;
    th.style.cursor = "pointer";
    th.addEventListener("click", () => sortTable(index));
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement("tbody");
  tbody.id = "projectTableBody";

  data.forEach((item) => {
    const row = document.createElement("tr");

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let cellContent = "";

      if (item[key] !== null && item[key] !== undefined) {
        if (key.endsWith("DATE") && key.length > 4) {
          cellContent = (item[key] || "").slice(0, 10);
        } else if (key === "PROJECT_ID") {
          cellContent = `<a href="project.html?id=${item[key]}">${item[key]}</a>`;
        } else {
          cellContent = item[key] || "";
        }
      }

      const td = document.createElement("td");
      // When content contains HTML (link), set as innerHTML, otherwise set textContent
      if (key === "PROJECT_ID") {
        td.innerHTML = cellContent;
      } else {
        td.textContent = cellContent;
      }
      row.appendChild(td);
    }

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.innerHTML = "";
  container.appendChild(wrapper);
}

function formatFieldName(fieldName) {
  return fieldName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function sortTable(columnIndex) {
  const tbody = document.getElementById("projectTableBody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const headerCells = document.querySelectorAll("thead th");

  // Toggle sort order
  sortOrder = sortOrder === "asc" ? "desc" : "asc";

  rows.sort((a, b) => {
    const aVal = a.cells[columnIndex].textContent.trim();
    const bVal = b.cells[columnIndex].textContent.trim();

    // Handle date columns
    if (aVal.match(/^\d{4}-\d{2}-\d{2}/) && bVal.match(/^\d{4}-\d{2}-\d{2}/)) {
      const aDate = new Date(aVal) || new Date(0);
      const bDate = new Date(bVal) || new Date(0);
      return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
    }

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
