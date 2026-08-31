/**
 * Migration: Fix lease numbers from broken format {property_id}-{YEAR}-101
 * to correct format {YEAR}-{global_sequence_starting_at_101}
 *
 * Ordering: leases are renumbered by id (creation order) within each year.
 * Example: 2-2026-101 → 2026-102, 5-2026-101 → 2026-105
 */

const db = require("../repositories/db");

async function fixLeaseNumbers() {
  const leases = await db.query(
    `SELECT id, lease_number, lease_start FROM leases ORDER BY id ASC`,
  );

  if (leases.length === 0) {
    console.log("No leases found.");
    return;
  }

  console.log(`Found ${leases.length} lease(s) to renumber.`);

  for (let i = 0; i < leases.length; i++) {
    const lease = leases[i];
    const year = new Date(lease.lease_start).getFullYear();
    const sequenceNumber = 101 + i;
    const newNumber = `${year}-${String(sequenceNumber).padStart(3, "0")}`;

    await db.query(`UPDATE leases SET lease_number = ? WHERE id = ?`, [
      newNumber,
      lease.id,
    ]);

    console.log(`  Lease ${lease.id}: ${lease.lease_number} → ${newNumber}`);
  }

  console.log("Done. All lease numbers updated.");
}

fixLeaseNumbers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
