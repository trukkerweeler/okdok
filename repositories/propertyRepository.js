/**
 * Property Repository
 * Handles all property-related database operations
 */
const db = require("./db");

const propertyRepository = {
  /**
   * Get all properties
   */
  getAll: async () => {
    const sql = "SELECT * FROM properties ORDER BY created_at DESC";
    return db.query(sql);
  },

  /**
   * Get properties by owner
   */
  getByOwnerId: async (owner_id) => {
    const sql =
      "SELECT * FROM properties WHERE owner_id = ? ORDER BY created_at DESC";
    return db.query(sql, [owner_id]);
  },

  /**
   * Get property by ID
   */
  getById: async (id) => {
    const sql = "SELECT * FROM properties WHERE id = ?";
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Create a new property
   */
  create: async ({
    owner_id,
    address,
    city,
    state,
    zip,
    status = "active",
  }) => {
    const sql = `INSERT INTO properties (owner_id, address, city, state, zip, status, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    const results = await db.query(sql, [
      owner_id,
      address,
      city,
      state,
      zip,
      status,
    ]);
    return {
      id: results.insertId,
      owner_id,
      address,
      city,
      state,
      zip,
      status,
    };
  },

  /**
   * Update property
   */
  update: async (
    id,
    { address, city, state, zip, status, primary_tenant_id },
  ) => {
    const sql = `UPDATE properties SET address = ?, city = ?, state = ?, zip = ?, status = ?, primary_tenant_id = ?, updated_at = NOW() 
                 WHERE id = ?`;
    await db.query(sql, [
      address,
      city,
      state,
      zip,
      status,
      primary_tenant_id,
      id,
    ]);
    return propertyRepository.getById(id);
  },

  /**
   * Set primary tenant for a property
   */
  setPrimaryTenant: async (property_id, tenant_id) => {
    const sql = `UPDATE properties SET primary_tenant_id = ?, updated_at = NOW() WHERE id = ?`;
    await db.query(sql, [tenant_id, property_id]);
    return propertyRepository.getByIdWithPrimaryTenant(property_id);
  },

  /**
   * Get property by ID with primary tenant details
   */
  getByIdWithPrimaryTenant: async (id) => {
    const sql = `SELECT p.*, 
                 pt.id as primary_tenant_id, pt.name as primary_tenant_name, 
                 pt.email as primary_tenant_email, pt.phone as primary_tenant_phone
                 FROM properties p
                 LEFT JOIN tenants pt ON p.primary_tenant_id = pt.id
                 WHERE p.id = ?`;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Delete property
   */
  delete: async (id) => {
    const sql = "DELETE FROM properties WHERE id = ?";
    return db.query(sql, [id]);
  },
};

module.exports = propertyRepository;
