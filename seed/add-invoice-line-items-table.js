const db = require("../repositories/db");

async function addInvoiceLineItemsTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS invoice_line_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        INDEX idx_invoice_id (invoice_id)
      )
    `;
    await db.query(sql);
    console.log("✓ invoice_line_items table created successfully");
  } catch (error) {
    console.error("Error creating invoice_line_items table:", error.message);
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("✓ invoice_line_items table already exists");
    } else {
      throw error;
    }
  }
}

(async () => {
  try {
    await addInvoiceLineItemsTable();
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
