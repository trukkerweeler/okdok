const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const nodemailer = require("nodemailer");

// Helper: pad numeric INPUT_ID values to 7-character strings
function padInputIdRows(rows) {
  if (!rows) return rows;
  try {
    if (Array.isArray(rows)) {
      return rows.map((r) => {
        if (
          r &&
          Object.prototype.hasOwnProperty.call(r, "INPUT_ID") &&
          r.INPUT_ID != null
        ) {
          r.INPUT_ID = String(r.INPUT_ID).padStart(7, "0");
        }
        return r;
      });
    } else if (rows && typeof rows === "object") {
      if (
        Object.prototype.hasOwnProperty.call(rows, "INPUT_ID") &&
        rows.INPUT_ID != null
      ) {
        rows.INPUT_ID = String(rows.INPUT_ID).padStart(7, "0");
      }
      return rows;
    }
  } catch (e) {
    console.error("padInputIdRows error:", e);
  }
  return rows;
}

// ==================================================
// Send email using nodemailer
// ==================================================
// Send email using nodemailer
router.post("/email/:id", async (req, res) => {
  // const iid = req.params.id;
  // console.log(req.body);
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const { iid, to, from, subject, text } = req.body.data;
    let blindCopy = "<tim.kent@ci-aviation.com>";
    const mailOptions = {
      from,
      to,
      subject,
      text,
      bcc: blindCopy,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log("Email sent:", info.response);
    res.status(200).send("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send(error.toString());
  }
});

// ==================================================
// Get all records
router.get("/", (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      // console.log('Connected to DB');

      const query = `select pi.INPUT_ID
        , pi.INPUT_DATE
        , pi.SUBJECT
        , pi.ASSIGNED_TO
        , pi.PROJECT_ID
        , pit.INPUT_TEXT
        , pi.DUE_DATE
        , pi.CLOSED
        , pi.CLOSED_DATE 
        from PEOPLE_INPUT pi left join PPL_INPT_TEXT pit on pi.INPUT_ID = pit.INPUT_ID order by pi.INPUT_ID desc`;
      // where USER_DEFINED_1 = 'MR'

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for inputs:", err);
          res.sendStatus(500);
          return;
        }
        res.json(padInputIdRows(rows));
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db");
    return;
  }
});

// ==================================================
// Get closed records
router.get("/closed", (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      // console.log('Connected to DB');

      const query = `select pi.INPUT_ID
        , pi.INPUT_DATE
        , pi.SUBJECT
        , pi.ASSIGNED_TO
        , pi.PROJECT_ID
        , pit.INPUT_TEXT
        , pi.DUE_DATE
        , pi.CLOSED
        , pi.CLOSED_DATE 
        from PEOPLE_INPUT pi left join PPL_INPT_TEXT pit on pi.INPUT_ID = pit.INPUT_ID where CLOSED = 'Y' order by pi.CLOSED_DATE desc`;
      // where USER_DEFINED_1 = 'MR'

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for inputs:", err);
          res.sendStatus(500);
          return;
        }
        res.json(padInputIdRows(rows));
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db");
    return;
  }
});

// Get the next ID for a new record
router.get("/nextId", (req, res) => {
  // Return the next AUTO_INCREMENT value for PEOPLE_INPUT (padded)
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        res.sendStatus(500);
        return;
      }

      const query = `SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`;
      connection.query(
        query,
        [process.env.DB_NAME || "okdok", "PEOPLE_INPUT"],
        (err, rows) => {
          if (err || !rows || rows.length === 0) {
            console.error("Failed to query next AUTO_INCREMENT:", err);
            connection.end();
            res.sendStatus(500);
            return;
          }
          const next = rows[0].AUTO_INCREMENT || 1;
          res.json(String(next).padStart(7, "0"));
          connection.end();
        },
      );
    });
  } catch (err) {
    console.error("Error connecting to Db 93:", err);
    res.sendStatus(500);
    return;
  }
});

// ==================================================
// Send email using nodemailer
router.post("/email", async (req, res) => {
  // console.log('Email route');
  // console.log(req.body);
  try {
    // SMTP debug flag - set to true to enable detailed SMTP logging
    const SMTP_DEBUG = false;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      debug: SMTP_DEBUG, // Enable/disable SMTP debugging
    });

    // Verify connection configuration
    // await transporter.verify();

    const mailOptions = {
      to: req.body.ASSIGNED_TO_EMAIL,
      from: process.env.SMTP_FROM,
      subject: `Action Item Notification: ${req.body.INPUT_ID} - ${req.body.SUBJECT}`,
      text: `The following action item has been assigned.\nInput Id: ${req.body.INPUT_ID} \nDue Date: ${req.body.DUE_DATE} \nAssigned To: ${req.body.ASSIGNED_TO} \nDescription:\n${req.body.INPUT_TEXT}\n\nPlease log in to the QMS system to view the details and take timely action.\n\nIf you have any questions, please contact the quality manager.`,
    };

    const info = await transporter.sendMail(mailOptions);
    res.status(200).send("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send(error.toString());
  }
});

// ==================================================
// update INPUTS_NOTIFY table
router.post("/inputs_notify", (req, res) => {
  // console.log("Inputs Notify:", req.body);
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting inputs_notify: " + err.stack);
        return;
      }
      // console.log('Connected to DB');
      const query = `INSERT INTO INPUTS_NOTIFY (INPUT_ID, NOTIFIED_DATE, ASSIGNED_TO, ACTION) VALUES (?, NOW(), ?, ?)`;
      // Support both direct and nested (data) payloads
      const data = req.body.data ? req.body.data : req.body;
      const { INPUT_ID, ASSIGNED_TO, ACTION } = data;
      const values = [INPUT_ID, ASSIGNED_TO, ACTION];
      // console.log(query);
      // console.log(values);
      connection.query(query, values, (err) => {
        if (err) {
          console.error("Failed to query for inputs notify:", err);
          res.sendStatus(500);
          return;
        }
        res.sendStatus(200);
      });
      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db 214", err);
    return;
  }
});

// ==================================================
// Create a record
router.post("/", (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });

    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        res.status(500).json({ error: "Database connection failed" });
        return;
      }

      const data = req.body || {};

      // Insert into PEOPLE_INPUT without INPUT_ID (DB should assign AUTO_INCREMENT)
      const insertMain = `INSERT INTO PEOPLE_INPUT (
        INPUT_DATE, PEOPLE_ID, ASSIGNED_TO, DUE_DATE, INPUT_TYPE, SUBJECT, PROJECT_ID, CLOSED, CREATE_DATE, CREATE_BY
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        data.INPUT_DATE || null,
        data.PEOPLE_ID || null,
        data.ASSIGNED_TO || null,
        data.DUE_DATE || null,
        data.INPUT_TYPE || null,
        data.SUBJECT || null,
        data.PROJECT_ID || null,
        data.CLOSED || "N",
        data.CREATE_DATE || null,
        data.CREATE_BY || null,
      ];

      connection.query(insertMain, values, (err, result) => {
        if (err) {
          console.error("Failed to insert PEOPLE_INPUT:", err);
          connection.end();
          res.status(500).json({ error: "Failed to insert PEOPLE_INPUT" });
          return;
        }

        const insertId = result.insertId; // DB-assigned numeric id (INPUT_ID if column made AUTO_INCREMENT)

        // Insert associated text
        const insertText = `INSERT INTO PPL_INPT_TEXT (INPUT_ID, INPUT_TEXT) VALUES (?, ?)`;
        const textVal = data.INPUT_TEXT || "";
        connection.query(insertText, [insertId, textVal], (err) => {
          if (err) {
            console.error("Failed to insert PPL_INPT_TEXT:", err);
            connection.end();
            res.status(500).json({ error: "Failed to insert PPL_INPT_TEXT" });
            return;
          }

          connection.end();
          res.json({
            success: true,
            INPUT_ID: String(insertId).padStart(7, "0"),
            rawId: insertId,
          });
        });
      });
    });
  } catch (err) {
    console.error("Error in POST /input:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// ==================================================
// increment the ID
router.put("/incrementId", (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      // console.log('Connected to DB');

      const query = `UPDATE SYSTEM_IDS SET CURRENT_ID = LPAD(CAST(CAST(CURRENT_ID AS UNSIGNED) + 1 AS CHAR), 7, '0') WHERE TABLE_NAME = 'PEOPLE_INPUT'`;
      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for system id update:", err);
          res.sendStatus(500);
          return;
        }
        res.json(rows);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db 318", err);
    return;
  }
});

// ==================================================
// Get a single record
router.get("/:id", (req, res) => {
  // console.log(req.params.id);
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      // console.log('Connected to DB');

      const query = `SELECT 
        pi.INPUT_ID
        , pi.PEOPLE_ID
        , pi.PROJECT_ID
        , INPUT_DATE
        , pi.DUE_DATE
        , pi.ASSIGNED_TO
        , INPUT_TYPE
        , pi.SUBJECT
        , pi.CLOSED
        , pi.CLOSED_DATE
        , pit.INPUT_TEXT
        , pi.RESPONSE_DATE
        , pi.RESPONSE_BY
        , pi.FOLLOWUP_DATE
        , pi.FOLLOWUP_BY
        , pir.RESPONSE_TEXT
        , pif.FOLLOWUP_TEXT 
        , p.NAME
        , pirc.RECUR_ID
        FROM okdok.PEOPLE_INPUT pi left join PPL_INPT_TEXT pit on pi.INPUT_ID = pit.INPUT_ID
        left join PPL_INPT_FLUP pif on pi.INPUT_ID = pif.INPUT_ID
        left join PPL_INPT_RSPN pir on pi.INPUT_ID = pir.INPUT_ID 
        left join PROJECT p on pi.PROJECT_ID = p.PROJECT_ID
        left join PPL_INPT_RCUR pirc on pi.USER_DEFINED_2 = pirc.RECUR_ID
        where pi.INPUT_ID = '${req.params.id}'`;

      // console.log(query);

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for corrective actions:", err);
          res.sendStatus(500);
          return;
        }
        res.json(padInputIdRows(rows));
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db 83", err);
    return;
  }
});

// RESPONSES<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
router.put("/:id", (req, res) => {
  // console.log("Params: " + req.params.id);
  // console.log(req.body);
  // console.log(req.body['data']);
  let mydata = req.body["data"];
  let mytable = "";
  let appended = "";
  // const myfield = Object.keys (req.body) [2]
  const myfield = Object.keys(mydata)[2];
  // console.log("257: " + myfield);
  // log the name of the third key
  switch (myfield) {
    case "RESPONSE_TEXT":
      // console.log('Response');
      mytable = "PPL_INPT_RSPN";
      // appended = req.body.RESPONSE_TEXT.replace(/'/g, "\\'");
      // appended = req.body.RESPONSE_TEXT;
      appended = mydata.RESPONSE_TEXT;
      break;
    case "FOLLOWUP_TEXT":
      // console.log('Followup');
      mytable = "PPL_INPT_FLUP";
      // appended = req.body.FOLLOWUP_TEXT.replace(/'/g, "/''");
      // appended = req.body.FOLLOWUP_TEXT
      appended = mydata.FOLLOWUP_TEXT;
      break;
    case "INPUT_TEXT":
      // console.log('Input');
      mytable = "PPL_INPT_TEXT";
      // appended = req.body.INPUT_TEXT
      appended = mydata.INPUT_TEXT;
      break;
    default:
      console.warn("No match");
  }
  // Replace the br with a newline
  appended = appended.replace(/<br>/g, "\n");
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      // console.log('Connected to DB');
      // console.log(req.body);
      const query = `REPLACE INTO ${mytable} SET 
            INPUT_ID = ?,
            ?? = ?`;

      const values = [req.params.id, myfield, appended];
      // console.log(query);

      connection.query(query, values, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for input :", err);
          res.sendStatus(500);
          connection.end();
          return;
        }
        res.json(rows);

        if (myfield === "RESPONSE_TEXT") {
          const updateQuery = `
              UPDATE PEOPLE_INPUT 
              SET RESPONSE_DATE = ?, 
                  RESPONSE_BY = ?,
                  MODIFIED_BY = ?, 
                  MODIFIED_DATE = ? 
              WHERE INPUT_ID = ?`;
          const updateValues = [
            mydata.RESPONSE_DATE,
            mydata.RESPONSE_BY,
            mydata.MODIFIED_BY,
            mydata.MODIFIED_DATE,
            req.params.id,
          ];
          connection.query(updateQuery, updateValues, (err) => {
            if (err) {
              console.error("Failed to query for response date update:", err);
              res.sendStatus(500);
            }
            connection.end();
          });
        } else if (myfield === "FOLLOWUP_TEXT") {
          const updateQuery = `
              UPDATE PEOPLE_INPUT 
              SET FOLLOWUP_DATE = ?, 
                  FOLLOWUP_BY = ?,
                  MODIFIED_BY = ?, 
                  MODIFIED_DATE = ? 
              WHERE INPUT_ID = ?`;
          const updateValues = [
            mydata.FOLLOWUP_DATE,
            mydata.FOLLOWUP_BY,
            mydata.MODIFIED_BY,
            mydata.MODIFIED_DATE,
            req.params.id,
          ];
          connection.query(updateQuery, updateValues, (err) => {
            if (err) {
              console.error("Failed to query for followup date update:", err);
              res.sendStatus(500);
            }
            connection.end();
          });
        } else {
          connection.end();
        }
      });
    });
  } catch (err) {
    console.error("Error connecting to Db 312", err);
    return;
  }
});

// CLOSE THE INPUT<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
router.put("/close/:id", (req, res) => {
  // console.log("Params: " + req.params.id);
  // console.log(req.body);
  let mytable = "";
  let appended = "";
  const myfield = Object.keys(req.body)[1];

  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      const query = `UPDATE PEOPLE_INPUT SET CLOSED = 'Y', CLOSED_DATE = '${req.body.CLOSED_DATE}' WHERE INPUT_ID = '${req.params.id}'`;
      // console.log(query);

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for input :", err);
          res.sendStatus(500);
          return;
        }
        res.json(rows);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db 345", err);
    return;
  }
});

// ==================================================
// Get previous records
router.get("/previous/:id", (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }

      const query = `with subjects as (select * from PEOPLE_INPUT where SUBJECT = (select SUBJECT from PEOPLE_INPUT where INPUT_ID = '${req.params.id}')) select * from PPL_INPT_RSPN pir join subjects on pir.INPUT_ID = subjects.INPUT_ID order by pir.INPUT_ID desc limit 5`;

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for corrective actions:", err);
          res.sendStatus(500);
          return;
        }
        res.json(padInputIdRows(rows));
      });

      connection.end();
    });
  } catch (err) {
    console.log("Error connecting to Db 393");
    return;
  }
});

router.put("/detail/:id", (req, res) => {
  // put the detail
  let mydata = req.body["data"];
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      port: 3306,
      database: "okdok",
    });
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        return;
      }
      const query = `UPDATE PEOPLE_INPUT SET 
        ASSIGNED_TO = '${mydata.ASSIGNED_TO}',
        DUE_DATE = '${mydata.DUE_DATE}',
        SUBJECT = '${mydata.SUBJECT}',
        PROJECT_ID = '${mydata.PROJECT_ID}',
        PEOPLE_ID = '${mydata.REQUESTED_BY}',
        MODIFIED_DATE = '${mydata.MODIFIED_DATE}',
        MODIFIED_BY = '${mydata.MODIFIED_BY}'
        WHERE INPUT_ID = '${req.params.id}'`;
      // console.log(query);
      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for input :", err);
          res.sendStatus(500);
          return;
        }
        res.json(rows);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db INPUT 444", err);
    return;
  }
});

// ==================================================
// Resources CRUD endpoints
// ==================================================

// GET all resources for an action
router.get("/:actionId/resources", async (req, res) => {
  try {
    console.log(
      `[Resources GET] Fetching resources for actionId: ${req.params.actionId}`,
    );
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    connection.connect((err) => {
      if (err) {
        console.error("[Resources GET] DB connection error:", err);
        res.sendStatus(500);
        return;
      }

      const query = `SELECT * FROM RESOURCES WHERE INPUT_ID = ? ORDER BY id`;
      console.log(
        "[Resources GET] Executing query with actionId:",
        req.params.actionId,
      );
      connection.query(query, [req.params.actionId], (err, rows) => {
        connection.end();
        if (err) {
          console.error("[Resources GET] Query error:", err);
          res.sendStatus(500);
          return;
        }
        console.log(`[Resources GET] Found ${rows?.length || 0} resources`);
        res.json(rows || []);
      });
    });
  } catch (err) {
    console.error("[Resources GET] Catch error:", err);
    res.sendStatus(500);
  }
});

// POST create new resource
router.post("/:actionId/resources", async (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    connection.connect((err) => {
      if (err) {
        console.error("Failed to connect to database:", err);
        res.sendStatus(500);
        return;
      }

      const data = req.body;
      const query = `INSERT INTO RESOURCES 
        (INPUT_ID, PROJECT_ID, RESOURCE_TYPE, description, quantity, QUANTITY_UNIT, hours, rate, amount, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'SYSTEM', 'SYSTEM')`;

      connection.query(
        query,
        [
          req.params.actionId,
          data.projectId || "",
          data.resourceType,
          data.description || "",
          data.quantity || 0,
          data.quantityUnit || "",
          data.hours || 0,
          data.rate || 0,
          data.amount || 0,
        ],
        (err, result) => {
          connection.end();
          if (err) {
            console.error("Failed to insert resource:", err);
            res.sendStatus(500);
            return;
          }
          res.json({ id: result.insertId, ...data });
        },
      );
    });
  } catch (err) {
    console.error("Error creating resource:", err);
    res.sendStatus(500);
  }
});

// PUT update resource
router.put("/:actionId/resources/:resourceId", async (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    connection.connect((err) => {
      if (err) {
        console.error("Failed to connect to database:", err);
        res.sendStatus(500);
        return;
      }

      const data = req.body;
      const query = `UPDATE RESOURCES SET 
        RESOURCE_TYPE = ?, description = ?, quantity = ?, QUANTITY_UNIT = ?, 
        hours = ?, rate = ?, amount = ?, UPDATED_AT = NOW(), UPDATED_BY = 'SYSTEM'
        WHERE id = ? AND INPUT_ID = ?`;

      connection.query(
        query,
        [
          data.resourceType,
          data.description || "",
          data.quantity || 0,
          data.quantityUnit || "",
          data.hours || 0,
          data.rate || 0,
          data.amount || 0,
          req.params.resourceId,
          req.params.actionId,
        ],
        (err, result) => {
          connection.end();
          if (err) {
            console.error("Failed to update resource:", err);
            res.sendStatus(500);
            return;
          }
          if (result.affectedRows === 0) {
            res.sendStatus(404);
            return;
          }
          res.json(data);
        },
      );
    });
  } catch (err) {
    console.error("Error updating resource:", err);
    res.sendStatus(500);
  }
});

// DELETE resource
router.delete("/:actionId/resources/:resourceId", async (req, res) => {
  try {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    connection.connect((err) => {
      if (err) {
        console.error("Failed to connect to database:", err);
        res.sendStatus(500);
        return;
      }

      const query = `DELETE FROM RESOURCES WHERE id = ? AND INPUT_ID = ?`;
      connection.query(
        query,
        [req.params.resourceId, req.params.actionId],
        (err, result) => {
          connection.end();
          if (err) {
            console.error("Failed to delete resource:", err);
            res.sendStatus(500);
            return;
          }
          if (result.affectedRows === 0) {
            res.sendStatus(404);
            return;
          }
          res.json({ success: true });
        },
      );
    });
  } catch (err) {
    console.error("Error deleting resource:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
