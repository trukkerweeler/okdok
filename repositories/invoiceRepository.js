/**
 * Invoice Repository
 * Handles all invoice-related database operations
 */
const db = require("./db");

const invoiceRepository = {
  /**
   * Get all invoices with related property, lease, and tenant info
   */
  getAll: async () => {
    const sql = `
      SELECT 
        i.*,
        p.address as property_address,
        p.city as property_city,
        p.state as property_state,
        p.zip as property_zip,
        l.lease_number,
        o.name as owner_name,
        t.name as tenant_name,
        COALESCE((SELECT SUM(ip.amount_paid) FROM invoice_payments ip WHERE ip.invoice_id = i.id), 0) as total_paid
      FROM invoices i
      LEFT JOIN properties p ON i.property_id = p.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN lease_tenants lt ON l.id = lt.lease_id AND lt.is_primary = TRUE
      LEFT JOIN tenants t ON lt.tenant_id = t.id
      LEFT JOIN owners o ON i.owner_id = o.id
      ORDER BY i.created_at DESC
    `;
    return db.query(sql);
  },

  /**
   * Get invoice by ID
   */
  getById: async (id) => {
    const sql = `
      SELECT 
        i.*,
        p.address as property_address,
        p.city as property_city,
        p.state as property_state,
        p.zip as property_zip,
        l.lease_number,
        o.name as owner_name,
        o.email as owner_email,
        o.phone as owner_phone
      FROM invoices i
      LEFT JOIN properties p ON i.property_id = p.id
      LEFT JOIN leases l ON i.lease_id = l.id
      LEFT JOIN owners o ON i.owner_id = o.id
      WHERE i.id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get invoices for a specific property
   */
  getByPropertyId: async (property_id) => {
    const sql = `
      SELECT 
        i.*,
        p.address as property_address,
        t.name as tenant_name,
        o.name as owner_name
      FROM invoices i
      LEFT JOIN properties p ON i.property_id = p.id
      LEFT JOIN tenants t ON i.tenant_id = t.id
      LEFT JOIN owners o ON i.owner_id = o.id
      WHERE i.property_id = ?
      ORDER BY i.created_at DESC
    `;
    return db.query(sql, [property_id]);
  },

  /**
   * Get invoices for a specific tenant
   */
  getByTenantId: async (tenant_id) => {
    const sql = `
      SELECT 
        i.*,
        p.address as property_address,
        t.name as tenant_name,
        o.name as owner_name
      FROM invoices i
      LEFT JOIN properties p ON i.property_id = p.id
      LEFT JOIN tenants t ON i.tenant_id = t.id
      LEFT JOIN owners o ON i.owner_id = o.id
      WHERE i.tenant_id = ?
      ORDER BY i.created_at DESC
    `;
    return db.query(sql, [tenant_id]);
  },

  /**
   * Get invoices for a specific owner
   */
  getByOwnerId: async (owner_id) => {
    const sql = `
      SELECT 
        i.*,
        p.address as property_address,
        t.name as tenant_name,
        o.name as owner_name
      FROM invoices i
      LEFT JOIN properties p ON i.property_id = p.id
      LEFT JOIN tenants t ON i.tenant_id = t.id
      LEFT JOIN owners o ON i.owner_id = o.id
      WHERE i.owner_id = ?
      ORDER BY i.created_at DESC
    `;
    return db.query(sql, [owner_id]);
  },

  /**
   * Create a new invoice
   */
  create: async ({
    property_id,
    lease_id,
    tenant_id,
    owner_id,
    invoice_number,
    amount,
    invoice_date,
    due_date,
    description,
    status,
    notes,
  }) => {
    const sql = `
      INSERT INTO invoices 
      (property_id, lease_id, tenant_id, owner_id, invoice_number, amount, invoice_date, due_date, description, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const results = await db.query(sql, [
      property_id,
      lease_id,
      tenant_id || null,
      owner_id,
      invoice_number,
      amount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
    ]);
    return invoiceRepository.getById(results.insertId);
  },

  /**
   * Update invoice
   */
  update: async (
    id,
    {
      property_id,
      lease_id,
      owner_id,
      invoice_number,
      amount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
    },
  ) => {
    const sql = `
      UPDATE invoices 
      SET property_id = ?, lease_id = ?, owner_id = ?, invoice_number = ?, 
          amount = ?, invoice_date = ?, due_date = ?, description = ?, 
          status = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await db.query(sql, [
      property_id,
      lease_id,
      owner_id,
      invoice_number,
      amount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
      id,
    ]);
    return invoiceRepository.getById(id);
  },

  /**
   * Delete invoice
   */
  delete: async (id) => {
    const sql = "DELETE FROM invoices WHERE id = ?";
    return db.query(sql, [id]);
  },

  getLineItems: async (invoice_id) => {
    return db.query(
      `SELECT id, invoice_id, description, amount, sort_order
       FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order, id`,
      [invoice_id],
    );
  },

  replaceLineItems: async (invoice_id, items) => {
    return db.transaction(async (connection) => {
      await db.queryInTransaction(
        connection,
        `DELETE FROM invoice_line_items WHERE invoice_id = ?`,
        [invoice_id],
      );
      for (let i = 0; i < items.length; i++) {
        await db.queryInTransaction(
          connection,
          `INSERT INTO invoice_line_items (invoice_id, description, amount, sort_order) VALUES (?, ?, ?, ?)`,
          [invoice_id, items[i].description, parseFloat(items[i].amount), i],
        );
      }
      return db.queryInTransaction(
        connection,
        `SELECT id, invoice_id, description, amount, sort_order
         FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order, id`,
        [invoice_id],
      );
    });
  },

  /**
   * Get next invoice number (format: YY-XXX where XXX starts at 101)
   */
  getNextInvoiceNumber: async () => {
    const currentYear = new Date().getFullYear();
    const twoDigitYear = String(currentYear).slice(-2);

    // Count invoices for current year only
    const sql =
      "SELECT COUNT(*) as count FROM invoices WHERE YEAR(invoice_date) = ?";
    const results = await db.query(sql, [currentYear]);
    const count = results[0]?.count || 0;

    // Start numbering at 101, increment from there
    const sequenceNumber = 101 + count;
    return `${twoDigitYear}-${String(sequenceNumber).padStart(3, "0")}`;
  },
};

module.exports = invoiceRepository;
