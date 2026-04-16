/**
 * Vendors Repository
 * Handles all vendor lookup operations
 */
const db = require("./db");

const vendorsRepository = {
  /**
   * Get all vendors
   */
  getAll: async () => {
    const sql = "SELECT id, name, description FROM vendors ORDER BY name ASC";
    return db.query(sql);
  },

  /**
   * Get vendor by ID
   */
  getById: async (id) => {
    const sql = "SELECT id, name, description FROM vendors WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get vendor by name
   */
  getByName: async (name) => {
    const sql = "SELECT id, name, description FROM vendors WHERE name = ?";
    const results = await db.query(sql, [name]);
    return results[0] || null;
  },

  /**
   * Create a new vendor
   */
  create: async ({ name, description = null }) => {
    // Check if vendor already exists
    const existing = await vendorsRepository.getByName(name);
    if (existing) {
      return existing;
    }

    const sql =
      "INSERT INTO vendors (name, description, created_at) VALUES (?, ?, NOW())";
    const results = await db.query(sql, [name, description]);
    return {
      id: results.insertId,
      name,
      description,
      created_at: new Date(),
    };
  },
};

module.exports = vendorsRepository;
