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
    const sql = `
      SELECT 
        le.*,
        da.name as debit_account_name,
        ca.name as credit_account_name
      FROM ledger_entries le
      LEFT JOIN accounts da ON le.debit_account_id = da.id
      LEFT JOIN accounts ca ON le.credit_account_id = ca.id
      WHERE le.owner_id = ? 
      ORDER BY le.date DESC, le.created_at DESC
    `;
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
    date = new Date().toISOString().split('T')[0],
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

  /**
   * Delete a ledger entry by ID
   */
  delete: async (id) => {
    const sql = "DELETE FROM ledger_entries WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results.affectedRows > 0;
  },

  /**
   * Get unreimbursed owner expenses for an owner
   * @param {number} owner_id - Owner ID
   * @returns {Promise<array>} Array of unreimbursed expense ledger entries
   */
  getUnreimbursedExpenses: async (owner_id) => {
    const sql = `
      SELECT le.* 
      FROM ledger_entries le
      JOIN accounts debit_acc ON le.debit_account_id = debit_acc.id
      WHERE le.owner_id = ?
        AND debit_acc.name = 'Owner Expense'
        AND (le.reimbursement_status = 'unreimbursed' OR le.reimbursement_status IS NULL)
      ORDER BY le.date ASC
    `;
    return db.query(sql, [owner_id]);
  },

  /**
   * Link a distribution to specific expenses (mark them as reimbursed)
   * @param {number} distribution_id - Distribution ledger entry ID
   * @param {array} expense_ids - Array of expense ledger entry IDs to reimburse
   * @returns {Promise<void>}
   */
  linkDistributionToExpenses: async (distribution_id, expense_ids) => {
    if (!expense_ids || expense_ids.length === 0) {
      return;
    }

    // Insert records into distribution_expenses
    const values = expense_ids.map((id) => [distribution_id, id, 0]); // amount will be filled from expense

    for (const expense_id of expense_ids) {
      const sql = `
        INSERT INTO distribution_expenses (distribution_id, expense_id, amount)
        SELECT ?, ?, le.amount
        FROM ledger_entries le
        WHERE le.id = ?
      `;
      await db.query(sql, [distribution_id, expense_id, expense_id]);

      // Mark expense as reimbursed
      const updateSql =
        "UPDATE ledger_entries SET reimbursement_status = 'reimbursed' WHERE id = ?";
      await db.query(updateSql, [expense_id]);
    }
  },

  /**
   * Get expenses linked to a distribution
   * @param {number} distribution_id - Distribution ledger entry ID
   * @returns {Promise<array>} Array of linked expenses
   */
  getDistributionExpenses: async (distribution_id) => {
    const sql = `
      SELECT le.*, de.amount as reimbursed_amount
      FROM distribution_expenses de
      JOIN ledger_entries le ON de.expense_id = le.id
      WHERE de.distribution_id = ?
      ORDER BY le.date ASC
    `;
    return db.query(sql, [distribution_id]);
  },

  /**
   * Update reimbursement status of a ledger entry
   * @param {number} id - Ledger entry ID
   * @param {string} status - 'unreimbursed' or 'reimbursed'
   * @returns {Promise<void>}
   */
  updateReimbursementStatus: async (id, status) => {
    const sql =
      "UPDATE ledger_entries SET reimbursement_status = ? WHERE id = ?";
    await db.query(sql, [status, id]);
  },
};

module.exports = ledgerRepository;
