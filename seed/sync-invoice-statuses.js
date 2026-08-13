/**
 * Migration: Sync invoice statuses with payment data
 * Reconciles invoice statuses to match remaining balance:
 * - paid when balance <= 0
 * - pending when balance > 0
 * Cancelled invoices are preserved as cancelled.
 * Run: node seed/sync-invoice-statuses.js
 */
const db = require("../repositories/db");

async function syncInvoiceStatuses() {
  try {
    console.log("Syncing invoice statuses with payment data...\n");

    // Get all invoices
    const invoices = await db.query(`
      SELECT 
        i.id,
        i.invoice_number,
        i.amount,
        i.status,
        COALESCE(SUM(p.amount_paid), 0) as total_paid
      FROM invoices i
      LEFT JOIN invoice_payments p ON i.id = p.invoice_id
      GROUP BY i.id
      ORDER BY i.invoice_number
    `);

    let updated = 0;
    let skipped = 0;
    let cancelledPreserved = 0;

    for (const invoice of invoices) {
      const balance = invoice.amount - invoice.total_paid;
      const targetStatus = balance <= 0 ? "paid" : "pending";

      if (invoice.status === "cancelled") {
        cancelledPreserved++;
        continue;
      }

      if (invoice.status !== targetStatus) {
        // Reconcile to balance-driven status
        await db.query(
          `UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?`,
          [targetStatus, invoice.id],
        );
        console.log(
          `✓ ${invoice.invoice_number}: Updated to ${targetStatus.toUpperCase()} (paid: $${invoice.total_paid}, amount: $${invoice.amount}, balance: $${balance})`,
        );
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n✓ Migration complete!`);
    console.log(`  Updated: ${updated} invoices`);
    console.log(`  Already correct: ${skipped} invoices`);
    console.log(`  Cancelled preserved: ${cancelledPreserved} invoices`);
    process.exit(0);
  } catch (error) {
    console.error("Error syncing invoice statuses:", error);
    process.exit(1);
  }
}

syncInvoiceStatuses();
