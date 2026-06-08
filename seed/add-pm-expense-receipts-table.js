/**
 * Migration: Create pm_expense_receipts table for expense document storage
 * Stores receipt files, invoices, and supporting documentation for PM expenses
 * Run: node seed/add-pm-expense-receipts-table.js
 */
const db = require("../repositories/db");

async function createPmExpenseReceiptsTable() {
  try {
    console.log("Creating pm_expense_receipts table...");

    const sql = `
      CREATE TABLE IF NOT EXISTS pm_expense_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pm_expense_id INT NOT NULL,
        receipt_type VARCHAR(50) NOT NULL DEFAULT 'receipt',
        file_blob LONGBLOB NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        file_size INT NOT NULL,
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (pm_expense_id) REFERENCES pm_expenses(id) ON DELETE CASCADE,
        INDEX idx_expense_id (pm_expense_id),
        INDEX idx_receipt_type (receipt_type),
        INDEX idx_created_at (created_at)
      );
    `;

    await db.query(sql);
    console.log("✓ pm_expense_receipts table created successfully!");
    console.log("✓ Ready for receipt uploads and document storage");
    process.exit(0);
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }
}

createPmExpenseReceiptsTable();
