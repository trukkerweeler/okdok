/**
 * PM Expense Categories Repository
 * Handles all PM expense category database operations
 */
const db = require("./db");

const pmExpenseCategoryRepository = {
  /**
   * Get all active categories, sorted by sort_order
   */
  getAll: async () => {
    const sql = `
      SELECT id, name, code, color, is_active, sort_order
      FROM pm_expense_categories
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, name ASC
    `;
    return db.query(sql);
  },

  /**
   * Get all categories including inactive ones (for admin)
   */
  getAllIncludeInactive: async () => {
    const sql = `
      SELECT id, name, code, color, is_active, sort_order
      FROM pm_expense_categories
      ORDER BY sort_order ASC, name ASC
    `;
    return db.query(sql);
  },

  /**
   * Get category by ID
   */
  getById: async (id) => {
    const sql = `
      SELECT id, name, code, color, is_active, sort_order
      FROM pm_expense_categories
      WHERE id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get category by code
   */
  getByCode: async (code) => {
    const sql = `
      SELECT id, name, code, color, is_active, sort_order
      FROM pm_expense_categories
      WHERE code = ?
    `;
    const results = await db.query(sql, [code]);
    return results[0] || null;
  },

  /**
   * Create a new category
   */
  create: async ({ name, code, color = "#999999", sort_order = 0 }) => {
    const sql = `
      INSERT INTO pm_expense_categories (name, code, color, sort_order, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `;
    const results = await db.query(sql, [name, code, color, sort_order]);
    return pmExpenseCategoryRepository.getById(results.insertId);
  },

  /**
   * Update category
   */
  update: async (id, { name, color, sort_order, is_active }) => {
    const sql = `
      UPDATE pm_expense_categories
      SET name = ?, color = ?, sort_order = ?, is_active = ?
      WHERE id = ?
    `;
    await db.query(sql, [name, color, sort_order, is_active, id]);
    return pmExpenseCategoryRepository.getById(id);
  },

  /**
   * Delete category (hard delete - only if no expenses exist)
   */
  delete: async (id) => {
    // First check if any expenses use this category
    const checkSql = `
      SELECT COUNT(*) as count
      FROM pm_expenses
      WHERE category = (SELECT code FROM pm_expense_categories WHERE id = ?)
    `;
    const checkResults = await db.query(checkSql, [id]);

    if (checkResults[0].count > 0) {
      throw new Error(
        "Cannot delete category with existing expenses. Disable it instead.",
      );
    }

    const sql = "DELETE FROM pm_expense_categories WHERE id = ?";
    await db.query(sql, [id]);
  },

  /**
   * Deactivate category (soft delete)
   */
  deactivate: async (id) => {
    const sql = `
      UPDATE pm_expense_categories
      SET is_active = FALSE
      WHERE id = ?
    `;
    await db.query(sql, [id]);
    return pmExpenseCategoryRepository.getById(id);
  },

  /**
   * Check if code already exists
   */
  codeExists: async (code, excludeId = null) => {
    let sql = "SELECT id FROM pm_expense_categories WHERE code = ?";
    let params = [code];

    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    const results = await db.query(sql, params);
    return results.length > 0;
  },
};

module.exports = pmExpenseCategoryRepository;
