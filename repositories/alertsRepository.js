/**
 * Alerts Repository
 * Database operations for scheduled SMS alerts
 */
const db = require("./db");

const alertsRepository = {
  getAll: async () => {
    return db.query("SELECT * FROM alerts ORDER BY day_of_month ASC, name ASC");
  },

  getById: async (id) => {
    const results = await db.query("SELECT * FROM alerts WHERE id = ?", [id]);
    return results[0] || null;
  },

  getActiveForDay: async (dayOfMonth) => {
    return db.query(
      `SELECT * FROM alerts
       WHERE active = 1
         AND day_of_month = ?
         AND (last_sent_date IS NULL OR last_sent_date < CURDATE())`,
      [dayOfMonth],
    );
  },

  create: async (data) => {
    const { name, message, phone_number, carrier, day_of_month, active } = data;
    const result = await db.query(
      `INSERT INTO alerts (name, message, phone_number, carrier, day_of_month, active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, message, phone_number, carrier, day_of_month, active ?? 1],
    );
    return { id: result.insertId, ...data };
  },

  update: async (id, data) => {
    const { name, message, phone_number, carrier, day_of_month, active } = data;
    await db.query(
      `UPDATE alerts SET name=?, message=?, phone_number=?, carrier=?,
       day_of_month=?, active=? WHERE id=?`,
      [name, message, phone_number, carrier, day_of_month, active, id],
    );
    return alertsRepository.getById(id);
  },

  markSent: async (id) => {
    await db.query(
      "UPDATE alerts SET last_sent_date = CURDATE() WHERE id = ?",
      [id],
    );
  },

  delete: async (id) => {
    await db.query("DELETE FROM alerts WHERE id = ?", [id]);
  },
};

module.exports = alertsRepository;
