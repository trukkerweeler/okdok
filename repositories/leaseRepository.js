/**
 * Leases Repository
 * Handles all lease-related database operations
 */
const db = require("./db");

const leaseRepository = {
  /**
   * Get all leases with tenant details
   */
  getAll: async (status = null) => {
    let sql = `SELECT l.*, p.address as property_address, p.city as property_city, p.state as property_state, p.zip as property_zip
               FROM leases l
               LEFT JOIN properties p ON l.property_id = p.id`;
    const params = [];

    if (status) {
      sql += " WHERE l.status = ?";
      params.push(status);
    }

    sql += " ORDER BY l.lease_start DESC";
    return db.query(sql, params);
  },

  /**
   * Get lease by ID with all tenant information
   */
  getById: async (id) => {
    const sql = `SELECT l.*, p.address as property_address, p.city as property_city, p.state as property_state, p.zip as property_zip
                 FROM leases l
                 LEFT JOIN properties p ON l.property_id = p.id
                 WHERE l.id = ?`;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get all leases for a property
   */
  getByPropertyId: async (property_id) => {
    const sql = `SELECT l.*, p.address as property_address
                 FROM leases l
                 LEFT JOIN properties p ON l.property_id = p.id
                 WHERE l.property_id = ?
                 ORDER BY l.lease_start DESC`;
    return db.query(sql, [property_id]);
  },

  /**
   * Create a new lease
   */
  create: async ({
    property_id,
    lease_number,
    lease_start,
    lease_end,
    monthly_rent,
    security_deposit,
    status = "active",
    notes,
  }) => {
    const sql = `INSERT INTO leases (property_id, lease_number, lease_start, lease_end, monthly_rent, security_deposit, status, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    const results = await db.query(sql, [
      property_id,
      lease_number,
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
    ]);
    return {
      id: results.insertId,
      property_id,
      lease_number,
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
    };
  },

  /**
   * Update lease
   */
  update: async (
    id,
    { lease_start, lease_end, monthly_rent, security_deposit, status, notes },
  ) => {
    const sql = `UPDATE leases SET lease_start = ?, lease_end = ?, monthly_rent = ?, security_deposit = ?, status = ?, notes = ?, updated_at = NOW()
                 WHERE id = ?`;
    await db.query(sql, [
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
      id,
    ]);
    return leaseRepository.getById(id);
  },

  /**
   * Delete lease
   */
  delete: async (id) => {
    const sql = "DELETE FROM leases WHERE id = ?";
    return db.query(sql, [id]);
  },

  /**
   * Get all tenants for a lease
   */
  getTenantsForLease: async (lease_id) => {
    const sql = `SELECT t.*, lt.is_primary
                 FROM tenants t
                 JOIN lease_tenants lt ON t.id = lt.tenant_id
                 WHERE lt.lease_id = ?
                 ORDER BY lt.is_primary DESC, t.name ASC`;
    return db.query(sql, [lease_id]);
  },

  /**
   * Add tenant to lease
   */
  addTenant: async (lease_id, tenant_id, is_primary = false) => {
    const sql = `INSERT INTO lease_tenants (lease_id, tenant_id, is_primary)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_primary = ?`;
    return db.query(sql, [lease_id, tenant_id, is_primary, is_primary]);
  },

  /**
   * Remove tenant from lease
   */
  removeTenant: async (lease_id, tenant_id) => {
    const sql =
      "DELETE FROM lease_tenants WHERE lease_id = ? AND tenant_id = ?";
    return db.query(sql, [lease_id, tenant_id]);
  },

  /**
   * Get primary tenant for a lease
   */
  getPrimaryTenant: async (lease_id) => {
    const sql = `SELECT t.* FROM tenants t
                 JOIN lease_tenants lt ON t.id = lt.tenant_id
                 WHERE lt.lease_id = ? AND lt.is_primary = TRUE`;
    const results = await db.query(sql, [lease_id]);
    return results[0] || null;
  },

  /**
   * Set primary tenant for a lease
   */
  setPrimaryTenant: async (lease_id, tenant_id) => {
    // First, unset all primary tenants for this lease
    let sql = "UPDATE lease_tenants SET is_primary = FALSE WHERE lease_id = ?";
    await db.query(sql, [lease_id]);

    // Then set the new primary tenant
    sql =
      "UPDATE lease_tenants SET is_primary = TRUE WHERE lease_id = ? AND tenant_id = ?";
    await db.query(sql, [lease_id, tenant_id]);

    return leaseRepository.getPrimaryTenant(lease_id);
  },

  /**
   * Get next lease number for a property (format: PROP-YYYY-XXX)
   */
  getNextLeaseNumber: async (property_id) => {
    const currentYear = new Date().getFullYear();
    const sql = `SELECT COUNT(*) as count FROM leases 
                 WHERE property_id = ? AND YEAR(lease_start) = ?`;
    const results = await db.query(sql, [property_id, currentYear]);
    const count = results[0].count || 0;
    const sequenceNumber = 101 + count;
    return `${property_id}-${currentYear}-${String(sequenceNumber).padStart(3, "0")}`;
  },
};

module.exports = leaseRepository;
