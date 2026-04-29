/**
 * Migration: Create company_settings table
 * Run with: node seed/create-company-settings-table.js
 */

const db = require("../repositories/db");

const createCompanySettingsTable = async () => {
  try {
    console.log("Creating company_settings table...\n");

    // Check if table already exists
    let sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'company_settings'`;
    let results = await db.query(sql);

    if (results.length > 0) {
      console.log("✓ company_settings table already exists");
    } else {
      // Create company_settings table
      sql = `CREATE TABLE company_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_setting_key (setting_key)
      )`;
      await db.query(sql);
      console.log("✓ Created company_settings table");

      // Insert default settings
      sql = `INSERT INTO company_settings (setting_key, setting_value, description) VALUES
        ('invoice_contact_name', 'Tim Kent', 'Name to display on invoices'),
        ('invoice_contact_phone', '801-367-6587', 'Phone number to display on invoices'),
        ('invoice_contact_email', '', 'Email to display on invoices'),
        ('company_name', 'OKPM LLC', 'Company name for invoices and documents'),
        ('company_address', '149 S Canyon View Drive', 'Company street address'),
        ('company_city', 'Elk Ridge', 'Company city'),
        ('company_state', 'UT', 'Company state'),
        ('company_zip', '84651', 'Company zip code')`;
      await db.query(sql);
      console.log("✓ Inserted default company settings");
    }

    console.log("\n✓ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
};

createCompanySettingsTable();
