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
        ca.name as credit_account_name,
        COALESCE(COUNT(tr.id), 0) as receipt_count
      FROM ledger_entries le
      LEFT JOIN accounts da ON le.debit_account_id = da.id
      LEFT JOIN accounts ca ON le.credit_account_id = ca.id
      LEFT JOIN transaction_receipts tr ON le.id = tr.ledger_id
      WHERE le.owner_id = ? 
      GROUP BY le.id
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
   * Get all landlord-reimbursable owner expenses with display fields.
   */
  getOwnerExpenses: async () => {
    const sql = `
      SELECT
        le.*,
        da.name AS debit_account_name,
        ca.name AS credit_account_name,
        o.name AS owner_name,
        p.address AS property_address,
        v.name AS vendor_name,
        COALESCE(COUNT(tr.id), 0) AS receipt_count
      FROM ledger_entries le
      JOIN accounts da ON le.debit_account_id = da.id
      LEFT JOIN accounts ca ON le.credit_account_id = ca.id
      LEFT JOIN owners o ON le.owner_id = o.id
      LEFT JOIN properties p ON le.property_id = p.id
      LEFT JOIN vendors v ON le.vendor_id = v.id
      LEFT JOIN transaction_receipts tr ON le.id = tr.ledger_id
      WHERE da.name = 'Owner Expense'
      GROUP BY le.id
      ORDER BY le.date DESC, le.created_at DESC
    `;
    return db.query(sql);
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
    date = new Date().toISOString().split("T")[0],
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
   * Delete a distribution and reverse its effects atomically:
   * linked expenses/fees return to 'unreimbursed', and management fees that
   * were auto-created with the distribution are removed.
   * @param {number} id - Distribution ledger entry ID
   * @returns {Promise<boolean>} True if the distribution was deleted
   */
  deleteDistribution: async (id) => {
    return db.transaction(async (connection) => {
      const [dist] = await db.queryInTransaction(
        connection,
        "SELECT created_at FROM ledger_entries WHERE id = ? FOR UPDATE",
        [id],
      );
      if (!dist) return false;

      // Fees created inline with the distribution (not pre-existing ones that were selected)
      const inlineFees = await db.queryInTransaction(
        connection,
        `SELECT le.id
         FROM distribution_fees df
         JOIN ledger_entries le ON le.id = df.fee_id
         WHERE df.distribution_id = ? AND le.created_at >= ?`,
        [id, dist.created_at],
      );
      const inlineFeeIds = inlineFees.map((f) => f.id);

      await db.queryInTransaction(
        connection,
        `UPDATE ledger_entries le
         JOIN distribution_expenses de ON de.expense_id = le.id
         SET le.reimbursed_amount = GREATEST(COALESCE(le.reimbursed_amount, 0) - de.amount, 0),
             le.reimbursement_status = CASE
               WHEN GREATEST(COALESCE(le.reimbursed_amount, 0) - de.amount, 0) <= 0 THEN 'unreimbursed'
               WHEN GREATEST(COALESCE(le.reimbursed_amount, 0) - de.amount, 0) < le.amount THEN 'partially_reimbursed'
               ELSE 'reimbursed'
             END
         WHERE de.distribution_id = ?`,
        [id],
      );

      await db.queryInTransaction(
        connection,
        `UPDATE ledger_entries le
         JOIN distribution_fees df ON df.fee_id = le.id
         SET le.reimbursement_status = 'unreimbursed'
         WHERE df.distribution_id = ?`,
        [id],
      );

      const result = await db.queryInTransaction(
        connection,
        "DELETE FROM ledger_entries WHERE id = ?",
        [id],
      );

      if (inlineFeeIds.length > 0) {
        await db.queryInTransaction(
          connection,
          "DELETE FROM ledger_entries WHERE id IN (?)",
          [inlineFeeIds],
        );
      }

      return result.affectedRows > 0;
    });
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
        AND COALESCE(le.reimbursed_amount, 0) < le.amount
        AND le.reimbursement_status IN ('unreimbursed', 'partially_reimbursed')
      ORDER BY le.date ASC
    `;
    return db.query(sql, [owner_id]);
  },

  /**
   * Link a distribution to specific expenses (mark them as reimbursed)
   * @param {number} distribution_id - Distribution ledger entry ID
   * @param {array} reimbursement_entries - Array of expense entries with optional amount values
   * @returns {Promise<void>}
   */
  linkDistributionToExpenses: async (distribution_id, reimbursement_entries) => {
    if (!reimbursement_entries || reimbursement_entries.length === 0) {
      return;
    }

    for (const entry of reimbursement_entries) {
      const expense_id = parseInt(entry.expense_id ?? entry.id ?? entry);
      const amount = parseFloat(entry.amount ?? entry.reimbursement_amount ?? entry.value ?? null);
      const reimbursementAmount = Number.isFinite(amount) && amount > 0 ? amount : null;

      const sql = `
        INSERT INTO distribution_expenses (distribution_id, expense_id, amount)
        VALUES (?, ?, ?)
      `;
      await db.query(sql, [distribution_id, expense_id, reimbursementAmount ?? 0]);

      const updateSql = `
        UPDATE ledger_entries
        SET reimbursed_amount = COALESCE(reimbursed_amount, 0) + ?,
            reimbursement_status = CASE
              WHEN COALESCE(reimbursed_amount, 0) + ? >= amount THEN 'reimbursed'
              ELSE 'partially_reimbursed'
            END
        WHERE id = ?
      `;
      await db.query(updateSql, [reimbursementAmount ?? 0, reimbursementAmount ?? 0, expense_id]);
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

  /**
   * Get unreimbursed management fees for an owner
   * @param {number} owner_id - Owner ID
   * @returns {Promise<array>} Array of unreimbursed fee ledger entries
   */
  getUnreimbursedFees: async (owner_id) => {
    const sql = `
      SELECT le.*
      FROM ledger_entries le
      JOIN accounts credit_acc ON le.credit_account_id = credit_acc.id
      WHERE le.owner_id = ?
        AND credit_acc.name = 'Management Fee Income'
        AND (le.reimbursement_status = 'unreimbursed' OR le.reimbursement_status IS NULL)
      ORDER BY le.date ASC
    `;
    return db.query(sql, [owner_id]);
  },

  /**
   * Get fees linked to a distribution
   * @param {number} distribution_id - Distribution ledger entry ID
   * @returns {Promise<array>} Array of linked fee entries
   */
  getDistributionFees: async (distribution_id) => {
    const sql = `
      SELECT le.*, df.amount as fee_amount
      FROM distribution_fees df
      JOIN ledger_entries le ON df.fee_id = le.id
      WHERE df.distribution_id = ?
      ORDER BY le.date ASC
    `;
    return db.query(sql, [distribution_id]);
  },
};

module.exports = ledgerRepository;
