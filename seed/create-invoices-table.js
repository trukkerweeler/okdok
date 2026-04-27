/**
 * Invoice Table Migration
 * Run this once to create the invoices table
 */

const db = require("../repositories/db");

async function createInvoicesTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_id INT,
        tenant_id INT,
        owner_id INT NOT NULL,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE,
        description VARCHAR(255),
        status ENUM('pending', 'sent', 'paid', 'cancelled') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
        FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
        INDEX idx_owner_id (owner_id),
        INDEX idx_property_id (property_id),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `;

    await db.query(sql);
    console.log("✓ Invoices table created successfully");
  } catch (error) {
    console.error("Error creating invoices table:", error.message);
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("✓ Invoices table already exists");
    } else {
      throw error;
    }
  }
}

// Run migration
(async () => {
  try {
    await createInvoicesTable();
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
