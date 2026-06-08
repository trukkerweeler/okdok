/**
 * Database Migration: Add Distribution Fees Tracking
 *
 * Creates a distribution_fees junction table so management fees can be
 * linked to a specific distribution and shown on the reconciliation report.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
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

  const createTable = `
    CREATE TABLE IF NOT EXISTS distribution_fees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      distribution_id INT NOT NULL,
      fee_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (distribution_id) REFERENCES ledger_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_id) REFERENCES ledger_entries(id) ON DELETE CASCADE,
      INDEX idx_dist_fees_distribution_id (distribution_id),
      INDEX idx_dist_fees_fee_id (fee_id),
      UNIQUE KEY unique_distribution_fee (distribution_id, fee_id)
    )
  `;

  connection.query(createTable, (err) => {
    if (err) throw err;
    console.log("✓ Created distribution_fees table");
    connection.end();
    console.log("Migration complete.");
  });
});
