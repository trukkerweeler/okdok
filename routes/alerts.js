/**
 * Alerts Routes
 * REST API for managing scheduled SMS alerts
 */
const express = require("express");
const router = express.Router();
const alertsRepository = require("../repositories/alertsRepository");
const { sendAlert, CARRIER_GATEWAYS } = require("../services/alertService");

// GET /alerts - list all alerts
router.get("/", async (req, res) => {
  try {
    const alerts = await alertsRepository.getAll();
    res.json(alerts);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /alerts/smtp-status - check whether SMTP env vars are configured
router.get("/smtp-status", (req, res) => {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((k) => !process.env[k]);
  res.json({ configured: missing.length === 0, missing });
});

// GET /alerts/carriers - list supported carriers
router.get("/carriers", (req, res) => {
  const carriers = Object.keys(CARRIER_GATEWAYS).map((key) => ({
    value: key,
    label: carrierLabel(key),
    gateway: CARRIER_GATEWAYS[key],
  }));
  res.json(carriers);
});

// GET /alerts/:id - get single alert
router.get("/:id", async (req, res) => {
  try {
    const alert = await alertsRepository.getById(req.params.id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (error) {
    console.error("Error fetching alert:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /alerts - create new alert
router.post("/", async (req, res) => {
  try {
    const { name, message, phone_number, carrier, day_of_month, active } =
      req.body;

    if (!name || !message || !phone_number || !carrier || !day_of_month) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const dom = parseInt(day_of_month, 10);
    if (isNaN(dom) || dom < 1 || dom > 28) {
      return res
        .status(400)
        .json({ error: "day_of_month must be between 1 and 28" });
    }

    if (!CARRIER_GATEWAYS[carrier]) {
      return res.status(400).json({ error: "Unsupported carrier" });
    }

    const alert = await alertsRepository.create({
      name,
      message,
      phone_number,
      carrier,
      day_of_month: dom,
      active: active !== undefined ? Number(active) : 1,
    });
    res.status(201).json(alert);
  } catch (error) {
    console.error("Error creating alert:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /alerts/:id - update alert
router.put("/:id", async (req, res) => {
  try {
    const { name, message, phone_number, carrier, day_of_month, active } =
      req.body;

    if (!name || !message || !phone_number || !carrier || !day_of_month) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const dom = parseInt(day_of_month, 10);
    if (isNaN(dom) || dom < 1 || dom > 28) {
      return res
        .status(400)
        .json({ error: "day_of_month must be between 1 and 28" });
    }

    if (!CARRIER_GATEWAYS[carrier]) {
      return res.status(400).json({ error: "Unsupported carrier" });
    }

    const existing = await alertsRepository.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Alert not found" });

    const updated = await alertsRepository.update(req.params.id, {
      name,
      message,
      phone_number,
      carrier,
      day_of_month: dom,
      active: Number(active),
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating alert:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /alerts/:id/send - manually send an alert right now (test send)
router.post("/:id/send", async (req, res) => {
  try {
    const alert = await alertsRepository.getById(req.params.id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    await sendAlert(alert);
    await alertsRepository.markSent(alert.id);
    res.json({ success: true, message: `Alert "${alert.name}" sent.` });
  } catch (error) {
    console.error("Error sending alert:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /alerts/:id - delete alert
router.delete("/:id", async (req, res) => {
  try {
    const existing = await alertsRepository.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Alert not found" });

    await alertsRepository.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting alert:", error);
    res.status(500).json({ error: error.message });
  }
});

// Human-readable carrier labels
function carrierLabel(key) {
  const labels = {
    verizon: "Verizon",
    att: "AT&T",
    tmobile: "T-Mobile",
    sprint: "Sprint",
    uscellular: "US Cellular",
    boost: "Boost Mobile",
    cricket: "Cricket",
    metropcs: "Metro PCS",
    googlefi: "Google Fi",
    mint: "Mint Mobile",
    straighttalk: "Straight Talk",
  };
  return labels[key] || key;
}

module.exports = router;
