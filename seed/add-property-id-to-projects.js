/**
 * Database Migration: Link Projects to Properties
 *
 * Adds a nullable PROPERTY_ID foreign key to the PROJECT table so that
 * real-estate projects can be optionally linked to a property record.
 *
 * Run with:
 *   node --env-file=.env seed/add-property-id-to-projects.js
 */

const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "okdok",
});

connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");

  // Step 1: Add the nullable PROPERTY_ID column
  const addColumn = `
    ALTER TABLE PROJECT
    ADD COLUMN PROPERTY_ID INT NULL DEFAULT NULL
  `;

  connection.query(addColumn, (err) => {
    if (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("✓ Column PROPERTY_ID already exists — skipping");
      } else {
        throw err;
      }
    } else {
      console.log("✓ Added PROPERTY_ID column to PROJECT");
    }

    // Step 2: Add foreign key constraint
    const addFk = `
      ALTER TABLE PROJECT
      ADD CONSTRAINT fk_project_property
      FOREIGN KEY (PROPERTY_ID) REFERENCES properties(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    `;

    connection.query(addFk, (err) => {
      if (err) {
        // Ignore duplicate key name errors (already ran)
        if (
          err.code === "ER_DUP_KEY" ||
          (err.message && err.message.includes("fk_project_property"))
        ) {
          console.log(
            "✓ Foreign key fk_project_property already exists — skipping",
          );
        } else {
          console.warn("Warning adding FK:", err.message);
        }
      } else {
        console.log("✓ Added foreign key fk_project_property → properties(id)");
      }

      // Step 3: Add index for performance
      const addIndex = `
        ALTER TABLE PROJECT
        ADD INDEX idx_project_property_id (PROPERTY_ID)
      `;

      connection.query(addIndex, (err) => {
        if (err) {
          if (err.message && err.message.includes("Duplicate key name")) {
            console.log(
              "✓ Index idx_project_property_id already exists — skipping",
            );
          } else {
            console.warn("Warning adding index:", err.message);
          }
        } else {
          console.log("✓ Added index on PROPERTY_ID");
        }

        connection.end();
        console.log("\nMigration complete.");
        console.log(
          "Projects can now be linked to a property via PROPERTY_ID.",
        );
      });
    });
  });
});
