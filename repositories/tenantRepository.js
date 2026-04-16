/**
 * Tenant Repository
 * Handles all tenant-related database operations
 */
const db = require("./db");

const tenantRepository = {
  /**
   * Get all tenants
   */
  getAll: async () => {
    const sql = "SELECT * FROM tenants ORDER BY created_at DESC";
    return db.query(sql);
  },

  /**
   * Get tenants by property
   */
  getByPropertyId: async (property_id) => {
    const sql =
      "SELECT * FROM tenants WHERE property_id = ? ORDER BY created_at DESC";
    return db.query(sql, [property_id]);
  },

  /**
   * Get tenant by ID
   */
  getById: async (id) => {
    const sql = "SELECT * FROM tenants WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Create a new tenant
   */
  create: async ({
    property_id,
    name,
    email,
    phone,
    lease_start,
    lease_end,
    rent_amount,
    deposit_amount,
  }) => {
    const sql = `INSERT INTO tenants (property_id, name, email, phone, lease_start, lease_end, rent_amount, deposit_amount, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    const results = await db.query(sql, [
      property_id,
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
    ]);
    return {
      id: results.insertId,
      property_id,
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
    };
  },

  /**
   * Update tenant
   */
  update: async (
    id,
    { name, email, phone, lease_start, lease_end, rent_amount, deposit_amount },
  ) => {
    const sql = `UPDATE tenants SET name = ?, email = ?, phone = ?, lease_start = ?, lease_end = ?, rent_amount = ?, deposit_amount = ?, updated_at = NOW() 
                 WHERE id = ?`;
    await db.query(sql, [
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
      id,
    ]);
    return tenantRepository.getById(id);
  },

  /**
   * Delete tenant
   */
  delete: async (id) => {
    const sql = "DELETE FROM tenants WHERE id = ?";
    return db.query(sql, [id]);
  },
};

module.exports = tenantRepository;
