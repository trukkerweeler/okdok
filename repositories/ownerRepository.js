/**
 * Owner Repository
 * Handles all owner-related database operations
 */
const db = require("./db");

const ownerRepository = {
  /**
   * Get all owners
   */
  getAll: async () => {
    const sql = "SELECT * FROM owners ORDER BY created_at DESC";
    return db.query(sql);
  },

  /**
   * Get owner by ID
   */
  getById: async (id) => {
    const sql = "SELECT * FROM owners WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Create a new owner
   */
  create: async ({ name, email, phone, payout_bank_account }) => {
    const sql = `INSERT INTO owners (name, email, phone, payout_bank_account, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, NOW(), NOW())`;
    const results = await db.query(sql, [
      name,
      email,
      phone,
      payout_bank_account,
    ]);
    return { id: results.insertId, name, email, phone, payout_bank_account };
  },

  /**
   * Update owner
   */
  update: async (id, { name, email, phone, payout_bank_account }) => {
    const sql = `UPDATE owners SET name = ?, email = ?, phone = ?, payout_bank_account = ?, updated_at = NOW() 
                 WHERE id = ?`;
    await db.query(sql, [name, email, phone, payout_bank_account, id]);
    return ownerRepository.getById(id);
  },

  /**
   * Delete owner
   */
  delete: async (id) => {
    const sql = "DELETE FROM owners WHERE id = ?";
    return db.query(sql, [id]);
  },
};

module.exports = ownerRepository;
