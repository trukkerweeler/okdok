/**
 * Mileage Repository
 * Handles all mileage tracking database operations
 */
const db = require("./db");

const mileageRepository = {
  /**
   * Get all mileage entries
   */
  getAll: async () => {
    const sql = `
      SELECT 
        m.*,
        p.address as property_address,
        o.name as owner_name
      FROM mileage_log m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN owners o ON m.owner_id = o.id
      ORDER BY m.date DESC
    `;
    return db.query(sql);
  },

  /**
   * Get mileage by ID
   */
  getById: async (id) => {
    const sql = `
      SELECT 
        m.*,
        p.address as property_address,
        o.name as owner_name
      FROM mileage_log m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  /**
   * Get mileage entries for a specific property
   */
  getByPropertyId: async (property_id) => {
    const sql = `
      SELECT 
        m.*,
        p.address as property_address,
        o.name as owner_name
      FROM mileage_log m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.property_id = ?
      ORDER BY m.date DESC
    `;
    return db.query(sql, [property_id]);
  },

  /**
   * Get mileage entries for a specific owner
   */
  getByOwnerId: async (owner_id) => {
    const sql = `
      SELECT 
        m.*,
        p.address as property_address,
        o.name as owner_name
      FROM mileage_log m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.owner_id = ?
      ORDER BY m.date DESC
    `;
    return db.query(sql, [owner_id]);
  },

  /**
   * Get mileage entries for a date range
   */
  getByDateRange: async (startDate, endDate) => {
    const sql = `
      SELECT 
        m.*,
        p.address as property_address,
        o.name as owner_name
      FROM mileage_log m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.date BETWEEN ? AND ?
      ORDER BY m.date DESC
    `;
    return db.query(sql, [startDate, endDate]);
  },

  /**
   * Get mileage entries by category
   */
  getByCategory: async (category) => {
    const sql = `
      SELECT 
        m.*,
        p.address as property_address,
        o.name as owner_name
      FROM mileage_log m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.category = ?
      ORDER BY m.date DESC
    `;
    return db.query(sql, [category]);
  },

  /**
   * Get monthly mileage summary
   */
  getMonthlySummary: async (year, month) => {
    const sql = `
      SELECT 
        category,
        COUNT(*) as entry_count,
        SUM(miles_driven) as total_miles,
        AVG(miles_driven) as avg_miles
      FROM mileage_log
      WHERE YEAR(date) = ? AND MONTH(date) = ?
      GROUP BY category
      ORDER BY category
    `;
    return db.query(sql, [year, month]);
  },

  /**
   * Get total mileage for date range
   */
  getTotalMiles: async (startDate, endDate) => {
    const sql = `
      SELECT 
        SUM(miles_driven) as total_miles,
        COUNT(*) as entry_count,
        AVG(miles_driven) as avg_miles
      FROM mileage_log
      WHERE date BETWEEN ? AND ?
    `;
    const results = await db.query(sql, [startDate, endDate]);
    return results[0] || { total_miles: 0, entry_count: 0, avg_miles: 0 };
  },

  /**
   * Create a new mileage entry
   */
  create: async ({
    date,
    miles_driven,
    starting_location,
    ending_location,
    purpose,
    category,
    property_id,
    owner_id,
    notes,
  }) => {
    const sql = `
      INSERT INTO mileage_log 
      (date, miles_driven, starting_location, ending_location, purpose, category, property_id, owner_id, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const results = await db.query(sql, [
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id || null,
      owner_id || null,
      notes,
    ]);
    return mileageRepository.getById(results.insertId);
  },

  /**
   * Update a mileage entry
   */
  update: async (
    id,
    {
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id,
      owner_id,
      notes,
    },
  ) => {
    const sql = `
      UPDATE mileage_log
      SET 
        date = ?,
        miles_driven = ?,
        starting_location = ?,
        ending_location = ?,
        purpose = ?,
        category = ?,
        property_id = ?,
        owner_id = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    await db.query(sql, [
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id || null,
      owner_id || null,
      notes,
      id,
    ]);
    return mileageRepository.getById(id);
  },

  /**
   * Delete a mileage entry
   */
  delete: async (id) => {
    const sql = "DELETE FROM mileage_log WHERE id = ?";
    await db.query(sql, [id]);
  },
};

module.exports = mileageRepository;
