const db = require("../repositories/db");

async function createNoticesTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notice_type VARCHAR(100) NOT NULL,
        notice_date DATE NOT NULL,
        tenant_id INT NULL,
        property_id INT NULL,
        tenant_name VARCHAR(255),
        tenant_mailing_address TEXT,
        property_address TEXT,
        amount_owed DECIMAL(12, 2) NOT NULL,
        rent_period_start DATE NULL,
        rent_period_end DATE NULL,
        landlord_name VARCHAR(255) NOT NULL,
        landlord_phone VARCHAR(50) NOT NULL,
        landlord_address TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        content_snapshot LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_notices_notice_date (notice_date),
        INDEX idx_notices_tenant_id (tenant_id),
        INDEX idx_notices_property_id (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Notices table created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error creating notices table:", error.message);
    process.exit(1);
  }
}

createNoticesTable();
