import { loadHeaderFooter, getApiUrl, getSessionUser } from "/js/utils.mjs";

// Initialize header/footer
loadHeaderFooter();

class InputCopyManager {
  constructor() {
    this.copyDialog = null;
    this.copyForm = null;
    this.copyBtn = null;
    this.closeBtn = null;
    this.resultsContainer = null;
    this.apiUrl = ""; // Will be initialized in init
    this.user = null;
  }

  async init() {
    // Get current user and api URL
    this.apiUrl = await getApiUrl();
    this.user = await getSessionUser();

    // Initialize DOM elements
    this.copyDialog = document.getElementById("copyInputDialog");
    this.copyForm = document.getElementById("copyInputForm");
    this.copyBtn = document.getElementById("copyInputBtn");
    this.closeBtn = document.getElementById("closeCopyBtn");
    this.resultsContainer = document.getElementById("copyResultsContainer");

    this.setupEventListeners();
    this.setDefaultDate();
  }

  setupEventListeners() {
    // Copy button to open dialog
    this.copyBtn.addEventListener("click", () => {
      this.openCopyDialog();
    });

    // Close button
    this.closeBtn.addEventListener("click", () => {
      this.closeCopyDialog();
    });

    // Form submission
    this.copyForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleCopySubmit();
    });

    // Close dialog when clicking outside
    this.copyDialog.addEventListener("click", (e) => {
      if (e.target === this.copyDialog) {
        this.closeCopyDialog();
      }
    });

    // Handle ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.copyDialog.open) {
        this.closeCopyDialog();
      }
    });
  }

  setDefaultDate() {
    // Set today's date as default
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("copydate").value = today;
  }

  openCopyDialog() {
    this.copyForm.reset();
    this.setDefaultDate();
    this.copyDialog.showModal();
    // Focus on first input
    document.getElementById("copyid").focus();
  }

  closeCopyDialog() {
    this.copyDialog.close();
  }

  async handleCopySubmit() {
    try {
      const formData = new FormData(this.copyForm);
      const copyId = formData.get("copyid").trim();
      const copyDate = formData.get("copydate");
      const dueDays = parseInt(formData.get("duedays"));

      // Validate inputs
      if (!copyId || !copyDate || !dueDays) {
        alert("Please fill in all required fields.");
        return;
      }

      // Show loading state
      this.setButtonLoading(true);

      // Get the next available ID
      const inputUrl = `${this.apiUrl}/input`;
      const nextId = await this.getNextId(inputUrl);

      // Get the original input record
      const originalInput = await this.getOriginalInput(inputUrl, copyId);

      if (!originalInput || originalInput.length === 0) {
        throw new Error("Source input record not found");
      }

      // Create the new input record
      const newInput = await this.createNewInputRecord(
        originalInput[0],
        nextId,
        copyDate,
        dueDays,
      );

      // Submit the new record
      await this.submitNewRecord(inputUrl, newInput);

      // Show success and close dialog
      this.showSuccessMessage(
        `Input record copied successfully! New ID: ${nextId}`,
      );
      this.closeCopyDialog();
    } catch (error) {
      console.error("Error copying input record:", error);
      alert(`Error copying input record: ${error.message}`);
    } finally {
      this.setButtonLoading(false);
    }
  }

  async getNextId(inputUrl) {
    const response = await fetch(`${inputUrl}/nextId`, { method: "GET" });
    if (!response.ok) {
      throw new Error("Failed to get next ID");
    }
    return await response.json();
  }

  async getOriginalInput(inputUrl, copyId) {
    const paddedId = copyId.toString().padStart(7, "0");
    const response = await fetch(`${inputUrl}/${paddedId}`, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Failed to find input record ${copyId}`);
    }
    return await response.json();
  }

  async createNewInputRecord(originalInput, nextId, copyDate, dueDays) {
    // Calculate due date
    const dueDate = new Date(copyDate);
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Create new input record based on original
    const newInput = {
      ...originalInput,
      INPUT_ID: nextId,
      INPUT_DATE: copyDate,
      DUE_DATE: dueDate.toISOString().slice(0, 10),
      CREATE_DATE: new Date().toISOString().slice(0, 10),
      CREATE_BY: this.user || "WEB",
      CLOSED: "N",
    };

    // Remove fields that shouldn't be copied
    delete newInput.RESPONSE_TEXT;
    delete newInput.CLOSED_DATE;
    delete newInput.MODIFIED_DATE;
    delete newInput.MODIFIED_BY;

    return newInput;
  }

  async submitNewRecord(inputUrl, newInput) {
    const response = await fetch(inputUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newInput),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create new input record: ${errorText}`);
    }

    return await response.json();
  }

  setButtonLoading(isLoading) {
    const submitBtn = document.getElementById("executeCopyBtn");
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Copying...';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML =
        '<span class="btn-icon">📋</span> Copy Input Record';
    }
  }

  showSuccessMessage(message) {
    // Update results container with success message
    this.resultsContainer.innerHTML = `
            <div class="success-message">
                <h3>✅ Success!</h3>
                <p>${message}</p>
                <p><a href="/inputs.html" class="btn btn-primary">View All Inputs</a></p>
            </div>
        `;

    // Also show temporary toast notification
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.textContent = message;
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;

    document.body.appendChild(toast);

    // Remove toast after 5 seconds
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
}

// Initialize the input copy manager
const inputCopyManager = new InputCopyManager();

// Start the application
document.addEventListener("DOMContentLoaded", () => {
  inputCopyManager.init();
});

// Export for potential use in other modules
export default inputCopyManager;
