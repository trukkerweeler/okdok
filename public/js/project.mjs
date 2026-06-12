import { loadHeaderFooter, getApiUrl } from "./utils.mjs";

// Initialize page
loadHeaderFooter();

document.addEventListener("DOMContentLoaded", initializeProjectPage);

async function initializeProjectPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const main = document.getElementById("main");

  if (!id) {
    main.innerHTML = `<div class="container py-5"><p class="text-muted">No project id provided.</p></div>`;
    return;
  }

  try {
    const apiUrl = await getApiUrl();

    // Fetch meta from /project (list) and details/inputs from /project/:id
    const [listRes, detailRes] = await Promise.all([
      fetch(`${apiUrl}/project`),
      fetch(`${apiUrl}/project/${encodeURIComponent(id)}`),
    ]);

    if (!listRes.ok) throw new Error("Failed to load project list");
    if (!detailRes.ok) throw new Error("Failed to load project details");

    const list = await listRes.json();
    const detailRows = await detailRes.json();

    // Find project meta from list
    const project = list.find((p) => p.PROJECT_ID === id) || null;

    // If detailRows contains joined rows, extract description and inputs
    let description = "";
    let inputs = [];
    if (Array.isArray(detailRows) && detailRows.length > 0) {
      const first = detailRows[0];
      description = first.DESCRIPTION || first.PROJ_DESC || "";

      // Map unique inputs
      const seen = new Set();
      for (const r of detailRows) {
        if (r.INPUT_ID && !seen.has(r.INPUT_ID)) {
          seen.add(r.INPUT_ID);
          inputs.push({
            id: r.INPUT_ID,
            subject: r.SUBJECT,
            date: r.INPUT_DATE ? r.INPUT_DATE.slice(0, 10) : "",
            assigned: r.ASSIGNED_TO,
            text: r.INPUT_TEXT || r.INPUT_TEXT || "",
            closed: r.CLOSED,
            closedDate: r.CLOSED_DATE ? r.CLOSED_DATE.slice(0, 10) : "",
          });
        }
      }
    }

    // Build header
    const headerHtml = `
      <div class="container py-4">
        <div class="d-flex align-items-start gap-3">
          <div>
            <h1 class="h4 mb-1">${project ? escapeHtml(project.NAME) : escapeHtml(id)}</h1>
            <div class="text-muted small">ID: ${escapeHtml(id)} &nbsp; ${project && project.LEADER ? `· Leader: ${escapeHtml(project.LEADER)}` : ""}</div>
          </div>
        </div>
        <p class="mt-3">${description ? escapeHtml(description) : "<span class='text-muted'>No description available.</span>"}</p>
        <div class="mb-3">
          <a href="/projects.html" class="btn btn-outline-light btn-sm">Back to Projects</a>
          <a href="#" id="addActionInline" class="btn btn-light btn-sm ms-2">Add Action</a>
          <button id="closeProjectBtn" class="btn btn-light btn-sm ms-2">Close Project</button>
        </div>
      </div>
    `;

    // Build actions list
    let actionsHtml = "";
    if (inputs.length === 0) {
      actionsHtml = `<div class="container"><p class="text-muted">No actions/inputs for this project.</p></div>`;
    } else {
      actionsHtml = `
        <div class="container">
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Input ID</th>
                  <th>Subject</th>
                  <th>Request</th>
                  <th>Date</th>
                  <th>Closed Date</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${inputs
                  .map((it, idx) => {
                    const classes = [];
                    const isClosed = it.closed && it.closed.trim() === "Y";
                    if (isClosed) {
                      classes.push("table-closed");
                    } else {
                      // Striping for open rows: even=white, odd=light blue
                      if (idx % 2 === 1) classes.push("table-striped-row");
                      else classes.push("table-open-row");
                    }
                    return `
                  <tr class="${classes.join(" ")}">
                    <td><a href="/input.html?id=${encodeURIComponent(it.id)}">${escapeHtml(it.id)}</a></td>
                    <td>${escapeHtml(it.subject || "")}</td>
                    <td class="request-cell">${escapeHtml(it.text || "")}</td>
                    <td>${escapeHtml(it.date)}</td>
                    <td>${escapeHtml(it.closedDate || "")}</td>
                    <td>${escapeHtml(it.assigned || "")}</td>
                    <td>${isClosed ? "Closed" : "Open"}</td>
                  </tr>
                `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    main.innerHTML = headerHtml + actionsHtml;

    // Listen for inputs added elsewhere and append to this project's table
    const onInputAdded = (e) => {
      try {
        console.debug("project.mjs:onInputAdded detail=", e.detail);
        const rec = e.detail;
        if (!rec) return;
        // Coerce INPUT_ID to string to avoid accidental object rendering
        rec.INPUT_ID = String(rec.INPUT_ID || "");
        if (!rec || String(rec.PROJECT_ID || "") !== String(id)) return;
        const tbody = main.querySelector("table tbody");
        if (!tbody) return;

        // Build row using DOM methods to avoid HTML parsing issues
        const tr = document.createElement("tr");

        const tdId = document.createElement("td");
        const a = document.createElement("a");
        a.href = `/input.html?id=${encodeURIComponent(rec.INPUT_ID)}`;
        a.textContent = rec.INPUT_ID;
        tdId.appendChild(a);
        tr.appendChild(tdId);

        const tdSubject = document.createElement("td");
        tdSubject.textContent = rec.SUBJECT || "";
        tr.appendChild(tdSubject);

        const tdRequest = document.createElement("td");
        tdRequest.className = "request-cell";
        tdRequest.textContent = rec.INPUT_TEXT || "";
        tr.appendChild(tdRequest);

        const tdDate = document.createElement("td");
        tdDate.textContent = (rec.INPUT_DATE || "").slice(0, 10);
        tr.appendChild(tdDate);

        const tdClosedDate = document.createElement("td");
        tdClosedDate.textContent = (rec.CLOSED_DATE || "").slice(0, 10);
        tr.appendChild(tdClosedDate);

        const tdAssigned = document.createElement("td");
        tdAssigned.textContent = rec.ASSIGNED_TO || "";
        tr.appendChild(tdAssigned);

        const tdStatus = document.createElement("td");
        tdStatus.textContent = rec.CLOSED === "Y" ? "Closed" : "Open";
        tr.appendChild(tdStatus);

        if (tbody.firstChild) tbody.insertBefore(tr, tbody.firstChild);
        else tbody.appendChild(tr);
      } catch (err) {
        console.error("onInputAdded handler failed", err);
      }
    };
    // Ensure only one listener is attached
    document.removeEventListener("input:added", onInputAdded);
    document.addEventListener("input:added", onInputAdded);

    // Listen for updates to inputs and update the corresponding row in-place
    const onInputUpdated = (e) => {
      try {
        const rec = e.detail;
        if (!rec) return;
        rec.INPUT_ID = String(rec.INPUT_ID || "");
        if (String(rec.PROJECT_ID || "") !== String(id)) return;
        const tbody = main.querySelector("table tbody");
        if (!tbody) return;

        // find existing row by link href or link text
        let found = null;
        for (const row of Array.from(tbody.rows)) {
          const a = row.querySelector("td a");
          if (!a) continue;
          // check link text or href
          if (
            a.textContent === rec.INPUT_ID ||
            a.getAttribute("href")?.includes(encodeURIComponent(rec.INPUT_ID))
          ) {
            found = row;
            break;
          }
        }

        if (!found) return;

        // Update cells: subject(1), request(2), date(3), closedDate(4), assigned(5), status(6)
        const cells = found.cells;
        if (cells.length >= 7) {
          cells[1].textContent = rec.SUBJECT || "";
          cells[2].textContent = rec.INPUT_TEXT || "";
          cells[3].textContent = (rec.INPUT_DATE || "").slice(0, 10);
          cells[4].textContent = (rec.CLOSED_DATE || "").slice(0, 10);
          cells[5].textContent = rec.ASSIGNED_TO || "";
          cells[6].textContent = rec.CLOSED === "Y" ? "Closed" : "Open";
        }
      } catch (err) {
        console.error("onInputUpdated handler failed", err);
      }
    };

    document.removeEventListener("input:updated", onInputUpdated);
    document.addEventListener("input:updated", onInputUpdated);

    // Wire close project button (calls API to close)
    const closeBtn = document.getElementById("closeProjectBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", async () => {
        if (!confirm("Close this project?")) return;
        const r = await fetch(
          `${apiUrl}/project/close/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
          },
        );
        if (r.ok) {
          alert("Project closed");
          window.location.reload();
        } else {
          alert("Failed to close project");
        }
      });
    }

    // Wire inline Add Action to open shared dialog
    const addInline = document.getElementById("addActionInline");
    if (addInline) {
      addInline.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const module = await import("./addInputDialog.mjs");
          await module.openAddInputDialog({
            projectId: id,
            onSave: () => window.location.reload(),
          });
        } catch (err) {
          // Fallback to navigation if module not available
          window.location.href = `/inputs.html?project=${encodeURIComponent(id)}`;
        }
      });
    }
  } catch (err) {
    console.error(err);
    const main = document.getElementById("main");
    main.innerHTML = `<div class="container py-4"><p class="text-danger">Failed to load project: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
