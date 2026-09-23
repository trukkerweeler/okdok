const db = require("../repositories/db");

async function createTenantCommunicationLogTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS tenant_communication_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      communication_date DATETIME NOT NULL,
      method VARCHAR(30) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      outcome VARCHAR(50) NOT NULL,
      notes TEXT,
      next_follow_up_date DATE,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      INDEX idx_tenant_communication_tenant_date (tenant_id, communication_date)
    )
  `;
  await db.query(sql);
  console.log("Tenant communication log table is ready.");
}

(async () => {
  try {
    await createTenantCommunicationLogTable();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
