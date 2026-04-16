/**
 * Accounting Routes
 * REST API endpoints for property management accounting
 */
const express = require("express");
const router = express.Router();

const ownerRepository = require("../repositories/ownerRepository");
const propertyRepository = require("../repositories/propertyRepository");
const tenantRepository = require("../repositories/tenantRepository");
const accountRepository = require("../repositories/accountRepository");
const ledgerRepository = require("../repositories/ledgerRepository");
const ledgerService = require("../services/ledgerService");

// ===================================================
// OWNER ENDPOINTS
// ===================================================

/**
 * GET /owners - Get all owners
 */
router.get("/owners", async (req, res) => {
  try {
    const owners = await ownerRepository.getAll();
    res.json(owners);
  } catch (error) {
    console.error("Error fetching owners:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /owners/:id - Get owner by ID
 */
router.get("/owners/:id", async (req, res) => {
  try {
    const owner = await ownerRepository.getById(req.params.id);
    if (!owner) {
      return res.status(404).json({ error: "Owner not found" });
    }
    res.json(owner);
  } catch (error) {
    console.error("Error fetching owner:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /owners - Create new owner
 */
router.post("/owners", async (req, res) => {
  try {
    const { name, email, phone, payout_bank_account } = req.body;
    const owner = await ownerRepository.create({
      name,
      email,
      phone,
      payout_bank_account,
    });
    res.status(201).json(owner);
  } catch (error) {
    console.error("Error creating owner:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /owners/:id - Update owner
 */
router.put("/owners/:id", async (req, res) => {
  try {
    const { name, email, phone, payout_bank_account } = req.body;
    const owner = await ownerRepository.update(req.params.id, {
      name,
      email,
      phone,
      payout_bank_account,
    });
    res.json(owner);
  } catch (error) {
    console.error("Error updating owner:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /owners/:id - Delete owner
 */
router.delete("/owners/:id", async (req, res) => {
  try {
    await ownerRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting owner:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// PROPERTY ENDPOINTS
// ===================================================

/**
 * GET /properties - Get all properties
 */
router.get("/properties", async (req, res) => {
  try {
    const properties = await propertyRepository.getAll();
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /properties/owner/:owner_id - Get properties by owner
 */
router.get("/properties/owner/:owner_id", async (req, res) => {
  try {
    const properties = await propertyRepository.getByOwnerId(
      req.params.owner_id,
    );
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /properties/:id - Get property by ID
 */
router.get("/properties/:id", async (req, res) => {
  try {
    const property = await propertyRepository.getById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(property);
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /properties - Create new property
 */
router.post("/properties", async (req, res) => {
  try {
    const { owner_id, address, city, state, zip, status } = req.body;
    const property = await propertyRepository.create({
      owner_id,
      address,
      city,
      state,
      zip,
      status: status || "active",
    });
    res.status(201).json(property);
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /properties/:id - Update property
 */
router.put("/properties/:id", async (req, res) => {
  try {
    const { address, city, state, zip, status } = req.body;
    const property = await propertyRepository.update(req.params.id, {
      address,
      city,
      state,
      zip,
      status,
    });
    res.json(property);
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /properties/:id - Delete property
 */
router.delete("/properties/:id", async (req, res) => {
  try {
    await propertyRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// TENANT ENDPOINTS
// ===================================================

/**
 * GET /tenants - Get all tenants
 */
router.get("/tenants", async (req, res) => {
  try {
    const tenants = await tenantRepository.getAll();
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tenants/property/:property_id - Get tenants by property
 */
router.get("/tenants/property/:property_id", async (req, res) => {
  try {
    const tenants = await tenantRepository.getByPropertyId(
      req.params.property_id,
    );
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tenants/:id - Get tenant by ID
 */
router.get("/tenants/:id", async (req, res) => {
  try {
    const tenant = await tenantRepository.getById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /tenants - Create new tenant
 */
router.post("/tenants", async (req, res) => {
  try {
    const {
      property_id,
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
    } = req.body;
    const tenant = await tenantRepository.create({
      property_id,
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
    });
    res.status(201).json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /tenants/:id - Update tenant
 */
router.put("/tenants/:id", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
    } = req.body;
    const tenant = await tenantRepository.update(req.params.id, {
      name,
      email,
      phone,
      lease_start,
      lease_end,
      rent_amount,
      deposit_amount,
    });
    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /tenants/:id - Delete tenant
 */
router.delete("/tenants/:id", async (req, res) => {
  try {
    await tenantRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// ACCOUNT ENDPOINTS
// ===================================================

/**
 * GET /accounts - Get all accounts
 */
router.get("/accounts", async (req, res) => {
  try {
    const accounts = await accountRepository.getAll();
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /accounts/type/:type - Get accounts by type
 */
router.get("/accounts/type/:type", async (req, res) => {
  try {
    const accounts = await accountRepository.getByType(req.params.type);
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /accounts/:id - Get account by ID
 */
router.get("/accounts/:id", async (req, res) => {
  try {
    const account = await accountRepository.getById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  } catch (error) {
    console.error("Error fetching account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /accounts - Create new account (admin only, typically)
 * Note: Most accounts should be seeded via seed scripts
 */
router.post("/accounts", async (req, res) => {
  try {
    const { owner_id, property_id, type, name } = req.body;
    const account = await accountRepository.create({
      owner_id,
      property_id,
      type,
      name,
    });
    res.status(201).json(account);
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /accounts/:id/balance - Get account balance
 */
router.get("/accounts/:id/balance", async (req, res) => {
  try {
    const balance = await ledgerService.getAccountBalance(req.params.id);
    res.json({ account_id: req.params.id, balance });
  } catch (error) {
    console.error("Error calculating balance:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// LEDGER ENDPOINTS
// ===================================================

/**
 * POST /ledger/post - Post a transaction to the ledger
 * Implements double-entry accounting
 */
router.post("/ledger/post", async (req, res) => {
  try {
    const {
      debit_account_id,
      credit_account_id,
      amount,
      memo,
      property_id,
      owner_id,
      tenant_id,
      attachment_url,
      date,
    } = req.body;

    const entry = await ledgerService.postTransaction({
      debit_account_id,
      credit_account_id,
      amount,
      memo,
      property_id,
      owner_id,
      tenant_id,
      attachment_url,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error posting transaction:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /ledger - Get all ledger entries
 */
router.get("/ledger", async (req, res) => {
  try {
    const entries = await ledgerRepository.getAll();
    res.json(entries);
  } catch (error) {
    console.error("Error fetching ledger:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ledger/owner/:owner_id - Get ledger entries for owner
 */
router.get("/ledger/owner/:owner_id", async (req, res) => {
  try {
    const entries = await ledgerRepository.getByOwnerId(req.params.owner_id);
    res.json(entries);
  } catch (error) {
    console.error("Error fetching ledger:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ledger/property/:property_id - Get ledger entries for property
 */
router.get("/ledger/property/:property_id", async (req, res) => {
  try {
    const entries = await ledgerRepository.getByPropertyId(
      req.params.property_id,
    );
    res.json(entries);
  } catch (error) {
    console.error("Error fetching ledger:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /ledger/account/:account_id - Get transactions for account
 */
router.get("/ledger/account/:account_id", async (req, res) => {
  try {
    const entries = await ledgerRepository.getByAccountId(
      req.params.account_id,
    );
    res.json(entries);
  } catch (error) {
    console.error("Error fetching ledger:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// SPECIALIZED TRANSACTION ENDPOINTS
// ===================================================

/**
 * POST /rent/collect - Record rent collection
 * Debit: Trust Cash, Credit: Rent Income
 */
router.post("/rent/collect", async (req, res) => {
  try {
    const { amount, property_id, owner_id, tenant_id, memo, date } = req.body;

    // Get or create trust cash and rent income accounts
    let trustAccount = await accountRepository.getByName("Trust Cash Account");
    if (!trustAccount) {
      return res
        .status(400)
        .json({ error: "Trust Cash Account not found. Run seed script." });
    }

    let rentIncomeAccount = await accountRepository.getByName("Rent Income");
    if (!rentIncomeAccount) {
      return res
        .status(400)
        .json({ error: "Rent Income Account not found. Run seed script." });
    }

    const entry = await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: rentIncomeAccount.id,
      amount,
      memo: memo || `Rent collected for property ${property_id}`,
      property_id,
      owner_id,
      tenant_id,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error collecting rent:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /fees/management - Record management fee
 * Debit: Owner Equity, Credit: Management Fee Income
 */
router.post("/fees/management", async (req, res) => {
  try {
    const { amount, owner_id, property_id, memo, date } = req.body;

    let ownerEquityAccount = await accountRepository.getByName("Owner Equity");
    if (!ownerEquityAccount) {
      return res
        .status(400)
        .json({ error: "Owner Equity Account not found. Run seed script." });
    }

    let managementFeeAccount = await accountRepository.getByName(
      "Management Fee Income",
    );
    if (!managementFeeAccount) {
      return res.status(400).json({
        error: "Management Fee Income Account not found. Run seed script.",
      });
    }

    const entry = await ledgerService.postTransaction({
      debit_account_id: ownerEquityAccount.id,
      credit_account_id: managementFeeAccount.id,
      amount,
      memo: memo || `Management fee for property ${property_id}`,
      property_id,
      owner_id,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error recording management fee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /expenses/owner - Record owner-reimbursable expense
 * Debit: Owner Expense, Credit: Trust Cash
 */
router.post("/expenses/owner", async (req, res) => {
  try {
    const { amount, owner_id, property_id, memo, date, vendor_id } = req.body;

    let ownerExpenseAccount =
      await accountRepository.getByName("Owner Expense");
    if (!ownerExpenseAccount) {
      return res
        .status(400)
        .json({ error: "Owner Expense Account not found. Run seed script." });
    }

    let trustAccount = await accountRepository.getByName("Trust Cash Account");
    if (!trustAccount) {
      return res
        .status(400)
        .json({ error: "Trust Cash Account not found. Run seed script." });
    }

    const entry = await ledgerService.postTransaction({
      debit_account_id: ownerExpenseAccount.id,
      credit_account_id: trustAccount.id,
      amount,
      memo: memo || `Owner expense for property ${property_id}`,
      property_id,
      owner_id,
      vendor_id,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error recording expense:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /distributions/owner - Record owner distribution
 * Debit: Owner Equity, Credit: Trust Cash
 */
router.post("/distributions/owner", async (req, res) => {
  try {
    const { amount, owner_id, property_id, memo, date } = req.body;

    let ownerEquityAccount = await accountRepository.getByName("Owner Equity");
    if (!ownerEquityAccount) {
      return res
        .status(400)
        .json({ error: "Owner Equity Account not found. Run seed script." });
    }

    let trustAccount = await accountRepository.getByName("Trust Cash Account");
    if (!trustAccount) {
      return res
        .status(400)
        .json({ error: "Trust Cash Account not found. Run seed script." });
    }

    const entry = await ledgerService.postTransaction({
      debit_account_id: ownerEquityAccount.id,
      credit_account_id: trustAccount.id,
      amount,
      memo: memo || `Distribution to owner for property ${property_id}`,
      property_id,
      owner_id,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error recording distribution:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /deposits/in - Record security deposit received
 * Debit: Trust Cash, Credit: Security Deposit Liability
 */
router.post("/deposits/in", async (req, res) => {
  try {
    const { amount, property_id, tenant_id, owner_id, memo, date } = req.body;

    let trustAccount = await accountRepository.getByName("Trust Cash Account");
    if (!trustAccount) {
      return res
        .status(400)
        .json({ error: "Trust Cash Account not found. Run seed script." });
    }

    let depositLiabilityAccount = await accountRepository.getByName(
      "Security Deposit Liability",
    );
    if (!depositLiabilityAccount) {
      return res.status(400).json({
        error: "Security Deposit Liability Account not found. Run seed script.",
      });
    }

    const entry = await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: depositLiabilityAccount.id,
      amount,
      memo: memo || `Security deposit received from tenant`,
      property_id,
      owner_id,
      tenant_id,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error recording deposit in:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /deposits/out - Record security deposit returned
 * Debit: Security Deposit Liability, Credit: Trust Cash
 */
router.post("/deposits/out", async (req, res) => {
  try {
    const { amount, property_id, tenant_id, owner_id, memo, date } = req.body;

    let depositLiabilityAccount = await accountRepository.getByName(
      "Security Deposit Liability",
    );
    if (!depositLiabilityAccount) {
      return res.status(400).json({
        error: "Security Deposit Liability Account not found. Run seed script.",
      });
    }

    let trustAccount = await accountRepository.getByName("Trust Cash Account");
    if (!trustAccount) {
      return res
        .status(400)
        .json({ error: "Trust Cash Account not found. Run seed script." });
    }

    const entry = await ledgerService.postTransaction({
      debit_account_id: depositLiabilityAccount.id,
      credit_account_id: trustAccount.id,
      amount,
      memo: memo || `Security deposit returned to tenant`,
      property_id,
      owner_id,
      tenant_id,
      date,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error recording deposit out:", error);
    res.status(400).json({ error: error.message });
  }
});

// ===================================================
// OWNER BALANCE AND STATEMENT ENDPOINTS
// ===================================================

/**
 * GET /owners/:owner_id/balance - Get owner's current balance
 */
router.get("/owners/:owner_id/balance", async (req, res) => {
  try {
    const balance = await ledgerService.getOwnerBalance(req.params.owner_id);
    res.json(balance);
  } catch (error) {
    console.error("Error calculating owner balance:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /owners/:owner_id/statement/:year/:month - Get owner statement for a month
 * @query format - 'html' or 'json' (default: 'json')
 */
router.get("/owners/:owner_id/statement/:year/:month", async (req, res) => {
  try {
    const { owner_id, year, month } = req.params;
    const format = req.query.format || "json";
    const statementGenerator = require("../utils/statementGenerator");

    const statement = await statementGenerator.generateMonthlyStatement(
      parseInt(owner_id),
      parseInt(year),
      parseInt(month),
    );

    if (format === "html") {
      const html = statementGenerator.generateHTML(statement);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } else {
      // Default to JSON
      res.json(statement);
    }
  } catch (error) {
    console.error("Error generating statement:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// VENDORS ENDPOINTS
// ===================================================

const vendorsRepository = require("../repositories/vendorsRepository");

/**
 * GET /vendors - Get all vendors
 */
router.get("/vendors", async (req, res) => {
  try {
    const vendors = await vendorsRepository.getAll();
    res.json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /vendors/:id - Get vendor by ID
 */
router.get("/vendors/:id", async (req, res) => {
  try {
    const vendor = await vendorsRepository.getById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(vendor);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /vendors - Create new vendor
 */
router.post("/vendors", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Vendor name is required" });
    }

    const vendor = await vendorsRepository.create({ name, description });
    res.status(201).json(vendor);
  } catch (error) {
    console.error("Error creating vendor:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
