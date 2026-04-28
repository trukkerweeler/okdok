/**
 * Mileage Tracking Table Migration
 * Run this to create the mileage_log table
 */

const db = require("../repositories/db");

async function createMileageTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS mileage_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        miles_driven DECIMAL(8, 1) NOT NULL,
        starting_location VARCHAR(255),
        ending_location VARCHAR(255),
        purpose VARCHAR(255) NOT NULL,
        category ENUM('property_visit', 'tenant_meeting', 'maintenance', 'supply_run', 'posting', 'inspection', 'showing', 'other') NOT NULL,
        property_id INT,
        owner_id INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
        FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE SET NULL,
        INDEX idx_date (date),
        INDEX idx_property_id (property_id),
        INDEX idx_owner_id (owner_id),
        INDEX idx_category (category),
        INDEX idx_created_at (created_at)
      )
    `;

    await db.query(sql);
    console.log("✓ Mileage log table created successfully");
  } catch (error) {
    console.error("Error creating mileage_log table:", error.message);
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("✓ Mileage log table already exists");
    } else {
      throw error;
    }
  }
}

// Run migration
(async () => {
  try {
    await createMileageTable();
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
