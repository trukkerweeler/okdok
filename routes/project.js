const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    port: 3306,
    database: "okdok",
  });
}

// Get all records
router.get("/", (req, res) => {
  try {
    const connection = createConnection();
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting to Db:", err);
        const payload = { error: "Database connection failed" };
        if (process.env.NODE_ENV === "development")
          payload.details = err.stack || err.message;
        res.status(500).json(payload);
        return;
      }

      const query = `select * from PROJECT order by CLOSED, PROJECT_ID`;

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for projects:", err);
          const payload = { error: "Failed to query for projects" };
          if (process.env.NODE_ENV === "development")
            payload.details = err.message;
          res.status(500).json(payload);
          return;
        }
        res.json(rows);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db:", err);
    res.sendStatus(500);
    return;
  }
});

// Get a single record
router.get("/:id", (req, res) => {
  try {
    const connection = createConnection();
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        res.sendStatus(500);
        return;
      }

      const query = `SELECT 
        pi.INPUT_ID
        , pi.PEOPLE_ID
        , pi.PROJECT_ID
        , INPUT_DATE
        , pi.DUE_DATE
        , pi.ASSIGNED_TO
        , INPUT_TYPE
        , SUBJECT
        , pit.INPUT_TEXT
        , pi.CLOSED
        , pi.CLOSED_DATE
        , pir.RESPONSE_TEXT
        , pif.FOLLOWUP_TEXT 
        , p.NAME
        , p.LEADER
        , p.PROJECT_TYPE
        , pd.DESCRIPTION
        FROM okdok.PEOPLE_INPUT pi left join PPL_INPT_TEXT pit on pi.INPUT_ID = pit.INPUT_ID
        left join PPL_INPT_FLUP pif on pi.INPUT_ID = pif.INPUT_ID
        left join PPL_INPT_RSPN pir on pi.INPUT_ID = pir.INPUT_ID 
        left join PROJECT p on pi.PROJECT_ID = p.PROJECT_ID
        left join PROJ_DESC pd on pi.PROJECT_ID = pd.PROJECT_ID
        where p.PROJECT_ID = ?
        order by pi.CLOSED, pi.INPUT_ID desc`;

      connection.query(query, [req.params.id], (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for project details:", err);
          res.sendStatus(500);
          return;
        }
        // Pad INPUT_ID values to 7 characters with leading zeros for consistency
        try {
          if (Array.isArray(rows)) {
            rows = rows.map((r) => {
              if (
                r &&
                Object.prototype.hasOwnProperty.call(r, "INPUT_ID") &&
                r.INPUT_ID != null
              ) {
                r.INPUT_ID = String(r.INPUT_ID).padStart(7, "0");
              }
              return r;
            });
          }
        } catch (e) {
          console.error("Error padding INPUT_ID in project details:", e);
        }

        res.json(rows);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db:", err);
    res.sendStatus(500);
    return;
  }
});

// Get recurring subjects for a project
router.get("/rcursbjct/:id", (req, res) => {
  try {
    const connection = createConnection();
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        res.sendStatus(500);
        return;
      }

      const query = `SELECT DISTINCT pi.SUBJECT 
                       FROM PEOPLE_INPUT pi 
                       INNER JOIN PPL_INPT_RCUR pir ON pi.SUBJECT = pir.SUBJECT 
                       WHERE pi.PROJECT_ID = ?`;

      connection.query(query, [req.params.id], (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for recurring subjects:", err);
          res.sendStatus(500);
          return;
        }
        res.json(rows.map((row) => row.SUBJECT));
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db:", err);
    res.sendStatus(500);
    return;
  }
});

// Create a project
router.post("/", (req, res) => {
  const data = req.body;
  try {
    const connection = createConnection();
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        res.sendStatus(500);
        return;
      }

      const query = `insert into PROJECT (PROJECT_ID, NAME, LEADER, PROJECT_TYPE, CREATE_DATE, CREATE_BY, CLOSED) 
    values (?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        data.PROJECT_ID,
        data.NAME,
        data.LEADER,
        data.PROJECT_TYPE,
        data.CREATE_DATE,
        data.CREATE_BY,
        data.CLOSED,
      ];

      connection.query(query, values, (err, rows, fields) => {
        if (err) {
          console.error("Failed to insert project:", err);
          res.sendStatus(500);
          return;
        }
        res.json(rows);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db:", err);
    res.sendStatus(500);
    return;
  }
});

// Close a project
router.put("/close/:id", (req, res) => {
  let data = req.body;
  data.CLOSED_DATE = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    const connection = createConnection();
    connection.connect(function (err) {
      if (err) {
        console.error("Error connecting: " + err.stack);
        res.sendStatus(500);
        return;
      }

      const query = `update PROJECT set CLOSED = "Y", CLOSED_DATE = ? where PROJECT_ID = ?`;
      const values = [data.CLOSED_DATE, req.params.id];

      connection.query(query, values, (err, rows, fields) => {
        if (err) {
          console.error("Failed to update project:", err);
          res.sendStatus(500);
          return;
        }
        res.sendStatus(200);
      });

      connection.end();
    });
  } catch (err) {
    console.error("Error connecting to Db:", err);
    res.sendStatus(500);
    return;
  }
});

module.exports = router;
