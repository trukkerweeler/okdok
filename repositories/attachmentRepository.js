/**
 * Payment Attachment Repository
 * Handles storage and retrieval of payment-related documents (check stubs, receipts, etc)
 */
const db = require("./db");

const attachmentRepository = {
  /**
   * Get all attachments for a payment
   */
  getByPaymentId: async (payment_id) => {
    const sql = `
      SELECT 
        id,
        payment_id,
        attachment_type,
        filename,
        mime_type,
        file_size,
        created_at
      FROM payment_attachments
      WHERE payment_id = ?
      ORDER BY created_at DESC
    `;
    return db.query(sql, [payment_id]);
  },

  /**
   * Get attachment by ID (includes BLOB)
   */
  getById: async (id) => {
    const sql = `
      SELECT 
        id,
        payment_id,
        attachment_type,
        file_blob,
        filename,
        mime_type,
        file_size,
        created_at
      FROM payment_attachments
      WHERE id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get check stub for a payment (convenience method)
   */
  getCheckStubByPaymentId: async (payment_id) => {
    const sql = `
      SELECT 
        id,
        payment_id,
        file_blob,
        filename,
        mime_type,
        file_size,
        created_at
      FROM payment_attachments
      WHERE payment_id = ? AND attachment_type = 'check_stub'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const results = await db.query(sql, [payment_id]);
    return results[0] || null;
  },

  /**
   * Create a new attachment
   */
  create: async ({
    payment_id,
    attachment_type = "check_stub",
    file_blob,
    filename,
    mime_type,
    file_size,
  }) => {
    const sql = `
      INSERT INTO payment_attachments 
      (payment_id, attachment_type, file_blob, filename, mime_type, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    const results = await db.query(sql, [
      payment_id,
      attachment_type,
      file_blob,
      filename,
      mime_type,
      file_size,
    ]);
    return attachmentRepository.getById(results.insertId);
  },

  /**
   * Delete attachment by ID
   */
  delete: async (id) => {
    const sql = "DELETE FROM payment_attachments WHERE id = ?";
    return db.query(sql, [id]);
  },

  /**
   * Delete all attachments for a payment
   */
  deleteByPaymentId: async (payment_id) => {
    const sql = "DELETE FROM payment_attachments WHERE payment_id = ?";
    return db.query(sql, [payment_id]);
  },

  /**
   * Get attachment count for a payment
   */
  getCountByPaymentId: async (payment_id) => {
    const sql = `
      SELECT COUNT(*) as count
      FROM payment_attachments
      WHERE payment_id = ?
    `;
    const results = await db.query(sql, [payment_id]);
    return results[0]?.count || 0;
  },

  /**
   * Get deposit receipt for a payment
   */
  getDepositReceiptByPaymentId: async (payment_id) => {
    const sql = `
      SELECT 
        id,
        payment_id,
        file_blob,
        filename,
        mime_type,
        file_size,
        created_at
      FROM payment_attachments
      WHERE payment_id = ? AND attachment_type = 'deposit_receipt'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const results = await db.query(sql, [payment_id]);
    return results[0] || null;
  },

  /**
   * Delete attachments for a payment filtered by type
   */
  deleteByPaymentIdAndType: async (payment_id, attachment_type) => {
    const sql =
      "DELETE FROM payment_attachments WHERE payment_id = ? AND attachment_type = ?";
    return db.query(sql, [payment_id, attachment_type]);
  },

  /**
   * Check if payment has a check stub
   */
  hasCheckStub: async (payment_id) => {
    const sql = `
      SELECT COUNT(*) as count
      FROM payment_attachments
      WHERE payment_id = ? AND attachment_type = 'check_stub'
    `;
    const results = await db.query(sql, [payment_id]);
    return results[0]?.count > 0;
  },

  /**
   * Check if payment has a deposit receipt
   */
  hasDepositReceipt: async (payment_id) => {
    const sql = `
      SELECT COUNT(*) as count
      FROM payment_attachments
      WHERE payment_id = ? AND attachment_type = 'deposit_receipt'
    `;
    const results = await db.query(sql, [payment_id]);
    return results[0]?.count > 0;
  },
};

module.exports = attachmentRepository;
