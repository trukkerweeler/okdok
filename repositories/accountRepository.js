/**
 * Account Repository
 * Handles all account-related database operations
 */
const db = require("./db");

const accountRepository = {
  /**
   * Get all accounts
   */
  getAll: async () => {
    const sql = "SELECT * FROM accounts ORDER BY created_at DESC";
    return db.query(sql);
  },

  /**
   * Get accounts by owner
   */
  getByOwnerId: async (owner_id) => {
    const sql =
      "SELECT * FROM accounts WHERE owner_id = ? ORDER BY created_at DESC";
    return db.query(sql, [owner_id]);
  },

  /**
   * Get accounts by property
   */
  getByPropertyId: async (property_id) => {
    const sql =
      "SELECT * FROM accounts WHERE property_id = ? ORDER BY created_at DESC";
    return db.query(sql, [property_id]);
  },

  /**
   * Get accounts by type
   */
  getByType: async (type) => {
    const sql =
      "SELECT * FROM accounts WHERE type = ? ORDER BY created_at DESC";
    return db.query(sql, [type]);
  },

  /**
   * Get account by ID
   */
  getById: async (id) => {
    const sql = "SELECT * FROM accounts WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get account by name
   */
  getByName: async (name) => {
    const sql = "SELECT * FROM accounts WHERE name = ?";
    const results = await db.query(sql, [name]);
    return results[0] || null;
  },

  /**
   * Create a new account
   */
  create: async ({ owner_id = null, property_id = null, type, name }) => {
    const sql = `INSERT INTO accounts (owner_id, property_id, type, name, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, NOW(), NOW())`;
    const results = await db.query(sql, [owner_id, property_id, type, name]);
    return { id: results.insertId, owner_id, property_id, type, name };
  },

  /**
   * Update account
   */
  update: async (id, { name, type }) => {
    const sql = `UPDATE accounts SET name = ?, type = ?, updated_at = NOW() 
                 WHERE id = ?`;
    await db.query(sql, [name, type, id]);
    return accountRepository.getById(id);
  },

  /**
   * Delete account
   */
  delete: async (id) => {
    const sql = "DELETE FROM accounts WHERE id = ?";
    return db.query(sql, [id]);
  },
};

module.exports = accountRepository;
