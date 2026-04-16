import {
  loadHeaderFooter,
  createNotesSection,
  getSessionUser,
  getUserByIP,
  getDateTime,
  myport,
  createElement,
  formatDate,
  getUrlParam,
  extractText,
  timestampText,
  getApiUrl,
} from "./utils.mjs";
import {
  calculateDaysOverdue,
  createEscalationButton,
  createEscalationHistory,
} from "./escalation-utils.mjs";
import userEmails from "./users.mjs";

// IP address to username mapping
const ipToUserMap = {
  "192.168.1.69": "TKENT",
  // Add more IP mappings here as needed
};

await loadHeaderFooter();
const user = await getUserByIP(ipToUserMap);
const iid = getUrlParam("id");

const apiUrl = await getApiUrl();

// Replace all hardcoded URLs with dynamic apiUrl
const apiUrls = {
  input: `${apiUrl}/input/`,
  csr: `${apiUrl}/csr/`,
  ssr: `${apiUrl}/ssr/`,
};

// Helper: show/hide inline edit forms
function showForm(formId) {
  // Map old form IDs to dialog IDs
  const dialogMappings = {
    editResourceForm: "resourceDialog",
    editActionForm: "actionDialog",
    editFollowupForm: "followupDialog",
    editResponseForm: "responseDialog",
  };

  const dialogId = dialogMappings[formId] || formId;
  const dialog = document.getElementById(dialogId);

  if (dialog && dialog.tagName === "DIALOG") {
    dialog.showModal();
  } else {
    const form = document.getElementById(dialogId);
    if (form) {
      form.style.display = "block";
    }
  }
}

function hideForm(formId) {
  // Map old form IDs to dialog IDs
  const dialogMappings = {
    editResourceForm: "resourceDialog",
    editActionForm: "actionDialog",
    editFollowupForm: "followupDialog",
    editResponseForm: "responseDialog",
  };

  const dialogId = dialogMappings[formId] || formId;
  const dialog = document.getElementById(dialogId);

  if (dialog && dialog.tagName === "DIALOG") {
    dialog.close();
  } else {
    const form = document.getElementById(dialogId);
    if (form) {
      form.style.display = "none";
    }
  }
}

// Setup backdrop click handlers for dialogs
function setupDialogBackdropClose() {
  const dialogs = document.querySelectorAll("dialog");
  dialogs.forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      // Only close if clicking on the dialog element itself (the backdrop),
      // not on any child elements
      if (e.target === dialog) {
        dialog.close();
      }
    });
  });
}

const url = `${apiUrls.input}${iid}`;
const main = document.querySelector("main");

// Clear main element
while (main.firstChild) {
  main.removeChild(main.firstChild);
}

// Helper function to update DOM after AJAX save
async function updateAfterSave() {
  const response = await fetch(url, { method: "GET" });
  const record = await response.json();

  // Get the first (and usually only) key from the record
  const key = Object.keys(record)[0];
  const rec = record[key];

  // Update specific DOM elements
  const closedDateElem = document.querySelector("#closed");
  if (closedDateElem) {
    closedDateElem.textContent = `Closed Date: ${formatDate(rec["CLOSED_DATE"])}`;
  }

  const assignedElem = document.querySelector("#assignedto");
  if (assignedElem) {
    assignedElem.textContent = `Assigned To: ${rec["ASSIGNED_TO"]}`;
  }

  const dueDateElem = document.querySelector("#duedate");
  if (dueDateElem) {
    dueDateElem.textContent = `Due date: ${formatDate(rec["DUE_DATE"])}`;
  }

  const subjectElem = document.querySelector("#subject");
  if (subjectElem) {
    subjectElem.textContent = `Subject: ${rec["SUBJECT"]}`;
  }

  // Update notes sections
  const actionNote = document.querySelector("#actionNote");
  if (actionNote && rec["INPUT_TEXT"]) {
    actionNote.innerHTML = rec["INPUT_TEXT"].replace(/\n/g, "<br>");
  }

  const followupNote = document.querySelector("#followUpNote");
  if (followupNote && rec["FOLLOWUP_TEXT"]) {
    followupNote.innerHTML = rec["FOLLOWUP_TEXT"].replace(/\n/g, "<br>");
  }

  const responseNote = document.querySelector("#responseNote");
  if (responseNote && rec["RESPONSE_TEXT"]) {
    responseNote.innerHTML = rec["RESPONSE_TEXT"].replace(/\n/g, "<br>");
  }

  // Handle close button state
  const btnClose = document.querySelector("#btnClose");
  if (btnClose && (rec["CLOSED"] === "Y" || rec["CLOSED_DATE"])) {
    btnClose.disabled = true;
    btnClose.style.opacity = "0.5";
    btnClose.style.cursor = "not-allowed";
    btnClose.style.backgroundColor = "#e0e0e0";
    btnClose.title = "This action item is already closed";
  }

  // Notify other pages that this input was updated so they can refresh incrementally
  try {
    const evt = new CustomEvent("input:updated", { detail: rec });
    document.dispatchEvent(evt);
  } catch (e) {
    // ignore
  }
}

fetch(url, { method: "GET" })
  .then((response) => response.json())
  .then(async (record) => {
    let rec; // Declare rec outside the loop so functions can access it

    for (const key in record) {
      rec = record[key];

      // Create detail section
      const detailSection = createElement("section", {
        className: "section",
        id: "detailSection",
      });

      // Header elements
      const elemRpt = createElement("h1", {
        className: "header",
        text: "Action Item Detail",
      });
      const elemId = createElement("h2", {
        className: "header2",
        text: `Action Id: ${rec["INPUT_ID"]}`,
      });

      // Detail title
      const detailTitle = createElement("h3", {
        className: "span-2",
        text: "Detail",
      });

      // Detail buttons
      const detailButtons = createElement("div", {
        className: "detailButtons",
        id: "detailButtons",
      });
      detailButtons.style.display = "flex";
      detailButtons.style.gap = "0.5rem";
      // Make Edit and Email look like compact buttons
      const btnEditDetail = createElement("button", {
        className: "btn btn-sm btn-primary",
        id: "btnEditDetail",
        text: "Edit",
        type: "button",
      });
      btnEditDetail.style.textTransform = "none";
      btnEditDetail.style.borderRadius = "0.25rem";

      const btnFollowUp = createElement("button", {
        className: "btn btn-sm btn-outline-secondary",
        id: "btnFollowUp",
        text: "Email",
        type: "button",
      });
      btnFollowUp.style.textTransform = "none";
      btnFollowUp.style.borderRadius = "0.25rem";

      detailButtons.appendChild(btnFollowUp);
      detailButtons.appendChild(btnEditDetail);

      // Detail information elements
      // Build a compact 3-column detail table (labels above values)
      const detailTable = document.createElement("table");
      detailTable.style.borderCollapse = "collapse";
      detailTable.style.width = "100%";
      detailTable.style.margin = "0 0 0.5rem 0";
      detailTable.style.fontSize = "0.95rem";
      const dtBody = document.createElement("tbody");

      const items = [
        { label: "Request Date", value: formatDate(rec["INPUT_DATE"]) },
        {
          label: "Project",
          value: `${rec["PROJECT_ID"]} - ${rec["NAME"]}`,
          id: "project",
        },
        {
          label: "Closed Date",
          value: formatDate(rec["CLOSED_DATE"]),
          id: "closed",
        },
        { label: "Assigned To", value: rec["ASSIGNED_TO"], id: "assignedto" },
        { label: "Request By", value: rec["PEOPLE_ID"], id: "requestby" },
        {
          label: "Due date",
          value: formatDate(rec["DUE_DATE"]),
          id: "duedate",
        },
        { label: "Subject", value: rec["SUBJECT"], id: "subject" },
      ];

      for (let i = 0; i < items.length; i += 3) {
        const tr = document.createElement("tr");
        for (let j = 0; j < 3; j++) {
          const item = items[i + j];
          const td = document.createElement("td");
          td.style.padding = "0.12rem 0.6rem";
          td.style.verticalAlign = "top";
          if (item) {
            const text = document.createElement("div");
            text.textContent = `${item.label}: ${item.value || ""}`;
            if (item.id) text.id = item.id;
            text.style.fontSize = "0.95rem";
            td.appendChild(text);
          }
          tr.appendChild(td);
        }
        dtBody.appendChild(tr);
      }

      detailTable.appendChild(dtBody);

      // Subtitle div with close button
      const divSubTitle = createElement("div", {
        className: "subtitlewithbutton",
      });
      divSubTitle.appendChild(elemId);

      const btnClose = createElement("button", {
        className: "closebutton",
        id: "btnClose",
        text: "Close Action",
        type: "submit",
      });
      // Store record data on button for later access
      btnClose.dataset.closed = rec["CLOSED"] || "";
      btnClose.dataset.closedDate = rec["CLOSED_DATE"] || "";

      // Create a buttons container for proper alignment
      const buttonsContainer = document.createElement("div");
      buttonsContainer.style.display = "flex";
      buttonsContainer.style.justifyContent = "flex-end";
      buttonsContainer.style.alignItems = "center";
      buttonsContainer.style.gap = "10px";

      // Add escalation button if overdue
      const daysOverdue = calculateDaysOverdue(rec["DUE_DATE"]);
      if (daysOverdue > 0 && rec["CLOSED"] !== "Y") {
        const escalationBtn = createEscalationButton(
          "INPUT",
          rec["INPUT_ID"],
          rec["SUBJECT"],
          rec["ASSIGNED_TO"],
          daysOverdue,
          user,
          () => {
            // Refresh page on successful escalation
            location.reload();
          },
        );
        escalationBtn.style.display = "none"; // Hide escalation button
        buttonsContainer.appendChild(escalationBtn);
      }

      // Add close button to container
      buttonsContainer.appendChild(btnClose);
      divSubTitle.appendChild(buttonsContainer);

      // Assemble detail section
      detailSection.appendChild(detailTitle);
      detailSection.appendChild(detailButtons);
      // Insert compact detail table
      detailSection.appendChild(detailTable);

      // Add to main
      main.appendChild(elemRpt);
      main.appendChild(divSubTitle);
      main.appendChild(detailSection);

      // Create notes sections
      createNotesSection("INPUT_TEXT", rec["INPUT_TEXT"]);
      createNotesSection(
        "FOLLOWUP_TEXT",
        rec["FOLLOWUP_TEXT"],
        null,
        rec["FOLLOWUP_DATE"],
        rec["FOLLOWUP_BY"],
      );
      createNotesSection(
        "RESPONSE_TEXT",
        rec["RESPONSE_TEXT"],
        null,
        rec["RESPONSE_DATE"],
        rec["RESPONSE_BY"],
      );

      // Create resources section
      const resourcesSection = createElement("section", {
        className: "section",
        id: "resourcesSection",
      });

      const resourcesTitle = createElement("h3", {
        className: "span-2",
        text: "Resources",
      });

      const addResourceBtn = createElement("button", {
        className: "btn btn-primary btn-sm",
        id: "addResourceBtn",
        text: "Add Resource",
        type: "button",
      });

      const resourcesContainer = document.createElement("div");
      resourcesContainer.style.marginTop = "1rem";
      resourcesContainer.style.overflowX = "auto";

      const resourcesTable = document.createElement("table");
      resourcesTable.id = "resourcesTable";
      resourcesTable.className = "table table-sm table-bordered";
      resourcesTable.innerHTML = `
        <thead class="table-light">
          <tr>
            <th>Resource Type</th>
            <th>Description</th>
            <th style="text-align: right;">Qty</th>
            <th>Unit</th>
            <th style="text-align: right;">Hours</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      `;

      resourcesContainer.appendChild(resourcesTable);
      resourcesSection.appendChild(resourcesTitle);
      resourcesSection.appendChild(addResourceBtn);
      resourcesSection.appendChild(resourcesContainer);
      main.appendChild(resourcesSection);

      // Add event listeners to resource buttons NOW that they exist
      addResourceBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearResourceForm();
        document.getElementById("dialogTitle").textContent = "Add Resource";
        showForm("editResourceForm");
      });

      const saveResourceBtn = document.getElementById("saveResourceBtn");
      if (saveResourceBtn) {
        saveResourceBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          await saveResource();
        });
      }

      // Also update title when editing vs adding
      const resourceForm = document.getElementById("resourceForm");
      if (resourceForm) {
        resourceForm.addEventListener("submit", async (e) => {
          e.preventDefault();
        });
      }

      // Load and display resources after page loads
      const resources = await loadResources();
      displayResources(resources);

      // Setup backdrop close handlers for dialogs
      setupDialogBackdropClose();

      // Add escalation history
      const escalationHistory = await createEscalationHistory(
        "INPUT",
        rec["INPUT_ID"],
      );
      escalationHistory.style.display = "none"; // Hide escalation history
      main.appendChild(escalationHistory);
    }

    // ===== Response Handler (Bootstrap modal) =====
    const btnEditResp = document.getElementById("editResponse");
    if (btnEditResp) {
      btnEditResp.addEventListener("click", async (event) => {
        event.preventDefault();
        const newResponseDateInput = document.getElementById("newResponseDate");
        const newTextResp = document.getElementById("newTextResp");

        // Set response date if not already set
        if (newResponseDateInput && !newResponseDateInput.value) {
          newResponseDateInput.value = formatDate(new Date().toISOString());
        }

        // Clear textarea for fresh input
        if (newTextResp) newTextResp.value = "";

        // Show modal dialog
        showForm("responseDialog");
      });

      // Handle save response
      const saveResp = document.getElementById("saveResp");
      if (saveResp) {
        saveResp.addEventListener("click", async (ev) => {
          ev.preventDefault();

          const oldResponseText =
            document.querySelector("#responseNote")?.innerHTML || "";
          const newResponseText = newTextResp ? newTextResp.value : "";
          const responseText = timestampText(
            user,
            newResponseText,
            oldResponseText,
          );

          const data = {
            INPUT_ID: iid,
            INPUT_USER: user,
            RESPONSE_TEXT: responseText,
            RESPONSE_DATE:
              document.getElementById("newResponseDate")?.value || "",
            RESPONSE_BY: user,
            MODIFIED_BY: user,
            MODIFIED_DATE: getDateTime(),
          };

          try {
            await fetch(`${apiUrls.input}${iid}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data }),
            });
            hideForm("responseDialog");
            await updateAfterSave();
          } catch (err) {
            console.error("Failed saving response:", err);
            alert("Failed to save response: " + (err.message || err));
          }
        });
      }
    }

    // ===== Action Handler =====
    const btnEditAction = document.querySelector("#editAction");
    if (btnEditAction) {
      btnEditAction.addEventListener("click", (event) => {
        event.preventDefault();
        const newTextAction = document.getElementById("newTextAction");
        if (newTextAction) newTextAction.value = "";
        showForm("actionDialog");
      });

      // Handle save action
      const saveActionBtn = document.getElementById("saveAction");
      if (saveActionBtn) {
        saveActionBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          const txt = document.getElementById("newTextAction")?.value || "";
          if (!txt.trim()) {
            alert("Action text cannot be empty");
            return;
          }
          const oldActionText =
            document.querySelector("#actionNote")?.innerHTML || "";
          const actionText = timestampText(user, txt, oldActionText).replace(
            /\n/g,
            "<br>",
          );
          const data = {
            INPUT_ID: iid,
            INPUT_USER: user,
            INPUT_TEXT: actionText,
          };
          try {
            await fetch(`${apiUrls.input}${iid}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data }),
            });
            hideForm("actionDialog");
            await updateAfterSave();
          } catch (err) {
            console.error("Failed saving action:", err);
            alert("Failed to save action: " + (err.message || err));
          }
        });
      }

      // Handle cancel action
      const cancelAction = document.getElementById("cancelAction");
      if (cancelAction) {
        cancelAction.addEventListener("click", () =>
          hideForm("editActionForm"),
        );
      }
    }

    // ===== Follow Up Handler =====
    const btnEditFlup = document.querySelector("#editFollowUp");
    if (btnEditFlup) {
      btnEditFlup.addEventListener("click", (event) => {
        event.preventDefault();
        const newFollowUpDateInput = document.getElementById("newFollowUpDate");
        const newTextFollowup = document.getElementById("newTextFollowup");

        if (newFollowUpDateInput && !newFollowUpDateInput.value) {
          newFollowUpDateInput.value = formatDate(new Date().toISOString());
        }
        if (newTextFollowup) newTextFollowup.value = "";
        showForm("followupDialog");
      });

      // Handle save followup
      const saveFlupBtn = document.getElementById("saveFlup");
      if (saveFlupBtn) {
        saveFlupBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          const newFollowUpText =
            document.getElementById("newTextFollowup")?.value || "";
          const oldFollowUpText =
            document.querySelector("#followUpNote")?.innerHTML || "";
          const followUpText = timestampText(
            user,
            newFollowUpText,
            oldFollowUpText,
          );
          const data = {
            INPUT_ID: iid,
            INPUT_USER: user,
            FOLLOWUP_TEXT: followUpText,
            FOLLOWUP_DATE:
              document.getElementById("newFollowUpDate")?.value || "",
            FOLLOWUP_BY: user,
            MODIFIED_BY: user,
            MODIFIED_DATE: getDateTime(),
          };
          try {
            await fetch(`${apiUrls.input}${iid}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data }),
            });
            hideForm("followupDialog");
            await updateAfterSave();
          } catch (err) {
            console.error("Failed saving followup:", err);
            alert("Failed to save followup: " + (err.message || err));
          }
        });
      }
    }
    // ===== Close Action Handler =====
    const btnClose = document.querySelector("#btnClose");
    if (btnClose) {
      // Disable button if record is already closed
      if (
        btnClose.dataset.closed === "Y" ||
        (btnClose.dataset.closedDate &&
          btnClose.dataset.closedDate.trim() !== "")
      ) {
        btnClose.disabled = true;
        btnClose.style.opacity = "0.5";
        btnClose.style.cursor = "not-allowed";
        btnClose.style.backgroundColor = "#e0e0e0";
        btnClose.title = "This action item is already closed";
      }

      btnClose.addEventListener("click", async (event) => {
        event.preventDefault();

        // Check if already closed
        if (
          btnClose.dataset.closed === "Y" ||
          (btnClose.dataset.closedDate &&
            btnClose.dataset.closedDate.trim() !== "")
        ) {
          alert("This action item is already closed");
          return;
        }

        let paddedId = String(iid).padStart(7, "0");
        const data = {
          INPUT_ID: paddedId,
          CLOSED: "Y",
          CLOSED_DATE: getDateTime(),
        };

        await fetch(`${apiUrls.input}close/${paddedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        // Disable the button and update visual state
        btnClose.disabled = true;
        btnClose.style.opacity = "0.5";
        btnClose.style.cursor = "not-allowed";
        btnClose.style.backgroundColor = "#e0e0e0";
        btnClose.title = "This action item is already closed";

        await updateAfterSave();
      });
    }

    // ===== Edit Detail Handler =====
    const btnEditDetail = document.querySelector("#btnEditDetail");
    if (btnEditDetail) {
      btnEditDetail.addEventListener("click", (event) => {
        event.preventDefault();

        // Populate fields
        const assignedToElem = document.querySelector("#assignedto");
        const dueDateElem = document.querySelector("#duedate");
        const projectElem = document.querySelector("#project");
        const requestByElem = document.querySelector("#requestby");
        const subjectElem = document.querySelector("#subject");

        document.querySelector("#ASSIGNED_TO").value = extractText(
          assignedToElem.textContent,
          13,
        );
        document.querySelector("#DUE_DATE").value = extractText(
          dueDateElem.textContent,
          10,
        );
        document.querySelector("#PROJECT_ID").value = extractText(
          projectElem.textContent,
          9,
        ).split(" ")[0];
        document.querySelector("#REQUESTED_BY").value = extractText(
          requestByElem.textContent,
          11,
        );
        document.querySelector("#SUBJECT").value = extractText(
          subjectElem.textContent,
          9,
        );

        showForm("editInputForm");
      });

      // Handle save detail
      const saveDetailBtn = document.getElementById("saveDetail");
      if (saveDetailBtn) {
        saveDetailBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          const data = {
            INPUT_ID: iid,
            ASSIGNED_TO: document.querySelector("#ASSIGNED_TO").value,
            DUE_DATE: document.querySelector("#DUE_DATE").value,
            PROJECT_ID: document.querySelector("#PROJECT_ID").value,
            REQUESTED_BY: document.querySelector("#REQUESTED_BY").value,
            SUBJECT: document.querySelector("#SUBJECT").value,
            MODIFIED_DATE: getDateTime(),
            MODIFIED_BY: user,
          };
          try {
            await fetch(`${apiUrls.input}detail/${iid}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data }),
            });
            hideForm("editInputForm");
            await updateAfterSave();
          } catch (err) {
            console.error("Failed saving detail:", err);
            alert("Failed to save detail: " + (err.message || err));
          }
        });
      }

      // Handle cancel detail
      const cancelDetail = document.getElementById("cancelDetail");
      if (cancelDetail) {
        cancelDetail.addEventListener("click", () => hideForm("editInputForm"));
      }
    }

    // ===== Email Handler =====
    const btnFollowUp = document.querySelector("#btnFollowUp");
    if (btnFollowUp) {
      btnFollowUp.addEventListener("click", (event) => {
        event.preventDefault();
        const emailCommentText = document.getElementById("emailCommentText");
        if (emailCommentText) emailCommentText.value = "";
        showForm("editEmailForm");
      });

      // Handle save/send email
      const saveEmailBtn = document.getElementById("saveEmailComment");
      if (saveEmailBtn) {
        saveEmailBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          const assignedToText = extractText(
            document.querySelector("#assignedto").textContent,
            13,
          );
          const userEmail = userEmails[assignedToText] ?? userEmails["DEFAULT"];
          const actionNoteElem = document.querySelector("#actionNote");
          const followUpNoteElem = document.querySelector("#followUpNote");
          const projectText = extractText(
            document.querySelector("#project").textContent,
            9,
          ).split(" ")[0];
          const emailCommentText = document.getElementById("emailCommentText");
          const emailData = {
            INPUT_ID: iid,
            from: "quality@ci-aviation.com",
            to: userEmail,
            subject: `Action Item Updated: ${iid}`,
            text: `Project: ${projectText}\n\nAction: \n\n${actionNoteElem?.innerText ?? ""}\n\nFollow-up: \n\n${followUpNoteElem?.innerText ?? ""}\n\nEmail comment: ${emailCommentText?.value || ""}`,
          };
          // Send email (fire-and-forget)
          fetch(`${apiUrls.input}email/${iid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: emailData }),
          }).catch((err) => console.error("Error sending email:", err));
          // Update notification table
          const notifyData = {
            INPUT_ID: iid,
            ASSIGNED_TO: assignedToText,
            ACTION: "R",
          };
          try {
            await fetch(`${apiUrls.input}inputs_notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data: notifyData }),
            });
          } catch (err) {
            console.error("Error updating inputs_notify:", err);
          }
          hideForm("editEmailForm");
          await updateAfterSave();
        });
      }

      // Handle cancel email
      const cancelEmail = document.getElementById("cancelEmail");
      if (cancelEmail) {
        cancelEmail.addEventListener("click", () => hideForm("editEmailForm"));
      }
    }

    // ==== END OF MAIN FETCH HANDLER ====
    // Load and display resources
    async function loadResources() {
      try {
        const resourcesResponse = await fetch(
          `${apiUrls.input}${iid}/resources`,
        );
        if (!resourcesResponse.ok) {
          // 404 or other error - just return empty array
          return [];
        }
        return await resourcesResponse.json();
      } catch (err) {
        console.error("Error loading resources:", err);
        return [];
      }
    }

    // Display resources in a table
    function displayResources(resources) {
      const resourcesSection = document.getElementById("resourcesSection");
      if (!resourcesSection) return;

      const resourcesTable = resourcesSection.querySelector(
        "#resourcesTable tbody",
      );
      if (!resourcesTable) return;

      // Clear existing rows
      resourcesTable.innerHTML = "";

      if (resources.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td colspan="8" style="text-align: center; color: #999;">No resources added yet</td>';
        resourcesTable.appendChild(tr);
        return;
      }

      resources.forEach((resource) => {
        const tr = document.createElement("tr");
        const extAmount = calculateExtendedAmount(resource);

        tr.innerHTML = `
          <td>${resource.RESOURCE_TYPE || ""}</td>
          <td>${resource.description || ""}</td>
          <td style="text-align: right;">${(parseFloat(resource.quantity) || 0).toFixed(2)}</td>
          <td>${resource.QUANTITY_UNIT || ""}</td>
          <td style="text-align: right;">${(parseFloat(resource.hours) || 0).toFixed(2)}</td>
          <td style="text-align: right;">$${(parseFloat(resource.rate) || 0).toFixed(2)}</td>
          <td style="text-align: right;">$${extAmount.toFixed(2)}</td>
          <td>
            <button class="btn btn-sm btn-primary editResourceBtn" data-id="${resource.id}">Edit</button>
            <button class="btn btn-sm btn-danger deleteResourceBtn" data-id="${resource.id}">Delete</button>
          </td>
        `;
        resourcesTable.appendChild(tr);
      });

      // Add event listeners to edit and delete buttons
      document.querySelectorAll(".editResourceBtn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const resourceId = btn.dataset.id;

          const resource = resources.find((r) => r.id == resourceId);

          if (resource) {
            document.getElementById("dialogTitle").textContent =
              "Edit Resource";
            populateResourceForm(resource);
            showForm("editResourceForm");
          } else {
            console.error(
              "[Edit Resource] Resource not found with id:",
              resourceId,
            );
          }
        });
      });

      document.querySelectorAll(".deleteResourceBtn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const resourceId = btn.dataset.id;
          if (
            confirm(
              "Are you sure you want to delete this resource? This cannot be undone.",
            )
          ) {
            await deleteResource(resourceId);
            const updatedResources = await loadResources();
            displayResources(updatedResources);
          }
        });
      });
    }

    function calculateExtendedAmount(resource) {
      const hours = parseFloat(resource.hours) || 0;
      const quantity = parseFloat(resource.quantity) || 0;
      const rate = parseFloat(resource.rate) || 0;

      if (hours > 0) {
        return hours * rate;
      }
      return quantity * rate;
    }

    function populateResourceForm(resource) {
      document.getElementById("resourceId").value = resource.id || "";
      document.getElementById("resourceType").value =
        resource.RESOURCE_TYPE || "";
      document.getElementById("resourceDescription").value =
        resource.description || "";
      document.getElementById("resourceQuantity").value =
        resource.quantity || 0;
      document.getElementById("resourceQuantityUnit").value =
        resource.QUANTITY_UNIT || "";
      document.getElementById("resourceHours").value = resource.hours || 0;
      document.getElementById("resourceRate").value = resource.rate || 0;
    }

    function clearResourceForm() {
      document.getElementById("resourceId").value = "";
      document.getElementById("resourceType").value = "";
      document.getElementById("resourceDescription").value = "";
      document.getElementById("resourceQuantity").value = 1;
      document.getElementById("resourceQuantityUnit").value = "";
      document.getElementById("resourceHours").value = 0;
      document.getElementById("resourceRate").value = 0;
    }

    async function saveResource() {
      const resourceId = document.getElementById("resourceId").value;
      const resourceType = document.getElementById("resourceType").value;
      const description = document.getElementById("resourceDescription").value;
      const quantity = parseFloat(
        document.getElementById("resourceQuantity").value || 0,
      );
      const quantityUnit = document.getElementById(
        "resourceQuantityUnit",
      ).value;
      const hours = parseFloat(
        document.getElementById("resourceHours").value || 0,
      );
      const rate = parseFloat(
        document.getElementById("resourceRate").value || 0,
      );

      if (!resourceType) {
        alert("Please select a resource type");
        return;
      }
      if (rate === 0 || isNaN(rate)) {
        alert("Please enter a rate/price");
        return;
      }

      const amount = calculateExtendedAmount({
        hours,
        quantity,
        rate,
      });

      const resourceData = {
        actionId: iid,
        projectId: rec["PROJECT_ID"] || "",
        resourceType,
        description,
        quantity: quantity || 0,
        quantityUnit,
        hours: hours || 0,
        rate,
        amount,
      };

      try {
        let response;
        if (resourceId) {
          // Update existing resource
          response = await fetch(
            `${apiUrls.input}${iid}/resources/${resourceId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resourceData),
            },
          );
        } else {
          // Create new resource
          response = await fetch(`${apiUrls.input}${iid}/resources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resourceData),
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        hideForm("editResourceForm");
        clearResourceForm();
        const updatedResources = await loadResources();
        displayResources(updatedResources);
      } catch (err) {
        console.error("Error saving resource:", err);
        alert("Failed to save resource: " + (err.message || err));
      }
    }

    async function deleteResource(resourceId) {
      try {
        await fetch(`${apiUrls.input}${iid}/resources/${resourceId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Error deleting resource:", err);
        alert("Failed to delete resource: " + (err.message || err));
      }
    }
  });
