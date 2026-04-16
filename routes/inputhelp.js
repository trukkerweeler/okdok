const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads to the input files directory
const inputFilesPath =
  process.env.INPUT_FILES_PATH ||
  String.raw`\\fs1\Common\Quality\00000_Work Instructions`;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the directory exists
    if (!fs.existsSync(inputFilesPath)) {
      fs.mkdirSync(inputFilesPath, { recursive: true });
    }
    cb(null, inputFilesPath);
  },
  filename: function (req, file, cb) {
    // Use original filename but ensure uniqueness if file already exists
    let filename = file.originalname;
    let filepath = path.join(inputFilesPath, filename);

    // If file exists, add timestamp to make it unique
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const timestamp = Date.now();
      filename = `${base}_${timestamp}${ext}`;
    }

    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos/documents
  },
});

// ==================================================
// Upload file endpoint
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Return the file information
    res.json({
      success: true,
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: `/input-files/${req.file.filename}`,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ==================================================
// Get all help records
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
        res.status(500).json({ error: "Database connection failed" });
        return;
      }

      const query = `SELECT SUBJECT, DESCRIPTION, LINK FROM PPL_INPT_HELP ORDER BY SUBJECT ASC`;

      connection.query(query, (err, rows, fields) => {
        if (err) {
          console.error("Failed to query for input help:", err);
          connection.end();
          res.status(500).json({ error: "Failed to query input help data" });
          return;
        }
        connection.end();
        res.json(rows);
      });
    });
  } catch (err) {
    console.error("Error connecting to Db:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================================================
// Create a new help record
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

      const query = `INSERT INTO PPL_INPT_HELP (SUBJECT, DESCRIPTION, LINK) VALUES (?, ?, ?)`;

      const values = [req.body.SUBJECT, req.body.DESCRIPTION, req.body.LINK];

      connection.query(query, values, (err, result) => {
        if (err) {
          console.error("Failed to insert input help:", err);
          connection.end();
          res.status(500).json({ error: "Failed to insert input help" });
          return;
        }

        connection.end();
        res.json({
          success: true,
          message: "Input help record created successfully",
        });
      });
    });
  } catch (err) {
    console.error("Error in POST /inputhelp:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================================================
// Update a help record
router.put("/", (req, res) => {
  try {
    const { SUBJECT, DESCRIPTION, LINK } = req.body;

    if (!SUBJECT) {
      res.status(400).json({ error: "SUBJECT is required" });
      return;
    }

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

      const query = `UPDATE PPL_INPT_HELP SET DESCRIPTION = ?, LINK = ? WHERE SUBJECT = ?`;

      const values = [DESCRIPTION, LINK, SUBJECT];

      connection.query(query, values, (err, result) => {
        if (err) {
          console.error("Failed to update input help:", err);
          connection.end();
          res.status(500).json({ error: "Failed to update input help" });
          return;
        }

        if (result.affectedRows === 0) {
          connection.end();
          res.status(404).json({ error: "Input help record not found" });
          return;
        }

        connection.end();
        res.json({
          success: true,
          message: "Input help record updated successfully",
        });
      });
    });
  } catch (err) {
    console.error("Error in PUT /inputhelp:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================================================
// Delete a help record
router.delete("/", (req, res) => {
  try {
    const { SUBJECT } = req.body;

    if (!SUBJECT) {
      res.status(400).json({ error: "SUBJECT is required" });
      return;
    }

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

      const query = `DELETE FROM PPL_INPT_HELP WHERE SUBJECT = ?`;

      connection.query(query, [SUBJECT], (err, result) => {
        if (err) {
          console.error("Failed to delete input help:", err);
          connection.end();
          res.status(500).json({ error: "Failed to delete input help" });
          return;
        }

        if (result.affectedRows === 0) {
          connection.end();
          res.status(404).json({ error: "Input help record not found" });
          return;
        }

        connection.end();
        res.json({
          success: true,
          message: "Input help record deleted successfully",
        });
      });
    });
  } catch (err) {
    console.error("Error in DELETE /inputhelp:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
