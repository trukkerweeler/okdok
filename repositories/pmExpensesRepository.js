/**
 * PM Expenses Repository
 * Handles all PM operating expense database operations
 */
const db = require("./db");

const pmExpensesRepository = {
  /**
   * Get all PM expenses
   */
  getAll: async () => {
    const sql = "SELECT * FROM pm_expenses ORDER BY date DESC, created_at DESC";
    return db.query(sql);
  },

  /**
   * Get PM expense by ID
   */
  getById: async (id) => {
    const sql = "SELECT * FROM pm_expenses WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get PM expenses by category
   */
  getByCategory: async (category) => {
    const sql =
      "SELECT * FROM pm_expenses WHERE category = ? ORDER BY date DESC, created_at DESC";
    return db.query(sql, [category]);
  },

  /**
   * Get PM expenses by date range
   */
  getByDateRange: async (startDate, endDate) => {
    const sql =
      "SELECT * FROM pm_expenses WHERE date >= ? AND date <= ? ORDER BY date DESC";
    return db.query(sql, [startDate, endDate]);
  },

  /**
   * Create a new PM expense
   */
  create: async ({
    category,
    amount,
    description,
    vendor_id = null,
    date = null,
  }) => {
    // Format date as YYYY-MM-DD string to avoid timezone issues
    let dateStr = date;
    if (!dateStr) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      dateStr = `${year}-${month}-${day}`;
    }

    const sql = `INSERT INTO pm_expenses 
                 (category, amount, description, vendor_id, date, created_at) 
                 VALUES (?, ?, ?, ?, CAST(? AS DATE), NOW())`;
    const results = await db.query(sql, [
      category,
      amount,
      description,
      vendor_id,
      dateStr,
    ]);
    return {
      id: results.insertId,
      category,
      amount,
      description,
      vendor_id,
      date: dateStr,
      created_at: new Date(),
    };
  },

  /**
   * Update PM expense
   */
  update: async (id, { category, amount, description, vendor_id, date }) => {
    const sql = `UPDATE pm_expenses 
                 SET category = ?, amount = ?, description = ?, vendor_id = ?, date = CAST(? AS DATE)
                 WHERE id = ?`;
    await db.query(sql, [category, amount, description, vendor_id, date, id]);
    return pmExpensesRepository.getById(id);
  },

  /**
   * Delete PM expense
   */
  delete: async (id) => {
    const sql = "DELETE FROM pm_expenses WHERE id = ?";
    await db.query(sql, [id]);
  },

  /**
   * Get summary stats
   */
  getSummary: async (year, month = null) => {
    let sql;
    let params;

    if (month) {
      sql = `SELECT 
               category,
               SUM(amount) as total,
               COUNT(*) as count
             FROM pm_expenses
             WHERE YEAR(date) = ? AND MONTH(date) = ?
             GROUP BY category
             ORDER BY total DESC`;
      params = [year, month];
    } else {
      sql = `SELECT 
               category,
               SUM(amount) as total,
               COUNT(*) as count
             FROM pm_expenses
             WHERE YEAR(date) = ?
             GROUP BY category
             ORDER BY total DESC`;
      params = [year];
    }

    return db.query(sql, params);
  },
};

module.exports = pmExpensesRepository;
