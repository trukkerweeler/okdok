const db = require("./db");

const tenantCommunicationLogRepository = {
  getByTenantId: async (tenant_id) => {
    return db.query(
      `SELECT id, tenant_id, communication_date, method, subject, outcome,
              notes, next_follow_up_date, created_by, created_at
       FROM tenant_communication_logs
       WHERE tenant_id = ?
       ORDER BY communication_date DESC, id DESC`,
      [tenant_id],
    );
  },

  create: async ({
    tenant_id,
    communication_date,
    method,
    subject,
    outcome,
    notes,
    next_follow_up_date,
    created_by,
  }) => {
    const result = await db.query(
      `INSERT INTO tenant_communication_logs
       (tenant_id, communication_date, method, subject, outcome, notes,
        next_follow_up_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant_id,
        communication_date,
        method,
        subject,
        outcome,
        notes || null,
        next_follow_up_date || null,
        created_by || null,
      ],
    );
    const rows = await db.query(
      `SELECT id, tenant_id, communication_date, method, subject, outcome,
              notes, next_follow_up_date, created_by, created_at
       FROM tenant_communication_logs WHERE id = ?`,
      [result.insertId],
    );
    return rows[0];
  },

  delete: async (id) =>
    db.query("DELETE FROM tenant_communication_logs WHERE id = ?", [id]),
};

module.exports = tenantCommunicationLogRepository;
