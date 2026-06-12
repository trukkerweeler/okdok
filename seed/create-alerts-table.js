/**
 * Alerts Table Migration
 * Creates the alerts table for scheduled SMS reminders (via email-to-SMS gateway)
 * Run: node seed/create-alerts-table.js
 */

const db = require("../repositories/db");

async function createAlertsTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        phone_number VARCHAR(15) NOT NULL,
        carrier VARCHAR(50) NOT NULL,
        day_of_month TINYINT NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        last_sent_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT chk_day_of_month CHECK (day_of_month BETWEEN 1 AND 28),
        INDEX idx_day_of_month (day_of_month),
        INDEX idx_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await db.query(sql);
    console.log("✅ Alerts table created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating alerts table:", error.message);
    process.exit(1);
  }
}

createAlertsTable();
