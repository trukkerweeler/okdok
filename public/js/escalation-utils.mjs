import { getApiUrl } from "./utils.mjs";

// Calculate days overdue (positive if past due)
export function calculateDaysOverdue(dueDateStr) {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const today = new Date();
  // zero time portion
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

// Create a simple escalation button. Caller may style or hide it.
export function createEscalationButton(
  module,
  id,
  subject,
  assignedTo,
  daysOverdue,
  user,
  onSuccess,
) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-warning";
  btn.textContent = `Escalate (${daysOverdue})`;
  btn.addEventListener("click", async () => {
    try {
      const apiUrl = await getApiUrl();
      await fetch(`${apiUrl}/input/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          INPUT_ID: id,
          SUBJECT: subject,
          ASSIGNED_TO: assignedTo,
          INPUT_TEXT: `Escalation by ${user}`,
        }),
      });
      if (typeof onSuccess === "function") onSuccess();
    } catch (e) {
      console.error("Escalation failed", e);
      alert("Escalation failed");
    }
  });
  return btn;
}

// Return a container element with (optional) escalation history — keep minimal
export async function createEscalationHistory(module, id) {
  const div = document.createElement("div");
  div.className = "escalation-history";
  // attempt to fetch history if API available
  try {
    const apiUrl = await getApiUrl();
    const res = await fetch(
      `${apiUrl}/email-history?app_module=${encodeURIComponent(module)}&app_id=${encodeURIComponent(id)}`,
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const ul = document.createElement("ul");
        rows.forEach((r) => {
          const li = document.createElement("li");
          li.textContent = `${r.sent_by || ""} ${r.sent_at || ""} - ${r.subject || ""}`;
          ul.appendChild(li);
        });
        div.appendChild(ul);
      }
    }
  } catch (e) {
    // ignore; history is optional
  }
  return div;
}

export default {
  calculateDaysOverdue,
  createEscalationButton,
  createEscalationHistory,
};
