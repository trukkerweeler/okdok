const db = require("../repositories/db");

async function addInvoiceLineItemsTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS invoice_line_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        category VARCHAR(50) NULL,
        amount DECIMAL(10, 2) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        INDEX idx_invoice_id (invoice_id),
        INDEX idx_invoice_line_item_category (category)
      )
    `;
    await db.query(sql);
    const categoryColumns = await db.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'invoice_line_items'
         AND COLUMN_NAME = 'category'`,
    );
    if (Number(categoryColumns[0]?.count) === 0) {
      await db.query(
        "ALTER TABLE invoice_line_items ADD COLUMN category VARCHAR(50) AFTER description",
      );
    }

    const categoryIndexes = await db.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'invoice_line_items'
         AND INDEX_NAME = 'idx_invoice_line_item_category'`,
    );
    if (Number(categoryIndexes[0]?.count) === 0) {
      await db.query(
        "ALTER TABLE invoice_line_items ADD INDEX idx_invoice_line_item_category (category)",
      );
    }
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
