const db = require("./db");

const noticeRepository = {
  getAll: async () => {
    return db.query(`
      SELECT id, notice_type, notice_date, tenant_id, property_id,
             tenant_name, property_address, amount_owed, rent_period_start,
             rent_period_end, status, created_at, updated_at
      FROM notices
      ORDER BY notice_date DESC, id DESC
    `);
  },

  getById: async (id) => {
    const rows = await db.query("SELECT * FROM notices WHERE id = ?", [id]);
    return rows[0] || null;
  },

  create: async ({
    notice_type,
    notice_date,
    tenant_id,
    property_id,
    tenant_name,
    tenant_mailing_address,
    property_address,
    amount_owed,
    rent_period_start,
    rent_period_end,
    landlord_name,
    landlord_phone,
    landlord_address,
    status,
    content_snapshot,
  }) => {
    const result = await db.query(
      `INSERT INTO notices
       (notice_type, notice_date, tenant_id, property_id, tenant_name,
        tenant_mailing_address, property_address, amount_owed,
        rent_period_start, rent_period_end, landlord_name, landlord_phone,
        landlord_address, status, content_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notice_type,
        notice_date,
        tenant_id || null,
        property_id || null,
        tenant_name || null,
        tenant_mailing_address || null,
        property_address || null,
        amount_owed,
        rent_period_start || null,
        rent_period_end || null,
        landlord_name,
        landlord_phone,
        landlord_address,
        status || "draft",
        content_snapshot,
      ],
    );

    return noticeRepository.getById(result.insertId);
  },

  update: async (
    id,
    {
      notice_type,
      notice_date,
      tenant_id,
      property_id,
      tenant_name,
      tenant_mailing_address,
      property_address,
      amount_owed,
      rent_period_start,
      rent_period_end,
      landlord_name,
      landlord_phone,
      landlord_address,
      status,
      content_snapshot,
    },
  ) => {
    await db.query(
      `UPDATE notices
       SET notice_type = ?, notice_date = ?, tenant_id = ?, property_id = ?,
           tenant_name = ?, tenant_mailing_address = ?, property_address = ?,
           amount_owed = ?, rent_period_start = ?, rent_period_end = ?,
           landlord_name = ?, landlord_phone = ?, landlord_address = ?,
           status = ?, content_snapshot = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        notice_type,
        notice_date,
        tenant_id || null,
        property_id || null,
        tenant_name || null,
        tenant_mailing_address || null,
        property_address || null,
        amount_owed,
        rent_period_start || null,
        rent_period_end || null,
        landlord_name,
        landlord_phone,
        landlord_address,
        status || "draft",
        content_snapshot,
        id,
      ],
    );
    return noticeRepository.getById(id);
  },
};

module.exports = noticeRepository;
