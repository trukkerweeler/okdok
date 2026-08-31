/**
 * Tenant Credit Repository
 * Handles overpayment credits and their application to future invoices
 */
const db = require("./db");

const tenantCreditRepository = {
  /**
   * Get a summary of available/total credit per tenant (tenants with at least one credit)
   */
  getAllWithBalances: async () => {
    const sql = `
      SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        COALESCE(SUM(tc.remaining_amount), 0) as available_balance,
        COALESCE(SUM(tc.amount), 0) as total_credited,
        COUNT(tc.id) as credit_count
      FROM tenants t
      JOIN tenant_credits tc ON tc.tenant_id = t.id
      GROUP BY t.id, t.name
      ORDER BY available_balance DESC
    `;
    return db.query(sql);
  },

  /**
   * Get all credits for a tenant (full history), most recent first
   */
  getByTenantId: async (tenant_id) => {
    const sql = `
      SELECT * FROM tenant_credits
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `;
    return db.query(sql, [tenant_id]);
  },

  /**
   * Get open (partially or fully unused) credits for a tenant, oldest first (FIFO)
   */
  getOpenByTenantId: async (tenant_id) => {
    const sql = `
      SELECT * FROM tenant_credits
      WHERE tenant_id = ? AND remaining_amount > 0
      ORDER BY created_at ASC
    `;
    return db.query(sql, [tenant_id]);
  },

  /**
   * Get total available (unused) credit for a tenant
   */
  getAvailableBalance: async (tenant_id) => {
    const sql = `
      SELECT COALESCE(SUM(remaining_amount), 0) as available
      FROM tenant_credits
      WHERE tenant_id = ?
    `;
    const results = await db.query(sql, [tenant_id]);
    return parseFloat(results[0].available);
  },

  /**
   * Get applications (history of where a credit was used)
   */
  getApplicationsByCreditId: async (credit_id) => {
    const sql = `
      SELECT a.*, i.invoice_number
      FROM tenant_credit_applications a
      LEFT JOIN invoices i ON a.invoice_id = i.id
      WHERE a.credit_id = ?
      ORDER BY a.applied_at DESC
    `;
    return db.query(sql, [credit_id]);
  },
};

module.exports = tenantCreditRepository;
