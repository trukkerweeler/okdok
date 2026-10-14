const express = require("express");
const noticeRepository = require("../repositories/noticeRepository");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    res.json(await noticeRepository.getAll());
  } catch (error) {
    console.error("Error fetching notices:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const notice = await noticeRepository.getById(req.params.id);
    if (!notice) return res.status(404).json({ error: "Notice not found" });
    res.json(notice);
  } catch (error) {
    console.error("Error fetching notice:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
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
    } = req.body;

    if (!notice_type || !notice_date || !amount_owed || !content_snapshot) {
      return res.status(400).json({
        error: "Notice type, date, amount owed, and notice content are required",
      });
    }

    const notice = await noticeRepository.create({
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
    });

    res.status(201).json(notice);
  } catch (error) {
    console.error("Error creating notice:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const {
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
    } = req.body;

    if (!notice_type || !notice_date || !amount_owed || !content_snapshot) {
      return res.status(400).json({
        error: "Notice type, date, amount owed, and notice content are required",
      });
    }

    const existingNotice = await noticeRepository.getById(req.params.id);
    if (!existingNotice) {
      return res.status(404).json({ error: "Notice not found" });
    }

    const notice = await noticeRepository.update(req.params.id, {
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
    });
    res.json(notice);
  } catch (error) {
    console.error("Error updating notice:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
