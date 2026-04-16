/**
 * Ledger Repository
 * Handles all ledger entry database operations
 */
const db = require("./db");

const ledgerRepository = {
  /**
   * Get all ledger entries
   */
  getAll: async () => {
    const sql =
      "SELECT * FROM ledger_entries ORDER BY date DESC, created_at DESC";
    return db.query(sql);
  },

  /**
   * Get ledger entries by owner
   */
  getByOwnerId: async (owner_id) => {
    const sql =
      "SELECT * FROM ledger_entries WHERE owner_id = ? ORDER BY date DESC, created_at DESC";
    return db.query(sql, [owner_id]);
  },

  /**
   * Get ledger entries by property
   */
  getByPropertyId: async (property_id) => {
    const sql =
      "SELECT * FROM ledger_entries WHERE property_id = ? ORDER BY date DESC, created_at DESC";
    return db.query(sql, [property_id]);
  },

  /**
   * Get ledger entries by tenant
   */
  getByTenantId: async (tenant_id) => {
    const sql =
      "SELECT * FROM ledger_entries WHERE tenant_id = ? ORDER BY date DESC, created_at DESC";
    return db.query(sql, [tenant_id]);
  },

  /**
   * Get ledger entries by account
   */
  getByAccountId: async (account_id) => {
    const sql = `SELECT * FROM ledger_entries 
                 WHERE debit_account_id = ? OR credit_account_id = ? 
                 ORDER BY date DESC, created_at DESC`;
    return db.query(sql, [account_id, account_id]);
  },

  /**
   * Get ledger entry by ID
   */
  getById: async (id) => {
    const sql = "SELECT * FROM ledger_entries WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Create a new ledger entry (double-entry transaction)
   */
  create: async ({
    date = new Date(),
    debit_account_id,
    credit_account_id,
    amount,
    memo,
    property_id = null,
    owner_id = null,
    tenant_id = null,
    vendor_id = null,
    attachment_url = null,
  }) => {
    const sql = `INSERT INTO ledger_entries 
                 (date, debit_account_id, credit_account_id, amount, memo, property_id, owner_id, tenant_id, vendor_id, attachment_url, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    const results = await db.query(sql, [
      date,
      debit_account_id,
      credit_account_id,
      amount,
      memo,
      property_id,
      owner_id,
      tenant_id,
      vendor_id,
      attachment_url,
    ]);
    return {
      id: results.insertId,
      date,
      debit_account_id,
      credit_account_id,
      amount,
      memo,
      property_id,
      owner_id,
      tenant_id,
      vendor_id,
      attachment_url,
    };
  },

  /**
   * Get ledger entries for a date range
   */
  getByDateRange: async (owner_id, startDate, endDate) => {
    const sql = `SELECT * FROM ledger_entries 
                 WHERE owner_id = ? AND date >= ? AND date <= ? 
                 ORDER BY date ASC`;
    return db.query(sql, [owner_id, startDate, endDate]);
  },
};

module.exports = ledgerRepository;
