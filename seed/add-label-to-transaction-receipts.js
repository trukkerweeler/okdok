/**
 * Migration: Add label column to transaction_receipts
 * Run: node seed/add-label-to-transaction-receipts.js
 */
const db = require("../repositories/db");

async function addLabelToTransactionReceipts() {
  try {
    const existing = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'transaction_receipts' AND COLUMN_NAME = 'label'`,
    );

    if (existing.length > 0) {
      console.log("✓ label column already exists");
    } else {
      await db.query(
        `ALTER TABLE transaction_receipts
         ADD COLUMN label VARCHAR(50) NULL AFTER filename`,
      );
      console.log("✓ Added label column to transaction_receipts");
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
}

addLabelToTransactionReceipts();
