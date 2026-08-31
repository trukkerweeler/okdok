/**
 * Migration: Create tenant_credits and tenant_credit_applications tables
 * Tracks tenant overpayments as reusable credit toward future invoices
 * Run: node seed/create-tenant-credits-table.js
 */
const db = require("../repositories/db");

async function createTenantCreditsTables() {
  try {
    console.log("Creating tenant_credits table...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS tenant_credits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        source_invoice_id INT,
        source_payment_id INT,
        amount DECIMAL(10, 2) NOT NULL,
        remaining_amount DECIMAL(10, 2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (source_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
        FOREIGN KEY (source_payment_id) REFERENCES invoice_payments(id) ON DELETE SET NULL,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_remaining_amount (remaining_amount)
      )
    `);
    console.log("✓ tenant_credits table created successfully");

    console.log("Creating tenant_credit_applications table...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS tenant_credit_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        credit_id INT NOT NULL,
        invoice_id INT NOT NULL,
        payment_id INT,
        amount_applied DECIMAL(10, 2) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (credit_id) REFERENCES tenant_credits(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE SET NULL,
        INDEX idx_credit_id (credit_id),
        INDEX idx_invoice_id (invoice_id)
      )
    `);
    console.log("✓ tenant_credit_applications table created successfully");
  } catch (error) {
    console.error("Error creating tenant credit tables:", error.message);
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("✓ Tenant credit tables already exist");
    } else {
      throw error;
    }
  }
}

(async () => {
  try {
    await createTenantCreditsTables();
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
