/**
 * Company Settings Repository
 * Handles all company settings database operations
 */
const db = require("./db");

const companySettingsRepository = {
  /**
   * Get all settings as an object
   */
  getAll: async () => {
    const sql = `SELECT setting_key, setting_value FROM company_settings ORDER BY setting_key`;
    const results = await db.query(sql);

    // Convert array of {setting_key, setting_value} to object {key: value}
    const settings = {};
    results.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  },

  /**
   * Get a specific setting by key
   */
  getByKey: async (key) => {
    const sql = `SELECT setting_value FROM company_settings WHERE setting_key = ?`;
    const results = await db.query(sql, [key]);
    return results.length > 0 ? results[0].setting_value : null;
  },

  /**
   * Get multiple settings by keys
   */
  getByKeys: async (keys) => {
    if (!keys || keys.length === 0) return {};

    const placeholders = keys.map(() => "?").join(",");
    const sql = `SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN (${placeholders})`;
    const results = await db.query(sql, keys);

    const settings = {};
    results.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  },

  /**
   * Update a setting
   */
  update: async (key, value) => {
    const sql = `
      INSERT INTO company_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = ?
    `;
    await db.query(sql, [key, value, value]);
    return { setting_key: key, setting_value: value };
  },

  /**
   * Update multiple settings
   */
  updateMultiple: async (settings) => {
    const promises = Object.entries(settings).map(([key, value]) =>
      companySettingsRepository.update(key, value),
    );
    return Promise.all(promises);
  },
};

module.exports = companySettingsRepository;
