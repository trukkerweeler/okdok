const db = require("../repositories/db");

async function createPropertyInvoiceNotesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS property_invoice_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      property_id INT NOT NULL,
      note_text TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      INDEX idx_property_id (property_id)
    )
  `;
  await db.query(sql);
  console.log("✓ property_invoice_notes table created successfully");
}

(async () => {
  try {
    await createPropertyInvoiceNotesTable();
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("✓ property_invoice_notes table already exists");
      process.exit(0);
    }
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
