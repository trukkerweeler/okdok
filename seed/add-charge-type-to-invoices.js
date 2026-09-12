/**
 * Migration: Add charge_type column to invoices table
 * Replaces fragile "description contains 'deposit'" text matching with a real,
 * explicit charge type that drives which ledger account a payment posts to.
 * Run: node seed/add-charge-type-to-invoices.js
 */
const db = require("../repositories/db");

const CHARGE_TYPES = [
  "rent",
  "security_deposit",
  "pet_deposit",
  "late_fee",
  "pet_fee",
  "utility_reimbursement",
  "application_fee",
  "other_income",
];

async function addChargeTypeColumn() {
  try {
    console.log("Adding charge_type column to invoices...");

    const sql = `
      ALTER TABLE invoices
      ADD COLUMN charge_type ENUM(${CHARGE_TYPES.map((t) => `'${t}'`).join(", ")})
      DEFAULT 'rent' AFTER description
    `;

    await db.query(sql);
    console.log("✓ charge_type column added successfully!");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("✓ charge_type column already exists");
    } else {
      throw error;
    }
  }

  // Backfill existing rows that were relying on description text for deposits
  const result = await db.query(
    `UPDATE invoices SET charge_type = 'security_deposit'
     WHERE charge_type = 'rent' AND LOWER(description) LIKE '%deposit%'`,
  );
  console.log(
    `✓ Backfilled ${result.affectedRows || 0} existing invoice(s) with description containing "deposit"`,
  );
}

(async () => {
  try {
    await addChargeTypeColumn();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
