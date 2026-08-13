/**
 * Migration: Add PM Operating Expense Account
 * Adds the PM Operating Expense account to the chart of accounts.
 * This account is debited when PM company operating expenses are recorded in the ledger.
 * Run with: node seed/add-pm-operating-expense-account.js
 */
const db = require("../repositories/db");

async function addPmOperatingExpenseAccount() {
  try {
    console.log("Checking for PM Operating Expense account...");

    const existing = await db.query(
      "SELECT id FROM accounts WHERE name = 'PM Operating Expense'",
    );

    if (existing.length > 0) {
      console.log(
        "✓ PM Operating Expense account already exists (id=" +
          existing[0].id +
          ")",
      );
      process.exit(0);
    }

    await db.query(
      `INSERT INTO accounts (owner_id, property_id, type, name, created_at, updated_at)
       VALUES (NULL, NULL, 'expense', 'PM Operating Expense', NOW(), NOW())`,
    );

    console.log("✓ Created account: PM Operating Expense (expense)");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

addPmOperatingExpenseAccount();
