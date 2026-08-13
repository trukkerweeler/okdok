/**
 * Migration: Add ledger_entry_id column to pm_expenses and backfill historical entries.
 *
 * This script is idempotent — safe to re-run. It only posts entries for pm_expenses
 * that have no ledger_entry_id, so already-posted rows are never duplicated.
 *
 * Run with: node seed/backfill-pm-expense-ledger-entries.js
 *
 * Prerequisites:
 *   node seed/add-pm-operating-expense-account.js  (must run first)
 */
const db = require("../repositories/db");

async function run() {
  try {
    // -------------------------------------------------------
    // 1. Add ledger_entry_id column if it doesn't exist
    // -------------------------------------------------------
    const cols = await db.query(
      "SHOW COLUMNS FROM pm_expenses LIKE 'ledger_entry_id'",
    );
    if (cols.length === 0) {
      await db.query(
        "ALTER TABLE pm_expenses ADD COLUMN ledger_entry_id INT NULL",
      );
      console.log("✓ Added ledger_entry_id column to pm_expenses");
    } else {
      console.log("✓ Column ledger_entry_id already exists");
    }

    // -------------------------------------------------------
    // 2. Resolve required accounts
    // -------------------------------------------------------
    const pmExpAcctRows = await db.query(
      "SELECT id FROM accounts WHERE name = 'PM Operating Expense'",
    );
    const pmCashAcctRows = await db.query(
      "SELECT id FROM accounts WHERE name = 'PM Operating Cash'",
    );

    if (!pmExpAcctRows.length || !pmCashAcctRows.length) {
      console.error(
        "Required accounts not found. Run add-pm-operating-expense-account.js first.",
      );
      process.exit(1);
    }

    const debitId = pmExpAcctRows[0].id;
    const creditId = pmCashAcctRows[0].id;

    // -------------------------------------------------------
    // 3. Find all pm_expenses not yet posted to the ledger
    // -------------------------------------------------------
    const unposted = await db.query(
      "SELECT * FROM pm_expenses WHERE ledger_entry_id IS NULL ORDER BY date ASC, id ASC",
    );

    if (unposted.length === 0) {
      console.log(
        "✓ All PM expenses already have ledger entries. Nothing to backfill.",
      );
      process.exit(0);
    }

    console.log(`Backfilling ${unposted.length} PM expense(s)...`);

    let posted = 0;
    let failed = 0;

    for (const exp of unposted) {
      try {
        const rawDate = exp.date;
        const dateStr =
          rawDate instanceof Date
            ? rawDate.toISOString().slice(0, 10)
            : rawDate
              ? String(rawDate).slice(0, 10)
              : new Date().toISOString().slice(0, 10);
        const memo = `PM expense: ${exp.description} [${exp.category}]`;

        const result = await db.query(
          `INSERT INTO ledger_entries
             (date, debit_account_id, credit_account_id, amount, memo, vendor_id, created_at)
           VALUES (CAST(? AS DATE), ?, ?, ?, ?, ?, NOW())`,
          [dateStr, debitId, creditId, exp.amount, memo, exp.vendor_id || null],
        );

        await db.query(
          "UPDATE pm_expenses SET ledger_entry_id = ? WHERE id = ?",
          [result.insertId, exp.id],
        );

        console.log(
          `  ✓ #${exp.id}  ${dateStr}  $${parseFloat(exp.amount).toFixed(2)}  ${exp.description}`,
        );
        posted++;
      } catch (err) {
        console.error(`  ✗ #${exp.id} failed: ${err.message}`);
        failed++;
      }
    }

    console.log(`\nDone. ${posted} posted, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

run();
