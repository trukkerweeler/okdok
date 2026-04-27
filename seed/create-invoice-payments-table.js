/**
 * Invoice Payments Table Migration
 * Run this to create the invoice_payments table
 */

const db = require("../repositories/db");

async function createPaymentsTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        payment_date DATE NOT NULL,
        amount_paid DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50),
        reference_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        INDEX idx_invoice_id (invoice_id),
        INDEX idx_payment_date (payment_date),
        INDEX idx_created_at (created_at)
      )
    `;

    await db.query(sql);
    console.log("✓ Invoice payments table created successfully");
  } catch (error) {
    console.error("Error creating invoice_payments table:", error.message);
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("✓ Invoice payments table already exists");
    } else {
      throw error;
    }
  }
}

// Run migration
(async () => {
  try {
    await createPaymentsTable();
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
