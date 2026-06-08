/**
 * Migration: Create transaction_receipts table for owner expense receipts
 * Run: node seed/add-transaction-receipts-table.js
 */
const db = require("../repositories/db");

async function createTransactionReceiptsTable() {
  try {
    console.log("Creating transaction_receipts table...");

    const sql = `
      CREATE TABLE IF NOT EXISTS transaction_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ledger_id INT NOT NULL,
        file_blob LONGBLOB NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        file_size INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (ledger_id) REFERENCES ledger_entries(id) ON DELETE CASCADE,
        INDEX idx_ledger_id (ledger_id),
        INDEX idx_created_at (created_at)
      );
    `;

    await db.query(sql);
    console.log("✓ transaction_receipts table created successfully!");
    console.log("✓ Ready for transaction receipt storage");
    process.exit(0);
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }
}

createTransactionReceiptsTable();
