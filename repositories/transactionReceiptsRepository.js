/**
 * Transaction Receipts Repository
 * Data access layer for transaction receipt attachments
 */
const db = require("./db");

const transactionReceiptsRepository = {
  /**
   * Get all receipts for a transaction
   */
  getByLedgerId: async (ledger_id) => {
    const sql = `
      SELECT id, ledger_id, filename, mime_type, file_size, created_at
      FROM transaction_receipts
      WHERE ledger_id = ?
      ORDER BY created_at DESC
    `;
    return db.query(sql, [ledger_id]);
  },

  /**
   * Get a specific receipt
   */
  getById: async (id) => {
    const sql = `
      SELECT *
      FROM transaction_receipts
      WHERE id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Create a new receipt
   */
  create: async ({ ledger_id, file_blob, filename, mime_type, file_size }) => {
    const sql = `
      INSERT INTO transaction_receipts (ledger_id, file_blob, filename, mime_type, file_size)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.query(sql, [
      ledger_id,
      file_blob,
      filename,
      mime_type,
      file_size,
    ]);
    return {
      id: result.insertId,
      ledger_id,
      filename,
      mime_type,
      file_size,
    };
  },

  /**
   * Delete a receipt
   */
  delete: async (id) => {
    const sql = `
      DELETE FROM transaction_receipts
      WHERE id = ?
    `;
    const result = await db.query(sql, [id]);
    return result.affectedRows > 0;
  },

  /**
   * Get receipt count for a transaction
   */
  getCountByLedgerId: async (ledger_id) => {
    const sql = `
      SELECT COUNT(*) as count
      FROM transaction_receipts
      WHERE ledger_id = ?
    `;
    const results = await db.query(sql, [ledger_id]);
    return results[0]?.count || 0;
  },
};

module.exports = transactionReceiptsRepository;
