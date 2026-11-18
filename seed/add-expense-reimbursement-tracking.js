/**
 * Database Migration: Add Expense Reimbursement Tracking
 *
 * This migration adds the ability to track which expenses have been reimbursed
 * and link distributions to specific expenses.
 *
 * Changes:
 * 1. Add reimbursement_status column to ledger_entries
 * 2. Create distribution_expenses junction table
 */

const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "okdok",
});

connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");

  // Step 1: Add reimbursement tracking columns to ledger_entries
  const addStatusColumn = `
    ALTER TABLE ledger_entries
    ADD COLUMN reimbursement_status ENUM('unreimbursed', 'partially_reimbursed', 'reimbursed')
    DEFAULT 'unreimbursed' AFTER vendor_id
  `;

  connection.query(addStatusColumn, (err) => {
    if (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("✓ Column reimbursement_status already exists");
      } else {
        throw err;
      }
    } else {
      console.log("✓ Added reimbursement_status column to ledger_entries");
    }

    const modifyStatusColumn = `
      ALTER TABLE ledger_entries
      MODIFY COLUMN reimbursement_status ENUM('unreimbursed', 'partially_reimbursed', 'reimbursed')
      DEFAULT 'unreimbursed'
    `;

    const addReimbursedAmountColumn = `
      ALTER TABLE ledger_entries
      ADD COLUMN reimbursed_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER reimbursement_status
    `;

    connection.query(modifyStatusColumn, (err) => {
      if (err) throw err;
      console.log("✓ reimbursement_status enum includes partially_reimbursed");

    connection.query(addReimbursedAmountColumn, (err) => {
      if (err) {
        if (err.code === "ER_DUP_FIELDNAME") {
          console.log("✓ Column reimbursed_amount already exists");
        } else {
          throw err;
        }
      } else {
        console.log("✓ Added reimbursed_amount column to ledger_entries");
      }

      // Step 2: Create distribution_expenses junction table
      const createJunctionTable = `
        CREATE TABLE IF NOT EXISTS distribution_expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          distribution_id INT NOT NULL,
          expense_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (distribution_id) REFERENCES ledger_entries(id) ON DELETE CASCADE,
          FOREIGN KEY (expense_id) REFERENCES ledger_entries(id) ON DELETE CASCADE,
          INDEX idx_distribution_id (distribution_id),
          INDEX idx_expense_id (expense_id),
          UNIQUE KEY unique_distribution_expense (distribution_id, expense_id)
        )
      `;

      connection.query(createJunctionTable, (err) => {
        if (err) throw err;
        console.log("✓ Created distribution_expenses junction table");

        const backfill = `
          UPDATE ledger_entries SET reimbursed_amount = amount
          WHERE reimbursement_status = 'reimbursed' AND reimbursed_amount = 0
        `;
        connection.query(backfill, (err, result) => {
        if (err) throw err;
        console.log(`✓ Backfilled reimbursed_amount for ${result.affectedRows} rows`);

        connection.end(() => {
          console.log("\n✅ Migration complete!");
          console.log(
            "\nNow run: node seed/sample-data.js (if needed to refresh test data)",
          );
        });
        });
      });
    });
    });
  });
});
