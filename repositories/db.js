/**
 * Database connection helper
 * Used by all repositories to create MySQL connections
 */
const mysql = require("mysql2");

function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: "okdok",
  });
}

/**
 * Execute a query with promise-based interface
 * @param {string} sql - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<array|object>}
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const connection = createConnection();
    connection.connect((err) => {
      if (err) {
        console.error("DB connection error:", err);
        reject(err);
        return;
      }
      connection.query(sql, params, (err, results) => {
        connection.end();
        if (err) {
          console.error("Query error:", err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  });
}

module.exports = {
  createConnection,
  query,
};
