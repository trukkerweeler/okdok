/**
 * Migration: Add primary_tenant_id to properties table
 * Allows designating a primary tenant for each property
 * Run with: node seed/update-properties-add-primary-tenant.js
 */

const db = require("../repositories/db");

const addPrimaryTenantField = async () => {
  try {
    console.log("Adding primary_tenant_id field to properties table...\n");

    // Check if column already exists
    const sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_NAME = 'properties' AND COLUMN_NAME = 'primary_tenant_id'`;
    const results = await db.query(sql);

    if (results.length > 0) {
      console.log("✓ primary_tenant_id column already exists");
      return;
    }

    // Add the column
    const alterSql = `ALTER TABLE properties 
                      ADD COLUMN primary_tenant_id INT,
                      ADD FOREIGN KEY (primary_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL`;
    await db.query(alterSql);

    console.log(
      "✓ Successfully added primary_tenant_id column to properties table",
    );
    console.log("✓ Added foreign key constraint to tenants table");
    console.log("\nMigration complete!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
};

addPrimaryTenantField();
