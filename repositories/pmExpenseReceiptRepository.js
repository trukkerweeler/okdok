/**
 * PM Expense Receipt Repository
 * Handles storage and retrieval of PM expense receipts and supporting documents
 */
const db = require("./db");

const pmExpenseReceiptRepository = {
  /**
   * Get all receipts for a PM expense
   */
  getByExpenseId: async (pm_expense_id) => {
    const sql = `
      SELECT 
        id,
        pm_expense_id,
        receipt_type,
        filename,
        mime_type,
        file_size,
        uploaded_by,
        created_at
      FROM pm_expense_receipts
      WHERE pm_expense_id = ?
      ORDER BY created_at DESC
    `;
    return db.query(sql, [pm_expense_id]);
  },

  /**
   * Get receipt by ID (includes BLOB for download)
   */
  getById: async (id) => {
    const sql = `
      SELECT 
        id,
        pm_expense_id,
        receipt_type,
        file_blob,
        filename,
        mime_type,
        file_size,
        uploaded_by,
        created_at
      FROM pm_expense_receipts
      WHERE id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get primary receipt for an expense (most recent)
   */
  getPrimaryReceiptByExpenseId: async (pm_expense_id) => {
    const sql = `
      SELECT 
        id,
        pm_expense_id,
        file_blob,
        filename,
        mime_type,
        file_size,
        created_at
      FROM pm_expense_receipts
      WHERE pm_expense_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const results = await db.query(sql, [pm_expense_id]);
    return results[0] || null;
  },

  /**
   * Create a new receipt entry
   */
  create: async ({
    pm_expense_id,
    receipt_type = "receipt",
    file_blob,
    filename,
    mime_type,
    file_size,
    uploaded_by = null,
  }) => {
    const sql = `
      INSERT INTO pm_expense_receipts 
      (pm_expense_id, receipt_type, file_blob, filename, mime_type, file_size, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const results = await db.query(sql, [
      pm_expense_id,
      receipt_type,
      file_blob,
      filename,
      mime_type,
      file_size,
      uploaded_by,
    ]);
    return pmExpenseReceiptRepository.getById(results.insertId);
  },

  /**
   * Delete receipt by ID
   */
  delete: async (id) => {
    const sql = "DELETE FROM pm_expense_receipts WHERE id = ?";
    await db.query(sql, [id]);
  },

  /**
   * Delete all receipts for an expense
   */
  deleteByExpenseId: async (pm_expense_id) => {
    const sql = "DELETE FROM pm_expense_receipts WHERE pm_expense_id = ?";
    await db.query(sql, [pm_expense_id]);
  },

  /**
   * Check if receipt exists
   */
  exists: async (id) => {
    const sql = "SELECT id FROM pm_expense_receipts WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results.length > 0;
  },

  /**
   * Get receipt count for an expense
   */
  getCountByExpenseId: async (pm_expense_id) => {
    const sql =
      "SELECT COUNT(*) as count FROM pm_expense_receipts WHERE pm_expense_id = ?";
    const results = await db.query(sql, [pm_expense_id]);
    return results[0]?.count || 0;
  },
};

module.exports = pmExpenseReceiptRepository;
