/**
 * Alert Service
 * Sends SMS alerts via email-to-SMS carrier gateways (free, no API key needed)
 * Same approach as VBS/CDO email-to-SMS from 2022
 */
const nodemailer = require("nodemailer");
const alertsRepository = require("../repositories/alertsRepository");

// Carrier SMS gateway email addresses
const CARRIER_GATEWAYS = {
  verizon: "@vtext.com",
  att: "@txt.att.net",
  tmobile: "@tmomail.net",
  sprint: "@messaging.sprintpcs.com",
  uscellular: "@email.uscc.net",
  boost: "@sms.myboostmobile.com",
  cricket: "@sms.cricketwireless.net",
  metropcs: "@mymetropcs.com",
  googlefi: "@msg.fi.google.com",
  mint: "@mailmymobile.net",
  straighttalk: "@vtext.com",
};

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Send a single alert via email-to-SMS gateway
 * @param {object} alert - alert row from DB
 */
async function sendAlert(alert) {
  const gateway = CARRIER_GATEWAYS[alert.carrier];
  if (!gateway) {
    throw new Error(`Unknown carrier: ${alert.carrier}`);
  }

  // Strip non-digits from phone number
  const digits = alert.phone_number.replace(/\D/g, "");
  const toAddress = `${digits}${gateway}`;

  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: toAddress,
    subject: "", // Carriers include subject in the SMS body; keep empty
    text: alert.message,
  });

  console.log(`[AlertService] Sent "${alert.name}" to ${toAddress}`);
}

/**
 * Run daily check: send any alerts due today and mark them sent
 */
async function runDailyAlerts() {
  const today = new Date();
  const dayOfMonth = today.getDate();

  let dueAlerts;
  try {
    dueAlerts = await alertsRepository.getActiveForDay(dayOfMonth);
  } catch (err) {
    console.error("[AlertService] DB error fetching due alerts:", err.message);
    return;
  }

  if (dueAlerts.length === 0) {
    console.log(`[AlertService] No alerts due today (day ${dayOfMonth})`);
    return;
  }

  console.log(
    `[AlertService] ${dueAlerts.length} alert(s) due on day ${dayOfMonth}`,
  );

  for (const alert of dueAlerts) {
    try {
      await sendAlert(alert);
      await alertsRepository.markSent(alert.id);
    } catch (err) {
      console.error(
        `[AlertService] Failed to send alert "${alert.name}":`,
        err.message,
      );
    }
  }
}

module.exports = { sendAlert, runDailyAlerts, CARRIER_GATEWAYS };
