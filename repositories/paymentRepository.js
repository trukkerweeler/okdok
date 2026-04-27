/**
 * Payment Repository
 * Handles all invoice payment-related database operations
 */
const db = require("./db");

const paymentRepository = {
  /**
   * Get all payments
   */
  getAll: async () => {
    const sql = `
      SELECT 
        p.*,
        i.invoice_number,
        i.amount as invoice_amount,
        o.name as owner_name,
        pr.address as property_address
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN owners o ON i.owner_id = o.id
      LEFT JOIN properties pr ON i.property_id = pr.id
      ORDER BY p.payment_date DESC, p.created_at DESC
    `;
    return db.query(sql);
  },

  /**
   * Get payments for a specific invoice
   */
  getByInvoiceId: async (invoice_id) => {
    const sql = `
      SELECT 
        p.*,
        i.invoice_number,
        i.amount as invoice_amount,
        o.name as owner_name
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN owners o ON i.owner_id = o.id
      WHERE p.invoice_id = ?
      ORDER BY p.payment_date DESC
    `;
    return db.query(sql, [invoice_id]);
  },

  /**
   * Get payments for a specific owner
   */
  getByOwnerId: async (owner_id) => {
    const sql = `
      SELECT 
        p.*,
        i.id as invoice_id,
        i.invoice_number,
        i.amount as invoice_amount,
        pr.address as property_address
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN properties pr ON i.property_id = pr.id
      WHERE i.owner_id = ?
      ORDER BY p.payment_date DESC
    `;
    return db.query(sql, [owner_id]);
  },

  /**
   * Get payment by ID
   */
  getById: async (id) => {
    const sql = `
      SELECT 
        p.*,
        i.invoice_number,
        i.amount as invoice_amount,
        o.name as owner_name,
        pr.address as property_address
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN owners o ON i.owner_id = o.id
      LEFT JOIN properties pr ON i.property_id = pr.id
      WHERE p.id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Create a new payment
   */
  create: async ({
    invoice_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    notes,
  }) => {
    const sql = `
      INSERT INTO invoice_payments 
      (invoice_id, payment_date, amount_paid, payment_method, reference_number, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const results = await db.query(sql, [
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    ]);
    return paymentRepository.getById(results.insertId);
  },

  /**
   * Update payment
   */
  update: async (
    id,
    {
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    },
  ) => {
    const sql = `
      UPDATE invoice_payments 
      SET invoice_id = ?, payment_date = ?, amount_paid = ?, 
          payment_method = ?, reference_number = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await db.query(sql, [
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
      id,
    ]);
    return paymentRepository.getById(id);
  },

  /**
   * Delete payment
   */
  delete: async (id) => {
    const sql = "DELETE FROM invoice_payments WHERE id = ?";
    return db.query(sql, [id]);
  },

  /**
   * Get total paid for an invoice
   */
  getTotalPaidForInvoice: async (invoice_id) => {
    const sql = `
      SELECT COALESCE(SUM(amount_paid), 0) as total_paid
      FROM invoice_payments
      WHERE invoice_id = ?
    `;
    const results = await db.query(sql, [invoice_id]);
    return results[0]?.total_paid || 0;
  },

  /**
   * Get invoice balance (total due - total paid)
   */
  getInvoiceBalance: async (invoice_id) => {
    const sql = `
      SELECT 
        i.id,
        i.invoice_number,
        i.amount as invoice_amount,
        COALESCE(SUM(p.amount_paid), 0) as total_paid,
        (i.amount - COALESCE(SUM(p.amount_paid), 0)) as balance
      FROM invoices i
      LEFT JOIN invoice_payments p ON i.id = p.invoice_id
      WHERE i.id = ?
      GROUP BY i.id
    `;
    const results = await db.query(sql, [invoice_id]);
    return results[0] || null;
  },

  /**
   * Get all payment methods used
   */
  getPaymentMethods: async () => {
    const sql = `
      SELECT DISTINCT payment_method
      FROM invoice_payments
      WHERE payment_method IS NOT NULL
      ORDER BY payment_method
    `;
    return db.query(sql);
  },
};

module.exports = paymentRepository;
