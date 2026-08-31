const db = require("./db");

const propertyNotesRepository = {
  getAll: async () => {
    const sql = `
      SELECT pn.*, p.address AS property_address
      FROM property_invoice_notes pn
      LEFT JOIN properties p ON pn.property_id = p.id
      ORDER BY p.address, pn.is_active DESC, pn.created_at DESC
    `;
    return db.query(sql);
  },

  getById: async (id) => {
    const sql = `
      SELECT pn.*, p.address AS property_address
      FROM property_invoice_notes pn
      LEFT JOIN properties p ON pn.property_id = p.id
      WHERE pn.id = ?
    `;
    const results = await db.query(sql, [id]);
    return results[0] || null;
  },

  getByPropertyId: async (property_id) => {
    const sql = `
      SELECT pn.*, p.address AS property_address
      FROM property_invoice_notes pn
      LEFT JOIN properties p ON pn.property_id = p.id
      WHERE pn.property_id = ?
      ORDER BY pn.is_active DESC, pn.created_at DESC
    `;
    return db.query(sql, [property_id]);
  },

  getActiveByPropertyId: async (property_id) => {
    const sql = `
      SELECT * FROM property_invoice_notes
      WHERE property_id = ? AND is_active = 1
      ORDER BY created_at ASC
    `;
    return db.query(sql, [property_id]);
  },

  create: async ({ property_id, note_text, is_active = true }) => {
    const sql = `
      INSERT INTO property_invoice_notes (property_id, note_text, is_active)
      VALUES (?, ?, ?)
    `;
    const result = await db.query(sql, [
      property_id,
      note_text,
      is_active ? 1 : 0,
    ]);
    return propertyNotesRepository.getById(result.insertId);
  },

  update: async (id, { property_id, note_text, is_active }) => {
    const sql = `
      UPDATE property_invoice_notes
      SET property_id = ?, note_text = ?, is_active = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await db.query(sql, [property_id, note_text, is_active ? 1 : 0, id]);
    return propertyNotesRepository.getById(id);
  },

  delete: async (id) => {
    return db.query("DELETE FROM property_invoice_notes WHERE id = ?", [id]);
  },
};

module.exports = propertyNotesRepository;
