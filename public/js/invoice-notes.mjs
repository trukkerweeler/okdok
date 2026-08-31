import { loadHeaderFooter, getApiUrl } from "./utils.mjs";

loadHeaderFooter();

const apiUrl = await getApiUrl();
const notesUrl = `${apiUrl}/accounting/property-notes`;
const propertiesUrl = `${apiUrl}/accounting/properties`;

let properties = [];
let notes = [];

async function init() {
  setupEventListeners();
  await Promise.all([loadProperties(), loadNotes()]);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function setupEventListeners() {
  document
    .getElementById("addNoteBtn")
    .addEventListener("click", openAddDialog);
  document
    .getElementById("cancelNoteBtn")
    .addEventListener("click", closeDialog);
  document.getElementById("noteForm").addEventListener("submit", saveNote);

  document.getElementById("noteDialog").addEventListener("click", (e) => {
    if (e.target === document.getElementById("noteDialog")) closeDialog();
  });
}

async function loadProperties() {
  try {
    const res = await fetch(propertiesUrl, { credentials: "include" });
    if (res.ok) {
      properties = await res.json();
      populatePropertyDropdown();
    }
  } catch (err) {
    console.error("Error loading properties:", err);
  }
}

function populatePropertyDropdown() {
  const select = document.getElementById("noteProperty");
  select.innerHTML = '<option value="">Select a property...</option>';
  properties.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.address}, ${p.city}, ${p.state}`;
    select.appendChild(opt);
  });
}

async function loadNotes() {
  try {
    const res = await fetch(notesUrl, { credentials: "include" });
    if (res.ok) {
      notes = await res.json();
      renderNotes();
    }
  } catch (err) {
    console.error("Error loading notes:", err);
    document.getElementById("notesTableBody").innerHTML =
      '<tr><td colspan="4" class="text-center text-danger py-4">Error loading notes.</td></tr>';
  }
}

function renderNotes() {
  const tbody = document.getElementById("notesTableBody");
  if (notes.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted py-4">No notes yet. Click + to add one.</td></tr>';
    return;
  }

  tbody.innerHTML = notes
    .map(
      (note) => `
      <tr class="${note.is_active ? "" : "table-secondary text-muted"}">
        <td><strong>${escapeHtml(note.property_address || "—")}</strong></td>
        <td style="white-space: pre-wrap; max-width: 400px;">${escapeHtml(note.note_text)}</td>
        <td>
          ${
            note.is_active
              ? '<span class="badge bg-success">Active</span>'
              : '<span class="badge bg-secondary">Inactive</span>'
          }
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-btn me-1" data-id="${note.id}" title="Edit">✎</button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${note.id}" title="Delete">🗑️</button>
        </td>
      </tr>`,
    )
    .join("");

  tbody
    .querySelectorAll(".edit-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        openEditDialog(parseInt(btn.dataset.id)),
      ),
    );
  tbody
    .querySelectorAll(".delete-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () => deleteNote(parseInt(btn.dataset.id))),
    );
}

function openAddDialog() {
  document.getElementById("noteDialogTitle").textContent = "Add Note";
  document.getElementById("noteId").value = "";
  document.getElementById("noteForm").reset();
  document.getElementById("noteActive").checked = true;
  document.getElementById("noteDialog").showModal();
}

function openEditDialog(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;

  document.getElementById("noteDialogTitle").textContent = "Edit Note";
  document.getElementById("noteId").value = note.id;
  document.getElementById("noteProperty").value = note.property_id;
  document.getElementById("noteText").value = note.note_text;
  document.getElementById("noteActive").checked = !!note.is_active;
  document.getElementById("noteDialog").showModal();
}

function closeDialog() {
  document.getElementById("noteDialog").close();
}

async function saveNote(event) {
  event.preventDefault();
  const id = document.getElementById("noteId").value;
  const property_id = parseInt(document.getElementById("noteProperty").value);
  const note_text = document.getElementById("noteText").value.trim();
  const is_active = document.getElementById("noteActive").checked;

  if (!property_id || !note_text) return;

  const payload = { property_id, note_text, is_active };

  try {
    const res = await fetch(id ? `${notesUrl}/${id}` : notesUrl, {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.error || "Failed to save note"}`);
      return;
    }

    closeDialog();
    await loadNotes();
  } catch (err) {
    console.error("Error saving note:", err);
    alert(`Error: ${err.message}`);
  }
}

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;
  try {
    const res = await fetch(`${notesUrl}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete note");
    await loadNotes();
  } catch (err) {
    console.error("Error deleting note:", err);
    alert(`Error: ${err.message}`);
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
