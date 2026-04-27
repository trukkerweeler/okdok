/**
 * Migration: Create leases table and lease_tenants junction table
 * Run with: node seed/create-leases-table.js
 */

const db = require("../repositories/db");

const createLeasesTables = async () => {
  try {
    console.log("Creating leases tables...\n");

    // Check if leases table already exists
    let sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'leases'`;
    let results = await db.query(sql);

    if (results.length > 0) {
      console.log("✓ leases table already exists");
    } else {
      // Create leases table
      sql = `CREATE TABLE leases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_id INT NOT NULL,
        lease_number VARCHAR(50) UNIQUE NOT NULL,
        lease_start DATE NOT NULL,
        lease_end DATE,
        monthly_rent DECIMAL(10, 2) NOT NULL,
        security_deposit DECIMAL(10, 2),
        status ENUM('active', 'ended', 'pending') DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
        INDEX idx_property_id (property_id),
        INDEX idx_status (status),
        INDEX idx_lease_start (lease_start)
      )`;
      await db.query(sql);
      console.log("✓ Created leases table");
    }

    // Check if lease_tenants table already exists
    sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'lease_tenants'`;
    results = await db.query(sql);

    if (results.length > 0) {
      console.log("✓ lease_tenants table already exists");
    } else {
      // Create lease_tenants junction table
      sql = `CREATE TABLE lease_tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lease_id INT NOT NULL,
        tenant_id INT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_lease_tenant (lease_id, tenant_id),
        INDEX idx_lease_id (lease_id),
        INDEX idx_tenant_id (tenant_id)
      )`;
      await db.query(sql);
      console.log("✓ Created lease_tenants junction table");
    }

    console.log("\n✓ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
};

createLeasesTables();
