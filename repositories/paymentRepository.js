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
        p.id,
        p.invoice_id,
        p.payment_date,
        p.amount_paid,
        p.payment_method,
        p.reference_number,
        p.notes,
        p.transaction_type,
        p.created_at,
        p.updated_at,
        i.invoice_number,
        i.amount as invoice_amount,
        i.description as invoice_type,
        t.name as tenant_name,
        o.name as owner_name,
        pr.address as property_address
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN lease_tenants lt ON l.id = lt.lease_id AND lt.is_primary = TRUE
      LEFT JOIN tenants t ON lt.tenant_id = t.id
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
        p.id,
        p.invoice_id,
        p.payment_date,
        p.amount_paid,
        p.payment_method,
        p.reference_number,
        p.notes,
        p.transaction_type,
        p.created_at,
        p.updated_at,
        i.invoice_number,
        i.amount as invoice_amount,
        i.description as invoice_type,
        t.name as tenant_name,
        o.name as owner_name
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN lease_tenants lt ON l.id = lt.lease_id AND lt.is_primary = TRUE
      LEFT JOIN tenants t ON lt.tenant_id = t.id
      LEFT JOIN owners o ON i.owner_id = o.id
      WHERE p.invoice_id = ?
      ORDER BY p.payment_date DESC
    `;
    return db.query(sql, [invoice_id]);
  },

  getTenantMonthlyReport: async (
    tenant_id,
    start_date,
    due_end_date,
    payment_end_date,
  ) => {
    const sql = `
      SELECT i.id as invoice_id, p.payment_date, i.amount as amount_due,
        COALESCE(p.amount_paid, 0) as amount_paid,
        GREATEST(i.amount - COALESCE(p.amount_paid, 0), 0) as balance_due,
        p.payment_method, p.reference_number, i.invoice_number,
        i.description as invoice_type, i.due_date,
        COALESCE(t_direct.name, t_lease.name) as tenant_name,
        pr.address as property_address
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, MAX(payment_date) as payment_date,
          SUM(amount_paid) as amount_paid,
          GROUP_CONCAT(DISTINCT payment_method ORDER BY payment_method SEPARATOR ', ') as payment_method,
          GROUP_CONCAT(DISTINCT reference_number ORDER BY reference_number SEPARATOR ', ') as reference_number
        FROM invoice_payments
        WHERE payment_date <= ?
          AND (transaction_type = 'tenant_to_manager' OR transaction_type IS NULL)
        GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN lease_tenants lt ON l.id = lt.lease_id AND lt.tenant_id = ?
      LEFT JOIN tenants t_direct ON i.tenant_id = t_direct.id
      LEFT JOIN tenants t_lease ON lt.tenant_id = t_lease.id
      LEFT JOIN properties pr ON i.property_id = pr.id
      WHERE (i.tenant_id = ? OR lt.tenant_id IS NOT NULL)
        AND i.due_date BETWEEN ? AND ?
        AND i.status <> 'cancelled'
      ORDER BY i.due_date ASC, i.id ASC
    `;
    return db.query(sql, [
      payment_end_date,
      tenant_id,
      tenant_id,
      start_date,
      due_end_date,
    ]);
  },

  /**
   * Get payments for a specific owner
   */
  getByOwnerId: async (owner_id) => {
    const sql = `
      SELECT 
        p.id,
        p.invoice_id,
        p.payment_date,
        p.amount_paid,
        p.payment_method,
        p.reference_number,
        p.notes,
        p.transaction_type,
        p.created_at,
        p.updated_at,
        i.id as invoice_id,
        i.invoice_number,
        i.amount as invoice_amount,
        i.description as invoice_type,
        t.name as tenant_name,
        o.name as owner_name,
        pr.address as property_address
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN lease_tenants lt ON l.id = lt.lease_id AND lt.is_primary = TRUE
      LEFT JOIN tenants t ON lt.tenant_id = t.id
      LEFT JOIN owners o ON i.owner_id = o.id
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
        p.id,
        p.invoice_id,
        p.payment_date,
        p.amount_paid,
        p.payment_method,
        p.reference_number,
        p.notes,
        p.transaction_type,
        p.created_at,
        p.updated_at,
        i.invoice_number,
        i.amount as invoice_amount,
        i.description as invoice_type,
        t.name as tenant_name,
        o.name as owner_name,
        pr.address as property_address
      FROM invoice_payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN lease_tenants lt ON l.id = lt.lease_id AND lt.is_primary = TRUE
      LEFT JOIN tenants t ON lt.tenant_id = t.id
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
    transaction_type,
  }) => {
    const sql = `
      INSERT INTO invoice_payments 
      (invoice_id, payment_date, amount_paid, payment_method, reference_number, notes, transaction_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const results = await db.query(sql, [
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
      transaction_type || "tenant_to_manager",
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
      transaction_type,
    },
  ) => {
    const sql = `
      UPDATE invoice_payments 
      SET invoice_id = ?, payment_date = ?, amount_paid = ?, 
          payment_method = ?, reference_number = ?, notes = ?, transaction_type = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await db.query(sql, [
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
      transaction_type || "tenant_to_manager",
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
