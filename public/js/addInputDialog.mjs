import { getApiUrl, getSessionUser } from "./utils.mjs";

// Creates or returns the Add Input dialog element
export function ensureAddInputDialog() {
  let dlg = document.getElementById("addInputDialog");
  if (dlg) return dlg;

  // Build dialog HTML
  const html = `
  <dialog id="addInputDialog" class="dialog">
    <div class="dialog-header"><h2>Add New Input</h2></div>
    <form id="addInputForm" class="form">
      <div class="form-grid">
        <div class="form-group"><label for="INPUT_DATE">Action Date</label><input type="date" id="INPUT_DATE" name="INPUT_DATE" /></div>
        <div class="form-group"><label for="DUE_DATE">Due Date</label><input type="date" id="DUE_DATE" name="DUE_DATE" /></div>
        <div class="form-group"><label for="PEOPLE_ID">Requestor</label><input type="text" id="PEOPLE_ID" name="PEOPLE_ID" /></div>
        <div class="form-group"><label for="ASSIGNED_TO">Assignee</label><input type="text" id="ASSIGNED_TO" name="ASSIGNED_TO" /></div>
        <div class="form-group"><label for="INPUT_TYPE">Input Type</label>
          <select name="INPUT_TYPE" id="INPUT_TYPE">
            <option value="REQ" selected>Request</option>
            <option value="BUY">Purchase</option>
            <option value="CLN">Clean</option>
            <option value="EVAL">Evaluate</option>
            <option value="FIND">Find</option>
            <option value="SCH">Schedule</option>
            <option value="REP">Repair</option>
            <option value="RPL">Replace</option>
            <option value="RISK">Risk</option>
            <option value="OPPR">Opportunity</option>
            <option value="TRN">Train</option>
          </select>
        </div>
        <div class="form-group"><label for="SUBJECT" class="required">Subject</label><input type="text" id="SUBJECT" name="SUBJECT" required /></div>
        <div class="form-group full-width"><label for="INPUT_TEXT">Request</label><textarea id="INPUT_TEXT" name="INPUT_TEXT" rows="4"></textarea></div>
        <div class="form-group"><label for="PROJECT_ID">Project</label><input type="text" id="PROJECT_ID" name="PROJECT_ID" /></div>
      </div>
      <div class="dialog-actions">
        <button id="saveInputBtn" type="submit" class="btn btn-primary"><span class="btn-icon">✓</span> Save Input</button>
        <button type="button" id="closeAddInputBtn" class="btn btn-cancel"><span class="btn-icon">✕</span> Cancel</button>
      </div>
    </form>
  </dialog>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  dlg = document.getElementById("addInputDialog");

  // Wire close button
  const closeBtn = document.getElementById("closeAddInputBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => dlg.close());

  // Submit handler will be attached via openAddInputDialog so we don't duplicate behavior
  return dlg;
}

// Open the dialog with optional defaults and attach submit handler
export async function openAddInputDialog({
  projectId = null,
  defaults = {},
  onSave = null,
} = {}) {
  const dlg = ensureAddInputDialog();
  const apiUrl = await getApiUrl();
  const user = await getSessionUser().catch(() => null);

  const inputDate = document.getElementById("INPUT_DATE");
  const dueDate = document.getElementById("DUE_DATE");
  const projInput = document.getElementById("PROJECT_ID");
  const peopleId = document.getElementById("PEOPLE_ID");
  const form = document.getElementById("addInputForm");

  // Set defaults if fields are empty
  const today = new Date();
  const due = new Date();
  due.setDate(today.getDate() + 14);
  const toDateString = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (inputDate && !inputDate.value)
    inputDate.value = defaults.INPUT_DATE || toDateString(today);
  if (dueDate && !dueDate.value)
    dueDate.value = defaults.DUE_DATE || toDateString(due);
  if (projInput && projectId) projInput.value = projectId;
  if (peopleId && !peopleId.value)
    peopleId.value = defaults.PEOPLE_ID || user || "";

  // Remove any previous submit handler
  if (form._addInputHandler) {
    form.removeEventListener("submit", form._addInputHandler);
    form._addInputHandler = null;
  }

  // Attach submit handler
  const handler = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = {};
    for (const [k, v] of formData.entries()) data[k] = v;

    // Normalize date fields to YYYY-MM-DD
    if (data.INPUT_DATE && data.INPUT_DATE.length > 10)
      data.INPUT_DATE = data.INPUT_DATE.slice(0, 10);
    if (data.DUE_DATE && data.DUE_DATE.length > 10)
      data.DUE_DATE = data.DUE_DATE.slice(0, 10);

    // Add create metadata
    data.CREATE_DATE = new Date().toISOString().slice(0, 10);
    data.CREATE_BY = user || "WEB";
    data.CLOSED = "N";

    try {
      const res = await fetch(`${apiUrl}/input/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      // Close dialog and call callback. Prefer in-page refresh via inputs module.
      dlg.close();
      try {
        if (onSave && typeof onSave === "function") {
          onSave();
        } else {
          // Try to do an in-page insert first to avoid an extra fetch
          const mod = await import("./inputs.mjs");
          const paddedId = (await res.json) && res.json ? undefined : undefined;
          // Build a record object from submitted data and server response
          const saved = await res
            .clone()
            .json()
            .catch(() => null);
          const rec = {
            INPUT_ID:
              (saved && saved.INPUT_ID) ||
              String(data.INPUT_ID || data.rawId || "").padStart(7, "0"),
            SUBJECT: data.SUBJECT || "",
            INPUT_TEXT: data.INPUT_TEXT || "",
            INPUT_DATE:
              data.INPUT_DATE || new Date().toISOString().slice(0, 10),
            ASSIGNED_TO: data.ASSIGNED_TO || "",
            PROJECT_ID: data.PROJECT_ID || "",
            CLOSED: data.CLOSED || "N",
          };

          if (mod && typeof mod.addInputRow === "function") {
            // Ensure ID is a string
            rec.INPUT_ID = String(rec.INPUT_ID || "").trim();
            console.debug("addInputDialog: inserting rec:", rec);
            const inserted = mod.addInputRow(rec);
            if (!inserted && typeof mod.refreshInputs === "function")
              await mod.refreshInputs();
          } else if (mod && typeof mod.refreshInputs === "function") {
            await mod.refreshInputs();
          } else {
            window.location.reload();
          }
          // Notify any listeners (project page, inputs page) that a new input was added
          try {
            const evt = new CustomEvent("input:added", { detail: rec });
            document.dispatchEvent(evt);
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        console.error("Failed to refresh inputs after save:", e);
        window.location.reload();
      }
    } catch (err) {
      alert("Failed to save input: " + (err.message || err));
      console.error("Save input failed:", err);
    }
  };

  form.addEventListener("submit", handler);
  form._addInputHandler = handler;

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.style.display = "block";

  // focus subject field
  const subj = document.getElementById("SUBJECT");
  if (subj) subj.focus();
}
