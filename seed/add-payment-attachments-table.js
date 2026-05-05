/**
 * Migration: Create payment_attachments table for check stubs and other documents
 * Run: node seed/add-payment-attachments-table.js
 */
const db = require("../repositories/db");

async function createPaymentAttachmentsTable() {
  try {
    console.log("Creating payment_attachments table...");

    const sql = `
      CREATE TABLE IF NOT EXISTS payment_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id INT NOT NULL,
        attachment_type VARCHAR(50) NOT NULL DEFAULT 'check_stub',
        file_blob LONGBLOB NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        file_size INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE CASCADE,
        INDEX idx_payment_id (payment_id),
        INDEX idx_attachment_type (attachment_type),
        INDEX idx_created_at (created_at)
      );
    `;

    await db.query(sql);
    console.log("✓ payment_attachments table created successfully!");
    console.log("✓ Ready for check stubs and future attachment types");
    process.exit(0);
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }
}

createPaymentAttachmentsTable();
