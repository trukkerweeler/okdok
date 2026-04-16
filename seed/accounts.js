/**
 * Seed Accounts Script
 * Initializes required accounting system accounts
 * Run with: node seed/accounts.js
 */

const db = require("../repositories/db");

const seedAccounts = async () => {
  try {
    console.log("Seeding accounting system accounts...");

    const accountsToCreate = [
      // Trust and Operating Cash Accounts
      {
        owner_id: null,
        property_id: null,
        type: "trust_cash",
        name: "Trust Cash Account",
      },
      {
        owner_id: null,
        property_id: null,
        type: "operating_cash",
        name: "PM Operating Cash",
      },

      // Income Accounts
      {
        owner_id: null,
        property_id: null,
        type: "income",
        name: "Rent Income",
      },
      {
        owner_id: null,
        property_id: null,
        type: "income",
        name: "Management Fee Income",
      },

      // Expense and Liability Accounts
      {
        owner_id: null,
        property_id: null,
        type: "expense",
        name: "Owner Expense",
      },
      {
        owner_id: null,
        property_id: null,
        type: "liability",
        name: "Security Deposit Liability",
      },

      // Equity Account
      {
        owner_id: null,
        property_id: null,
        type: "equity",
        name: "Owner Equity",
      },

      // PM Company Receivable (for reimbursable expenses)
      {
        owner_id: null,
        property_id: null,
        type: "liability",
        name: "PM Operating Receivable",
      },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const account of accountsToCreate) {
      try {
        // Check if account already exists
        const sql = "SELECT * FROM accounts WHERE name = ?";
        const results = await db.query(sql, [account.name]);

        if (results.length === 0) {
          // Create the account
          const insertSql = `INSERT INTO accounts (owner_id, property_id, type, name, created_at, updated_at) 
                             VALUES (?, ?, ?, ?, NOW(), NOW())`;
          await db.query(insertSql, [
            account.owner_id,
            account.property_id,
            account.type,
            account.name,
          ]);
          console.log(`✓ Created account: ${account.name} (${account.type})`);
          createdCount++;
        } else {
          console.log(
            `⊘ Account already exists: ${account.name} (${account.type})`,
          );
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error creating account ${account.name}:`, error.message);
      }
    }

    console.log(
      `\nSeeding completed. Created: ${createdCount}, Skipped: ${skippedCount}`,
    );
  } catch (error) {
    console.error("Error seeding accounts:", error);
    process.exit(1);
  }
};

seedAccounts().then(() => {
  console.log("Account seeding finished.");
  process.exit(0);
});
