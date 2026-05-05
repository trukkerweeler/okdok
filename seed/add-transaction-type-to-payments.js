/**
 * Migration: Add transaction_type column to invoice_payments table
 * Run: node seed/add-transaction-type-to-payments.js
 */
const db = require("../repositories/db");

async function addTransactionTypeColumn() {
  try {
    console.log("Adding transaction_type column to invoice_payments...");

    const sql = `
      ALTER TABLE invoice_payments 
      ADD COLUMN transaction_type ENUM('tenant_to_manager', 'manager_to_owner') 
      DEFAULT 'tenant_to_manager' AFTER notes
    `;

    await db.query(sql);
    console.log("✓ transaction_type column added successfully!");
    console.log(
      "✓ Default value set to 'tenant_to_manager' for existing payments",
    );
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("✓ transaction_type column already exists");
      process.exit(0);
    } else {
      console.error("Error adding column:", error);
      process.exit(1);
    }
  }
}

addTransactionTypeColumn();
