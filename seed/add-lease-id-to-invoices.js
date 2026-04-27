/**
 * Migration: Add lease_id to invoices table
 * Run with: node seed/add-lease-id-to-invoices.js
 */

const db = require("../repositories/db");

const addLeaseIdToInvoices = async () => {
  try {
    console.log(
      "Updating invoices table to use leases instead of individual tenants...\n",
    );

    // Check if lease_id column already exists
    let sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'lease_id'`;
    let results = await db.query(sql);

    if (results.length > 0) {
      console.log("✓ lease_id column already exists");
    } else {
      // Add lease_id column
      sql = `ALTER TABLE invoices 
             ADD COLUMN lease_id INT AFTER property_id,
             ADD FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE SET NULL,
             ADD INDEX idx_lease_id (lease_id)`;
      await db.query(sql);
      console.log("✓ Added lease_id column to invoices table");
    }

    // Check if tenant_id column exists and drop it if not needed
    sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'tenant_id'`;
    results = await db.query(sql);

    if (results.length > 0) {
      // Drop the tenant_id foreign key constraint if it exists
      sql = `ALTER TABLE invoices DROP FOREIGN KEY invoices_ibfk_2`;
      try {
        await db.query(sql);
        console.log("✓ Removed tenant_id foreign key constraint");
      } catch (e) {
        // Constraint might have different name, that's ok
      }

      // Drop the tenant_id column
      sql = `ALTER TABLE invoices DROP COLUMN tenant_id`;
      await db.query(sql);
      console.log(
        "✓ Removed tenant_id column (tenants now retrieved from lease)",
      );
    }

    console.log("\n✓ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
};

addLeaseIdToInvoices();
