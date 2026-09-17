/**
 * Migration: Add rent_period to invoices table
 * Run with: node --env-file=.env seed/add-rent-period-to-invoices.js
 *
 * rent_period stores the first day of the month a rent invoice covers
 * (e.g. an invoice billed/paid in August for July's rent has
 * rent_period = 2026-07-01). This lets reports distinguish "when paid"
 * from "what period the payment is for".
 */
const db = require("../repositories/db");

const addRentPeriodToInvoices = async () => {
  try {
    const existing = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'rent_period'`,
    );

    if (existing.length > 0) {
      console.log("✓ rent_period column already exists");
    } else {
      await db.query(
        `ALTER TABLE invoices
         ADD COLUMN rent_period DATE NULL AFTER due_date,
         ADD INDEX idx_rent_period (rent_period)`,
      );
      console.log("✓ Added rent_period column to invoices table");
    }

    // Backfill existing invoices: default rent_period to the invoice_date's month
    const result = await db.query(
      `UPDATE invoices
       SET rent_period = DATE_FORMAT(invoice_date, '%Y-%m-01')
       WHERE rent_period IS NULL`,
    );
    console.log(
      `✓ Backfilled rent_period for ${result.affectedRows || 0} existing invoice(s)`,
    );

    console.log("\n✓ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
};

addRentPeriodToInvoices();
