import {
  loadHeaderFooter,
  createElement,
  getApiUrl,
  formatDate,
} from "./utils.mjs";

async function renderInputs() {
  try {
    const apiUrl = await getApiUrl();
    const res = await fetch(`${apiUrl}/input/`);
    if (!res.ok) throw new Error("Failed to fetch inputs");
    const rows = await res.json();

    const container = document.getElementById("inputTableContainer");
    if (!container) return;

    // Build table
    const table = createElement("table", {
      className: "table table-sm table-bordered",
    });
    const thead = createElement("thead", { className: "table-light" });
    const headerRow = createElement("tr");
    [
      "Input ID",
      "Subject",
      "Request",
      "Date",
      "Assigned To",
      "Project",
      "Status",
    ].forEach((h) => {
      headerRow.appendChild(createElement("th", { text: h }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createElement("tbody");

    if (Array.isArray(rows) && rows.length > 0) {
      for (const r of rows) {
        const tr = createElement("tr");

        const idLink = createElement("a", {
          href: `/input.html?id=${encodeURIComponent(r.INPUT_ID)}`,
          text: r.INPUT_ID,
        });
        const tdId = createElement("td");
        tdId.appendChild(idLink);
        tr.appendChild(tdId);

        tr.appendChild(createElement("td", { text: r.SUBJECT || "" }));

        const reqText =
          (r.INPUT_TEXT || "").slice(0, 120) +
          ((r.INPUT_TEXT || "").length > 120 ? "…" : "");
        tr.appendChild(createElement("td", { text: reqText }));

        tr.appendChild(createElement("td", { text: formatDate(r.INPUT_DATE) }));
        tr.appendChild(createElement("td", { text: r.ASSIGNED_TO || "" }));
        tr.appendChild(createElement("td", { text: r.PROJECT_ID || "" }));
        tr.appendChild(
          createElement("td", { text: r.CLOSED === "Y" ? "Closed" : "Open" }),
        );

        tbody.appendChild(tr);
      }
    } else {
      const tr = createElement("tr");
      const td = createElement("td", { text: "No inputs found", colSpan: 7 });
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);

    // Clear container and append
    container.innerHTML = "";
    const wrap = createElement("div", { className: "table-responsive" });
    wrap.appendChild(table);
    container.appendChild(wrap);
  } catch (err) {
    console.error("Error rendering inputs:", err);
    const container = document.getElementById("inputTableContainer");
    if (container)
      container.innerHTML = `<p class="text-danger">Failed to load inputs: ${err.message}</p>`;
  }
}

// Initialize page on DOM ready. Load header/footer only when header is empty
async function initPage() {
  try {
    const headerEl = document.getElementById("header");
    if (headerEl && headerEl.innerHTML.trim() === "") {
      await loadHeaderFooter();
    }
  } catch (e) {
    console.warn("loadHeaderFooter skipped or failed:", e);
  }
  await renderInputs();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}

// Exported API for other modules to refresh the list
export async function refreshInputs() {
  await renderInputs();
}

export default { refreshInputs };

// Insert a single input row into the currently-rendered table (prepend).
export function addInputRow(r) {
  try {
    const container = document.getElementById("inputTableContainer");
    if (!container) return false;

    // find existing tbody
    const tbody = container.querySelector("tbody");
    if (!tbody) return false;

    const tr = createElement("tr");

    const idLink = createElement("a", {
      href: `/input.html?id=${encodeURIComponent(r.INPUT_ID)}`,
      text: r.INPUT_ID,
    });
    const tdId = createElement("td");
    tdId.appendChild(idLink);
    tr.appendChild(tdId);

    tr.appendChild(createElement("td", { text: r.SUBJECT || "" }));

    const reqText =
      (r.INPUT_TEXT || "").slice(0, 120) +
      ((r.INPUT_TEXT || "").length > 120 ? "…" : "");
    tr.appendChild(createElement("td", { text: reqText }));

    tr.appendChild(createElement("td", { text: formatDate(r.INPUT_DATE) }));
    tr.appendChild(createElement("td", { text: r.ASSIGNED_TO || "" }));
    tr.appendChild(createElement("td", { text: r.PROJECT_ID || "" }));
    tr.appendChild(
      createElement("td", { text: r.CLOSED === "Y" ? "Closed" : "Open" }),
    );

    // Prepend row
    if (tbody.firstChild) tbody.insertBefore(tr, tbody.firstChild);
    else tbody.appendChild(tr);
    return true;
  } catch (e) {
    console.error("addInputRow failed:", e);
    return false;
  }
}
