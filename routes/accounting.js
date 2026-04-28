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
const invoiceRepository = require("../repositories/invoiceRepository");
const paymentRepository = require("../repositories/paymentRepository");
const leaseRepository = require("../repositories/leaseRepository");
const mileageRepository = require("../repositories/mileageRepository");
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

/**
 * PUT /properties/:property_id/primary-tenant/:tenant_id - Set primary tenant for property
 */
router.put(
  "/properties/:property_id/primary-tenant/:tenant_id",
  async (req, res) => {
    try {
      const property = await propertyRepository.setPrimaryTenant(
        req.params.property_id,
        req.params.tenant_id,
      );
      res.json(property);
    } catch (error) {
      console.error("Error setting primary tenant:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /properties/:property_id/with-primary-tenant - Get property with primary tenant details
 */
router.get("/properties/:property_id/with-primary-tenant", async (req, res) => {
  try {
    const property = await propertyRepository.getByIdWithPrimaryTenant(
      req.params.property_id,
    );
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(property);
  } catch (error) {
    console.error("Error fetching property with primary tenant:", error);
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

/**
 * DELETE /ledger/:id - Delete a ledger entry (undo transaction)
 */
router.delete("/ledger/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await ledgerRepository.getById(id);
    if (!entry) {
      return res.status(404).json({ error: "Ledger entry not found" });
    }

    const deleted = await ledgerRepository.delete(id);
    if (deleted) {
      res.json({ message: "Transaction deleted", id });
    } else {
      res.status(400).json({ error: "Failed to delete transaction" });
    }
  } catch (error) {
    console.error("Error deleting ledger entry:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// INVOICE ENDPOINTS
// ===================================================

/**
 * GET /invoices - Get all invoices
 */
router.get("/invoices", async (req, res) => {
  try {
    const invoices = await invoiceRepository.getAll();
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /invoices/:id - Get invoice by ID
 */
router.get("/invoices/:id", async (req, res) => {
  try {
    const invoice = await invoiceRepository.getById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /invoices/property/:property_id - Get invoices for a property
 */
router.get("/invoices/property/:property_id", async (req, res) => {
  try {
    const invoices = await invoiceRepository.getByPropertyId(
      req.params.property_id,
    );
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /invoices/tenant/:tenant_id - Get invoices for a tenant
 */
router.get("/invoices/tenant/:tenant_id", async (req, res) => {
  try {
    const invoices = await invoiceRepository.getByTenantId(
      req.params.tenant_id,
    );
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /invoices/owner/:owner_id - Get invoices for an owner
 */
router.get("/invoices/owner/:owner_id", async (req, res) => {
  try {
    const invoices = await invoiceRepository.getByOwnerId(req.params.owner_id);
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /invoices - Create new invoice
 */
router.post("/invoices", async (req, res) => {
  try {
    const {
      property_id,
      lease_id,
      tenant_id,
      owner_id,
      invoice_number,
      amount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
    } = req.body;

    if (!owner_id || !amount) {
      return res
        .status(400)
        .json({ error: "owner_id and amount are required" });
    }

    const nextInvoiceNumber =
      invoice_number || (await invoiceRepository.getNextInvoiceNumber());

    const invoice = await invoiceRepository.create({
      property_id,
      lease_id,
      tenant_id,
      owner_id,
      invoice_number: nextInvoiceNumber,
      amount,
      invoice_date: invoice_date || new Date().toISOString().split("T")[0],
      due_date,
      description: description || "Deposit + First Month Rent",
      status: status || "pending",
      notes,
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /invoices/:id - Update invoice
 */
router.put("/invoices/:id", async (req, res) => {
  try {
    const {
      property_id,
      lease_id,
      tenant_id,
      owner_id,
      invoice_number,
      amount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
    } = req.body;

    const invoice = await invoiceRepository.update(req.params.id, {
      property_id,
      lease_id,
      tenant_id,
      owner_id,
      invoice_number,
      amount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
    });

    res.json(invoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /invoices/:id - Delete invoice
 */
router.delete("/invoices/:id", async (req, res) => {
  try {
    await invoiceRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// INVOICE PAYMENT ENDPOINTS
// ===================================================

/**
 * GET /payments - Get all invoice payments
 */
router.get("/payments", async (req, res) => {
  try {
    const payments = await paymentRepository.getAll();
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payments/:id - Get payment by ID
 */
router.get("/payments/:id", async (req, res) => {
  try {
    const payment = await paymentRepository.getById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    res.json(payment);
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payments/invoice/:invoice_id - Get payments for an invoice
 */
router.get("/payments/invoice/:invoice_id", async (req, res) => {
  try {
    const payments = await paymentRepository.getByInvoiceId(
      req.params.invoice_id,
    );
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payments/owner/:owner_id - Get payments for an owner
 */
router.get("/payments/owner/:owner_id", async (req, res) => {
  try {
    const payments = await paymentRepository.getByOwnerId(req.params.owner_id);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /invoice-balance/:invoice_id - Get invoice balance (total due - paid)
 */
router.get("/invoice-balance/:invoice_id", async (req, res) => {
  try {
    const balance = await paymentRepository.getInvoiceBalance(
      req.params.invoice_id,
    );
    if (!balance) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(balance);
  } catch (error) {
    console.error("Error calculating invoice balance:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /payments - Record a new invoice payment
 */
router.post("/payments", async (req, res) => {
  try {
    const {
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    if (!invoice_id || !amount_paid) {
      return res
        .status(400)
        .json({ error: "invoice_id and amount_paid are required" });
    }

    // Verify invoice exists
    const invoice = await invoiceRepository.getById(invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const payment = await paymentRepository.create({
      invoice_id,
      payment_date: payment_date || new Date().toISOString().split("T")[0],
      amount_paid,
      payment_method,
      reference_number,
      notes,
    });

    // Post to ledger if amount paid matches or exceeds invoice amount
    const balance = await paymentRepository.getInvoiceBalance(invoice_id);
    if (balance && balance.balance <= 0) {
      // Invoice is fully paid - post to ledger
      try {
        let trustAccount =
          await accountRepository.getByName("Trust Cash Account");
        if (!trustAccount) {
          console.warn("Trust Cash Account not found for ledger posting");
        } else {
          // Find appropriate income account based on invoice description
          let incomeAccount = await accountRepository.getByName("Rent Income");
          if (
            invoice.description &&
            invoice.description.toLowerCase().includes("deposit")
          ) {
            incomeAccount = await accountRepository.getByName(
              "Security Deposit Liability",
            );
          }

          if (incomeAccount && trustAccount.id !== incomeAccount.id) {
            await ledgerService.postTransaction({
              debit_account_id: trustAccount.id,
              credit_account_id: incomeAccount.id,
              amount: balance.invoice_amount,
              memo: `Payment received for invoice ${invoice.invoice_number}`,
              property_id: invoice.property_id,
              owner_id: invoice.owner_id,
              date: payment_date || new Date().toISOString().split("T")[0],
            });
          }
        }
      } catch (ledgerError) {
        console.error(
          "Warning: Could not post payment to ledger:",
          ledgerError,
        );
        // Don't fail the payment if ledger posting fails
      }
    }

    res.status(201).json(payment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /payments/:id - Update payment
 */
router.put("/payments/:id", async (req, res) => {
  try {
    const {
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    const payment = await paymentRepository.update(req.params.id, {
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    });

    res.json(payment);
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /payments/:id - Delete payment
 */
router.delete("/payments/:id", async (req, res) => {
  try {
    await paymentRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// LEASE ENDPOINTS
// ===================================================

/**
 * GET /leases - Get all leases
 */
router.get("/leases", async (req, res) => {
  try {
    const status = req.query.status || null;
    const leases = await leaseRepository.getAll(status);
    res.json(leases);
  } catch (error) {
    console.error("Error fetching leases:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /leases/:id - Get lease by ID with tenants
 */
router.get("/leases/:id", async (req, res) => {
  try {
    const lease = await leaseRepository.getById(req.params.id);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    const tenants = await leaseRepository.getTenantsForLease(req.params.id);
    res.json({ ...lease, tenants });
  } catch (error) {
    console.error("Error fetching lease:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /leases/property/:property_id - Get leases for a property
 */
router.get("/leases/property/:property_id", async (req, res) => {
  try {
    const leases = await leaseRepository.getByPropertyId(
      req.params.property_id,
    );
    res.json(leases);
  } catch (error) {
    console.error("Error fetching leases for property:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /leases - Create new lease
 */
router.post("/leases", async (req, res) => {
  try {
    const {
      property_id,
      lease_number,
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
    } = req.body;

    const lease = await leaseRepository.create({
      property_id,
      lease_number,
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
    });
    res.status(201).json(lease);
  } catch (error) {
    console.error("Error creating lease:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /leases/:id - Update lease
 */
router.put("/leases/:id", async (req, res) => {
  try {
    const {
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
    } = req.body;

    const lease = await leaseRepository.update(req.params.id, {
      lease_start,
      lease_end,
      monthly_rent,
      security_deposit,
      status,
      notes,
    });
    res.json(lease);
  } catch (error) {
    console.error("Error updating lease:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /leases/:id - Delete lease
 */
router.delete("/leases/:id", async (req, res) => {
  try {
    await leaseRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting lease:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /leases/:lease_id/tenants/:tenant_id - Add tenant to lease
 */
router.post("/leases/:lease_id/tenants/:tenant_id", async (req, res) => {
  try {
    const { is_primary } = req.body;
    await leaseRepository.addTenant(
      req.params.lease_id,
      req.params.tenant_id,
      is_primary || false,
    );
    const tenants = await leaseRepository.getTenantsForLease(
      req.params.lease_id,
    );
    res.json(tenants);
  } catch (error) {
    console.error("Error adding tenant to lease:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /leases/:lease_id/tenants/:tenant_id - Remove tenant from lease
 */
router.delete("/leases/:lease_id/tenants/:tenant_id", async (req, res) => {
  try {
    await leaseRepository.removeTenant(
      req.params.lease_id,
      req.params.tenant_id,
    );
    res.status(204).send();
  } catch (error) {
    console.error("Error removing tenant from lease:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /leases/:lease_id/primary-tenant/:tenant_id - Set primary tenant for lease
 */
router.put("/leases/:lease_id/primary-tenant/:tenant_id", async (req, res) => {
  try {
    const tenant = await leaseRepository.setPrimaryTenant(
      req.params.lease_id,
      req.params.tenant_id,
    );
    res.json(tenant);
  } catch (error) {
    console.error("Error setting primary tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /leases/:lease_id/next-number - Get next lease number for property
 */
router.get("/leases/:lease_id/next-number", async (req, res) => {
  try {
    const lease = await leaseRepository.getById(req.params.lease_id);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    const nextNumber = await leaseRepository.getNextLeaseNumber(
      lease.property_id,
    );
    res.json({ next_lease_number: nextNumber });
  } catch (error) {
    console.error("Error getting next lease number:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// MILEAGE TRACKING ENDPOINTS
// ===================================================

/**
 * GET /mileage - Get all mileage entries
 */
router.get("/mileage", async (req, res) => {
  try {
    const mileage = await mileageRepository.getAll();
    res.json(mileage);
  } catch (error) {
    console.error("Error fetching mileage:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mileage/:id - Get mileage entry by ID
 */
router.get("/mileage/:id", async (req, res) => {
  try {
    const mileage = await mileageRepository.getById(req.params.id);
    if (!mileage) {
      return res.status(404).json({ error: "Mileage entry not found" });
    }
    res.json(mileage);
  } catch (error) {
    console.error("Error fetching mileage:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mileage/property/:id - Get mileage entries for a property
 */
router.get("/mileage/property/:property_id", async (req, res) => {
  try {
    const mileage = await mileageRepository.getByPropertyId(
      req.params.property_id,
    );
    res.json(mileage);
  } catch (error) {
    console.error("Error fetching property mileage:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mileage/owner/:id - Get mileage entries for an owner
 */
router.get("/mileage/owner/:owner_id", async (req, res) => {
  try {
    const mileage = await mileageRepository.getByOwnerId(req.params.owner_id);
    res.json(mileage);
  } catch (error) {
    console.error("Error fetching owner mileage:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mileage/range/:startDate/:endDate - Get mileage for date range
 */
router.get("/mileage/range/:startDate/:endDate", async (req, res) => {
  try {
    const mileage = await mileageRepository.getByDateRange(
      req.params.startDate,
      req.params.endDate,
    );
    res.json(mileage);
  } catch (error) {
    console.error("Error fetching mileage by date range:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mileage/summary/:year/:month - Get monthly mileage summary
 */
router.get("/mileage/summary/:year/:month", async (req, res) => {
  try {
    const summary = await mileageRepository.getMonthlySummary(
      req.params.year,
      req.params.month,
    );
    const totals = await mileageRepository.getTotalMiles(
      `${req.params.year}-${String(req.params.month).padStart(2, "0")}-01`,
      `${req.params.year}-${String(req.params.month).padStart(2, "0")}-31`,
    );
    res.json({ summary, totals });
  } catch (error) {
    console.error("Error fetching mileage summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /mileage - Create new mileage entry
 */
router.post("/mileage", async (req, res) => {
  try {
    const {
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id,
      owner_id,
      notes,
    } = req.body;

    if (!date || !miles_driven || !purpose || !category) {
      return res.status(400).json({
        error: "date, miles_driven, purpose, and category are required",
      });
    }

    const mileage = await mileageRepository.create({
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id,
      owner_id,
      notes,
    });

    res.status(201).json(mileage);
  } catch (error) {
    console.error("Error creating mileage entry:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /mileage/:id - Update mileage entry
 */
router.put("/mileage/:id", async (req, res) => {
  try {
    const {
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id,
      owner_id,
      notes,
    } = req.body;

    const mileage = await mileageRepository.update(req.params.id, {
      date,
      miles_driven,
      starting_location,
      ending_location,
      purpose,
      category,
      property_id,
      owner_id,
      notes,
    });

    res.json(mileage);
  } catch (error) {
    console.error("Error updating mileage entry:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /mileage/:id - Delete mileage entry
 */
router.delete("/mileage/:id", async (req, res) => {
  try {
    await mileageRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting mileage entry:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
