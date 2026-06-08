/**
 * Migration: Create pm_expense_categories table
 * Run with: node seed/create-pm-expense-categories-table.js
 */

const db = require("../repositories/db");

const createPmExpenseCategoriesTable = async () => {
  try {
    console.log("Creating pm_expense_categories table...\n");

    // Check if table already exists
    let sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'pm_expense_categories'`;
    let results = await db.query(sql);

    if (results.length > 0) {
      console.log("✓ pm_expense_categories table already exists");
    } else {
      // Create pm_expense_categories table
      sql = `CREATE TABLE pm_expense_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        color VARCHAR(7) DEFAULT '#999999',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_code (code),
        INDEX idx_is_active (is_active)
      )`;
      await db.query(sql);
      console.log("✓ Created pm_expense_categories table");

      // Insert default categories
      sql = `INSERT INTO pm_expense_categories (name, code, color, sort_order) VALUES
        ('Office Supplies', 'office', '#3498db', 10),
        ('Technology & Software', 'technology', '#9b59b6', 20),
        ('Staff & Training', 'staff', '#e74c3c', 30),
        ('Utilities & Rent', 'utilities', '#f39c12', 40),
        ('Marketing & Advertising', 'marketing', '#1abc9c', 50),
        ('Professional Services', 'professional', '#2ecc71', 60),
        ('Equipment', 'equipment', '#34495e', 70),
        ('Other', 'other', '#95a5a6', 80)`;
      await db.query(sql);
      console.log("✓ Inserted default expense categories");
    }

    console.log("\n✓ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }
};

createPmExpenseCategoriesTable();
