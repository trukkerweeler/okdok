/**
 * Migration: Sync invoice statuses with payment data
 * Updates all invoice statuses to "paid" if they have payments covering the full amount
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

    for (const invoice of invoices) {
      const balance = invoice.amount - invoice.total_paid;
      const shouldBePaid = balance <= 0;
      const isPaid = invoice.status === "paid";

      if (shouldBePaid && !isPaid) {
        // Update to paid
        await db.query(`UPDATE invoices SET status = 'paid' WHERE id = ?`, [
          invoice.id,
        ]);
        console.log(
          `✓ ${invoice.invoice_number}: Updated to PAID (paid: $${invoice.total_paid}, amount: $${invoice.amount})`,
        );
        updated++;
      } else if (!shouldBePaid && isPaid) {
        // Revert to pending
        await db.query(`UPDATE invoices SET status = 'pending' WHERE id = ?`, [
          invoice.id,
        ]);
        console.log(
          `✓ ${invoice.invoice_number}: Reverted to PENDING (paid: $${invoice.total_paid}, amount: $${invoice.amount})`,
        );
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n✓ Migration complete!`);
    console.log(`  Updated: ${updated} invoices`);
    console.log(`  Already correct: ${skipped} invoices`);
    process.exit(0);
  } catch (error) {
    console.error("Error syncing invoice statuses:", error);
    process.exit(1);
  }
}

syncInvoiceStatuses();
