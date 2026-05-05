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

/**
 * Execute multiple queries in a transaction
 * @param {function} callback - Async function that receives connection and executes queries
 * @returns {Promise<any>} Result from callback
 */
async function transaction(callback) {
  const connection = createConnection();
  return new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        console.error("DB transaction connection error:", err);
        reject(err);
        return;
      }

      connection.query("START TRANSACTION", async (err) => {
        if (err) {
          connection.end();
          reject(err);
          return;
        }

        try {
          const result = await callback(connection);
          connection.query("COMMIT", (err) => {
            connection.end();
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        } catch (error) {
          connection.query("ROLLBACK", (rollbackErr) => {
            connection.end();
            reject(error);
          });
        }
      });
    });
  });
}

/**
 * Execute a query within an existing transaction connection
 * @param {object} connection - MySQL connection object
 * @param {string} sql - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<array|object>}
 */
function queryInTransaction(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

module.exports = {
  createConnection,
  query,
  transaction,
  queryInTransaction,
};
