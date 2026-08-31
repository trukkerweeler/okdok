/**
 * Accounting Routes
 * REST API endpoints for property management accounting
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();

// Multer configuration for file uploads (max 10MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Allow PDF and image files
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/tiff",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and image files are allowed."));
    }
  },
});

const ownerRepository = require("../repositories/ownerRepository");
const propertyRepository = require("../repositories/propertyRepository");
const tenantRepository = require("../repositories/tenantRepository");
const accountRepository = require("../repositories/accountRepository");
const ledgerRepository = require("../repositories/ledgerRepository");
const invoiceRepository = require("../repositories/invoiceRepository");
const paymentRepository = require("../repositories/paymentRepository");
const attachmentRepository = require("../repositories/attachmentRepository");
const pmExpenseReceiptRepository = require("../repositories/pmExpenseReceiptRepository");
const leaseRepository = require("../repositories/leaseRepository");
const mileageRepository = require("../repositories/mileageRepository");
const tenantCreditRepository = require("../repositories/tenantCreditRepository");
const companySettingsRepository = require("../repositories/companySettingsRepository");
const ledgerService = require("../services/ledgerService");
const db = require("../repositories/db");

async function reconcileInvoiceStatusByBalance(invoiceId, connection = null) {
  const queryFn = connection
    ? (sql, params) => db.queryInTransaction(connection, sql, params)
    : (sql, params) => db.query(sql, params);

  const rows = await queryFn(
    `SELECT
       i.id,
       i.status,
       i.amount,
       COALESCE(SUM(p.amount_paid), 0) as total_paid,
       (i.amount - COALESCE(SUM(p.amount_paid), 0)) as balance
     FROM invoices i
     LEFT JOIN invoice_payments p ON i.id = p.invoice_id
     WHERE i.id = ?
     GROUP BY i.id`,
    [invoiceId],
  );

  const invoice = rows[0] || null;
  if (!invoice) {
    return null;
  }

  const balance = parseFloat(invoice.balance);
  const previousStatus = invoice.status;

  // Never override manually cancelled invoices.
  if (previousStatus === "cancelled") {
    return {
      invoiceId,
      status: previousStatus,
      previousStatus,
      balance,
      updated: false,
      transitionedToPaid: false,
    };
  }

  const nextStatus = balance <= 0 ? "paid" : "pending";
  const updated = previousStatus !== nextStatus;

  if (updated) {
    await queryFn(
      "UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?",
      [nextStatus, invoiceId],
    );
  }

  return {
    invoiceId,
    status: nextStatus,
    previousStatus,
    balance,
    updated,
    transitionedToPaid: nextStatus === "paid" && previousStatus !== "paid",
  };
}

/**
 * Record a tenant's overpayment on an invoice as reusable credit
 */
async function createCreditFromOverpayment(
  { tenantId, invoiceId, paymentId, overageAmount, notes },
  connection = null,
) {
  if (!tenantId || !(overageAmount > 0)) {
    return null;
  }

  const queryFn = connection
    ? (sql, params) => db.queryInTransaction(connection, sql, params)
    : (sql, params) => db.query(sql, params);

  const result = await queryFn(
    `INSERT INTO tenant_credits
       (tenant_id, source_invoice_id, source_payment_id, amount, remaining_amount, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      tenantId,
      invoiceId,
      paymentId || null,
      overageAmount,
      overageAmount,
      notes || null,
    ],
  );

  return { id: result.insertId, tenantId, amount: overageAmount };
}

/**
 * Apply a tenant's open credits (oldest first) to an invoice's outstanding balance.
 * Each application is recorded as a 'credit' payment so existing balance/status logic just works.
 */
async function applyAvailableCreditsToInvoice(
  tenantId,
  invoiceId,
  connection = null,
) {
  if (!tenantId) {
    return { appliedTotal: 0, applications: [] };
  }

  const queryFn = connection
    ? (sql, params) => db.queryInTransaction(connection, sql, params)
    : (sql, params) => db.query(sql, params);

  const [invoiceRow] = await queryFn(
    `SELECT i.amount,
            (i.amount - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = i.id), 0)) as balance
     FROM invoices i WHERE i.id = ?`,
    [invoiceId],
  );
  if (!invoiceRow) {
    return { appliedTotal: 0, applications: [] };
  }

  let remainingBalance = parseFloat(invoiceRow.balance);
  if (remainingBalance <= 0) {
    return { appliedTotal: 0, applications: [] };
  }

  const credits = await queryFn(
    `SELECT id, remaining_amount FROM tenant_credits
     WHERE tenant_id = ? AND remaining_amount > 0
     ORDER BY created_at ASC`,
    [tenantId],
  );

  const applications = [];
  let appliedTotal = 0;

  for (const credit of credits) {
    if (remainingBalance <= 0) break;

    const creditRemaining = parseFloat(credit.remaining_amount);
    const applyAmount = Math.min(creditRemaining, remainingBalance);
    if (!(applyAmount > 0)) continue;

    const paymentResult = await queryFn(
      `INSERT INTO invoice_payments
         (invoice_id, payment_date, amount_paid, payment_method, reference_number, notes, transaction_type, created_at, updated_at)
       VALUES (?, CURDATE(), ?, 'credit', ?, ?, 'tenant_to_manager', NOW(), NOW())`,
      [
        invoiceId,
        applyAmount,
        `credit-${credit.id}`,
        `Applied tenant credit #${credit.id}`,
      ],
    );

    await queryFn(
      `INSERT INTO tenant_credit_applications (credit_id, invoice_id, payment_id, amount_applied, applied_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [credit.id, invoiceId, paymentResult.insertId, applyAmount],
    );

    await queryFn(
      `UPDATE tenant_credits SET remaining_amount = remaining_amount - ?, updated_at = NOW() WHERE id = ?`,
      [applyAmount, credit.id],
    );

    remainingBalance -= applyAmount;
    appliedTotal += applyAmount;
    applications.push({ creditId: credit.id, amount: applyAmount });
  }

  if (appliedTotal > 0) {
    await reconcileInvoiceStatusByBalance(invoiceId, connection);
  }

  return { appliedTotal, applications };
}

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
 * Reconciles invoice status against remaining balance in the same transaction
 */
router.post("/rent/collect", async (req, res) => {
  try {
    const { amount, property_id, owner_id, tenant_id, memo, date, invoice_id } =
      req.body;

    // Get required accounts upfront (outside transaction — read-only)
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

    if (invoice_id) {
      // Verify invoice exists before the transaction
      const invoice = await invoiceRepository.getById(invoice_id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Atomic: post ledger entry + record payment + reconcile invoice status
      const entry = await db.transaction(async (connection) => {
        const insertSql = `
          INSERT INTO ledger_entries
          (date, debit_account_id, credit_account_id, amount, memo, property_id, owner_id, tenant_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const result = await db.queryInTransaction(connection, insertSql, [
          date,
          trustAccount.id,
          rentIncomeAccount.id,
          amount,
          memo || `Rent collected for property ${property_id}`,
          property_id || null,
          owner_id || null,
          tenant_id || null,
        ]);

        // Record the payment in invoice_payments
        await db.queryInTransaction(
          connection,
          `INSERT INTO invoice_payments
           (invoice_id, payment_date, amount_paid, payment_method, reference_number, notes, transaction_type, created_at, updated_at)
           VALUES (?, ?, ?, NULL, NULL, ?, 'tenant_to_manager', NOW(), NOW())`,
          [invoice_id, date, amount, memo || null],
        );

        const statusResult = await reconcileInvoiceStatusByBalance(
          invoice_id,
          connection,
        );

        // Amount paid beyond the invoice becomes a reusable tenant credit
        const creditTenantId = invoice.tenant_id || tenant_id || null;
        if (creditTenantId && statusResult && statusResult.balance < 0) {
          await createCreditFromOverpayment(
            {
              tenantId: creditTenantId,
              invoiceId: invoice_id,
              paymentId: null,
              overageAmount: Math.abs(statusResult.balance),
              notes: `Overpayment on invoice ${invoice.invoice_number}`,
            },
            connection,
          );
        }

        return {
          id: result.insertId,
          date,
          debit_account_id: trustAccount.id,
          credit_account_id: rentIncomeAccount.id,
          amount,
          memo: memo || `Rent collected for property ${property_id}`,
          property_id: property_id || null,
          owner_id: owner_id || null,
          tenant_id: tenant_id || null,
          invoice_id,
          isFullyPaid: statusResult?.status === "paid",
        };
      });

      return res.status(201).json(entry);
    }

    // No invoice — simple ledger post
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
 * POST /distributions/owner - Record owner distribution (atomic)
 * Debit: Owner Equity, Credit: Trust Cash
 * Wraps expense/fee validation, amount deduction, and transaction posting in single DB transaction
 * @body expense_ids - (optional) Array of expense IDs to mark as reimbursed
 * @body fee_ids - (optional) Array of management fee IDs to include on the report
 */
router.post("/distributions/owner", async (req, res) => {
  try {
    const {
      amount,
      owner_id,
      property_id,
      memo,
      date,
      expense_ids,
      fee_ids,
      management_fee,
      management_fee_memo,
    } = req.body;

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

    // Look up management fee account if providing an inline fee
    let managementFeeAccount = null;
    if (management_fee && parseFloat(management_fee) > 0) {
      managementFeeAccount = await accountRepository.getByName(
        "Management Fee Income",
      );
      if (!managementFeeAccount) {
        return res.status(400).json({
          error: "Management Fee Income account not found. Run seed script.",
        });
      }
    }

    // Wrap entire distribution operation in transaction
    const entry = await db.transaction(async (connection) => {
      // Fetch unreimbursed expenses for this owner within transaction
      const unreimbursedExpenses = await db.queryInTransaction(
        connection,
        `
        SELECT le.* 
        FROM ledger_entries le
        JOIN accounts debit_acc ON le.debit_account_id = debit_acc.id
        WHERE le.owner_id = ?
          AND debit_acc.name = 'Owner Expense'
          AND (le.reimbursement_status = 'unreimbursed' OR le.reimbursement_status IS NULL)
        ORDER BY le.date ASC
      `,
        [owner_id],
      );

      // Fetch unreimbursed fees for this owner within transaction
      const unreimbursedFees = await db.queryInTransaction(
        connection,
        `
        SELECT le.*
        FROM ledger_entries le
        JOIN accounts credit_acc ON le.credit_account_id = credit_acc.id
        WHERE le.owner_id = ?
          AND credit_acc.name = 'Management Fee Income'
          AND (le.reimbursement_status = 'unreimbursed' OR le.reimbursement_status IS NULL)
        ORDER BY le.date ASC
      `,
        [owner_id],
      );

      let distributionAmount = parseFloat(amount);

      // Deduct inline management fee if provided directly on the distribution
      if (management_fee && parseFloat(management_fee) > 0) {
        const feeCents = Math.round(parseFloat(management_fee) * 100);
        const distCents = Math.round(distributionAmount * 100);
        distributionAmount = (distCents - feeCents) / 100;
        if (distributionAmount <= 0) {
          throw new Error(
            "Distribution amount must exceed the management fee.",
          );
        }
      }

      // Validate and deduct selected expenses
      if (expense_ids && expense_ids.length > 0) {
        const selectedExpenseIds = expense_ids.map((id) => parseInt(id));
        const selectedExpenseMap = new Map(
          unreimbursedExpenses.map((expense) => [
            parseInt(expense.id),
            expense,
          ]),
        );

        const invalidExpenseIds = selectedExpenseIds.filter(
          (id) => !selectedExpenseMap.has(id),
        );
        if (invalidExpenseIds.length > 0) {
          throw new Error(
            "One or more selected expenses are invalid or already reimbursed.",
          );
        }

        const reimbursedTotalCents = selectedExpenseIds.reduce((sum, id) => {
          const exp = selectedExpenseMap.get(id);
          return sum + Math.round(parseFloat(exp.amount) * 100);
        }, 0);

        // Do math in cents to avoid floating point errors
        const distributionCents = Math.round(distributionAmount * 100);
        distributionAmount = (distributionCents - reimbursedTotalCents) / 100;

        if (distributionAmount <= 0) {
          throw new Error(
            "Distribution amount must be greater than selected reimbursed expenses.",
          );
        }
      }

      // Validate and deduct selected fees
      if (fee_ids && fee_ids.length > 0) {
        const selectedFeeIds = fee_ids.map((id) => parseInt(id));
        const selectedFeeMap = new Map(
          unreimbursedFees.map((fee) => [parseInt(fee.id), fee]),
        );

        const invalidFeeIds = selectedFeeIds.filter(
          (id) => !selectedFeeMap.has(id),
        );
        if (invalidFeeIds.length > 0) {
          throw new Error(
            "One or more selected fees are invalid or already collected.",
          );
        }

        const feeTotalCents = selectedFeeIds.reduce((sum, id) => {
          const fee = selectedFeeMap.get(id);
          return sum + Math.round(parseFloat(fee.amount) * 100);
        }, 0);

        const distributionCents = Math.round(distributionAmount * 100);
        distributionAmount = (distributionCents - feeTotalCents) / 100;

        if (distributionAmount <= 0) {
          throw new Error(
            "Distribution amount must be greater than selected management fees and expenses.",
          );
        }
      }

      // Post the distribution transaction
      const insertSql = `
        INSERT INTO ledger_entries 
        (date, debit_account_id, credit_account_id, amount, memo, property_id, owner_id, distribution_id, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const result = await db.queryInTransaction(connection, insertSql, [
        date,
        ownerEquityAccount.id,
        trustAccount.id,
        distributionAmount,
        memo || `Distribution to owner for property ${property_id}`,
        property_id,
        owner_id,
        null, // Will be set after insert
      ]);

      const distributionId = result.insertId;

      // Set the distribution_id to point to itself (marking this as a distribution)
      const updateSql =
        "UPDATE ledger_entries SET distribution_id = ? WHERE id = ?";
      await db.queryInTransaction(connection, updateSql, [
        distributionId,
        distributionId,
      ]);

      // Link selected expenses and mark as reimbursed within same transaction
      if (expense_ids && expense_ids.length > 0) {
        for (const expense_id of expense_ids) {
          // Insert into distribution_expenses junction
          const linkSql = `
            INSERT INTO distribution_expenses (distribution_id, expense_id, amount)
            SELECT ?, ?, le.amount
            FROM ledger_entries le
            WHERE le.id = ?
          `;
          await db.queryInTransaction(connection, linkSql, [
            distributionId,
            expense_id,
            expense_id,
          ]);

          // Mark expense as reimbursed
          const updateSql =
            "UPDATE ledger_entries SET reimbursement_status = 'reimbursed' WHERE id = ?";
          await db.queryInTransaction(connection, updateSql, [expense_id]);
        }
      }

      // Link selected fees and mark as collected within same transaction
      if (fee_ids && fee_ids.length > 0) {
        for (const fee_id of fee_ids) {
          const linkFeeSql = `
            INSERT INTO distribution_fees (distribution_id, fee_id, amount)
            SELECT ?, ?, le.amount
            FROM ledger_entries le
            WHERE le.id = ?
          `;
          await db.queryInTransaction(connection, linkFeeSql, [
            distributionId,
            fee_id,
            fee_id,
          ]);

          // Mark fee as collected
          const updateFeeSql =
            "UPDATE ledger_entries SET reimbursement_status = 'reimbursed' WHERE id = ?";
          await db.queryInTransaction(connection, updateFeeSql, [fee_id]);
        }
      }

      // Auto-create and link inline management fee if provided
      if (
        management_fee &&
        parseFloat(management_fee) > 0 &&
        managementFeeAccount
      ) {
        const autoFeeInsertSql = `
          INSERT INTO ledger_entries 
          (date, debit_account_id, credit_account_id, amount, memo, property_id, owner_id, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const autoFeeResult = await db.queryInTransaction(
          connection,
          autoFeeInsertSql,
          [
            date,
            ownerEquityAccount.id,
            managementFeeAccount.id,
            parseFloat(management_fee),
            management_fee_memo || `Management fee for property ${property_id}`,
            property_id || null,
            owner_id || null,
          ],
        );
        const autoFeeId = autoFeeResult.insertId;

        await db.queryInTransaction(
          connection,
          `INSERT INTO distribution_fees (distribution_id, fee_id, amount) VALUES (?, ?, ?)`,
          [distributionId, autoFeeId, parseFloat(management_fee)],
        );

        await db.queryInTransaction(
          connection,
          `UPDATE ledger_entries SET reimbursement_status = 'reimbursed' WHERE id = ?`,
          [autoFeeId],
        );
      }

      // Return created entry
      return {
        id: distributionId,
        date: date,
        debit_account_id: ownerEquityAccount.id,
        credit_account_id: trustAccount.id,
        amount: distributionAmount,
        memo: memo || `Distribution to owner for property ${property_id}`,
        property_id,
        owner_id,
      };
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
 * GET /owners/:owner_id/unreimbursed-expenses - Get unreimbursed expenses for an owner
 */
router.get("/owners/:owner_id/unreimbursed-expenses", async (req, res) => {
  try {
    const expenses = await ledgerService.getUnreimbursedExpenses(
      req.params.owner_id,
    );
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching unreimbursed expenses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /owners/:owner_id/unreimbursed-fees - Get uncollected management fees for an owner
 */
router.get("/owners/:owner_id/unreimbursed-fees", async (req, res) => {
  try {
    const fees = await ledgerService.getUnreimbursedFees(req.params.owner_id);
    res.json(fees);
  } catch (error) {
    console.error("Error fetching unreimbursed fees:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /distributions/:id/reconciliation-report - Get payment reconciliation report
 * @query format - 'html' or 'json' (default: 'html')
 */
router.get("/distributions/:id/reconciliation-report", async (req, res) => {
  try {
    const { id } = req.params;
    const format = req.query.format || "html";
    const distributionReportGenerator = require("../utils/distributionReportGenerator");

    const reportData = await distributionReportGenerator.generateReport(
      parseInt(id),
    );

    if (format === "json") {
      res.json(reportData);
    } else {
      // Default to HTML
      const html = distributionReportGenerator.generateHTML(reportData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    }
  } catch (error) {
    console.error("Error generating reconciliation report:", error);
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
 * PUT /vendors/:id - Update a vendor
 */
router.put("/vendors/:id", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Vendor name is required" });
    }

    const vendor = await vendorsRepository.update(req.params.id, {
      name,
      description,
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(vendor);
  } catch (error) {
    console.error("Error updating vendor:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /vendors/:id - Delete a vendor
 */
router.delete("/vendors/:id", async (req, res) => {
  try {
    const vendor = await vendorsRepository.getById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    await vendorsRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting vendor:", error);
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
    invoice.line_items = await invoiceRepository.getLineItems(req.params.id);
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
 * GET /tenant-credits - Summary of available/total credit per tenant
 */
router.get("/tenant-credits", async (req, res) => {
  try {
    const summary = await tenantCreditRepository.getAllWithBalances();
    res.json(summary);
  } catch (error) {
    console.error("Error fetching tenant credit summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tenant-credits/:tenant_id - List a tenant's overpayment credits and available balance
 */
router.get("/tenant-credits/:tenant_id", async (req, res) => {
  try {
    const credits = await tenantCreditRepository.getByTenantId(
      req.params.tenant_id,
    );
    const available = await tenantCreditRepository.getAvailableBalance(
      req.params.tenant_id,
    );
    res.json({ available, credits });
  } catch (error) {
    console.error("Error fetching tenant credits:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /tenant-credits/apply - Manually apply a tenant's open credit to a specific invoice
 */
router.post("/tenant-credits/apply", async (req, res) => {
  try {
    const { tenant_id, invoice_id } = req.body;
    if (!tenant_id || !invoice_id) {
      return res
        .status(400)
        .json({ error: "tenant_id and invoice_id are required" });
    }

    const invoice = await invoiceRepository.getById(invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const result = await applyAvailableCreditsToInvoice(tenant_id, invoice_id);
    res.json(result);
  } catch (error) {
    console.error("Error applying tenant credit:", error);
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
      line_items,
    } = req.body;

    if (!owner_id) {
      return res.status(400).json({ error: "owner_id is required" });
    }

    let computedAmount = amount ? parseFloat(amount) : 0;
    if (line_items && line_items.length > 0) {
      for (const item of line_items) {
        if (!item.description || item.amount == null) {
          return res.status(400).json({
            error: "Each line item requires a description and amount",
          });
        }
      }
      computedAmount =
        line_items.reduce(
          (sum, item) => sum + Math.round(parseFloat(item.amount) * 100),
          0,
        ) / 100;
    }

    if (!computedAmount) {
      return res
        .status(400)
        .json({ error: "amount or line_items are required" });
    }

    const nextInvoiceNumber =
      invoice_number || (await invoiceRepository.getNextInvoiceNumber());

    if (line_items && line_items.length > 0) {
      const invoiceId = await db.transaction(async (connection) => {
        const result = await db.queryInTransaction(
          connection,
          `INSERT INTO invoices
           (property_id, lease_id, tenant_id, owner_id, invoice_number, amount, invoice_date, due_date, description, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            property_id || null,
            lease_id || null,
            tenant_id || null,
            owner_id,
            nextInvoiceNumber,
            computedAmount,
            invoice_date || new Date().toISOString().split("T")[0],
            due_date || null,
            description || null,
            status || "pending",
            notes || null,
          ],
        );
        const id = result.insertId;
        for (let i = 0; i < line_items.length; i++) {
          await db.queryInTransaction(
            connection,
            `INSERT INTO invoice_line_items (invoice_id, description, amount, sort_order) VALUES (?, ?, ?, ?)`,
            [
              id,
              line_items[i].description,
              parseFloat(line_items[i].amount),
              i,
            ],
          );
        }
        if (tenant_id) {
          await applyAvailableCreditsToInvoice(tenant_id, id, connection);
        }
        return id;
      });
      const invoice = await invoiceRepository.getById(invoiceId);
      invoice.line_items = await invoiceRepository.getLineItems(invoiceId);
      return res.status(201).json(invoice);
    }

    const invoice = await invoiceRepository.create({
      property_id,
      lease_id,
      tenant_id,
      owner_id,
      invoice_number: nextInvoiceNumber,
      amount: computedAmount,
      invoice_date: invoice_date || new Date().toISOString().split("T")[0],
      due_date,
      description: description || "Deposit + First Month Rent",
      status: status || "pending",
      notes,
    });

    // Apply any open tenant credit toward this new invoice before returning it
    if (tenant_id) {
      await applyAvailableCreditsToInvoice(tenant_id, invoice.id);
    }

    const finalInvoice = await invoiceRepository.getById(invoice.id);
    finalInvoice.line_items = [];
    res.status(201).json(finalInvoice);
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
      line_items,
    } = req.body;

    let computedAmount = amount ? parseFloat(amount) : null;
    if (line_items && line_items.length > 0) {
      for (const item of line_items) {
        if (!item.description || item.amount == null) {
          return res.status(400).json({
            error: "Each line item requires a description and amount",
          });
        }
      }
      computedAmount =
        line_items.reduce(
          (sum, item) => sum + Math.round(parseFloat(item.amount) * 100),
          0,
        ) / 100;
    }

    const invoice = await invoiceRepository.update(req.params.id, {
      property_id,
      lease_id,
      owner_id,
      invoice_number,
      amount: computedAmount,
      invoice_date,
      due_date,
      description,
      status,
      notes,
    });

    if (line_items !== undefined) {
      await invoiceRepository.replaceLineItems(req.params.id, line_items || []);
    }

    invoice.line_items = await invoiceRepository.getLineItems(req.params.id);
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
      transaction_type,
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
      transaction_type: transaction_type || "tenant_to_manager",
    });

    // Reconcile invoice status based on remaining balance after payment.
    const statusResult = await reconcileInvoiceStatusByBalance(invoice_id);

    // Post to ledger if amount paid matches or exceeds invoice amount
    if (statusResult && statusResult.transitionedToPaid) {
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
              amount: parseFloat(invoice.amount),
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

    // Amount paid beyond the invoice becomes a reusable tenant credit
    if (invoice.tenant_id && statusResult && statusResult.balance < 0) {
      try {
        await createCreditFromOverpayment({
          tenantId: invoice.tenant_id,
          invoiceId: invoice_id,
          paymentId: payment.id,
          overageAmount: Math.abs(statusResult.balance),
          notes: `Overpayment on invoice ${invoice.invoice_number}`,
        });
      } catch (creditError) {
        console.error(
          "Warning: Could not record tenant credit for overpayment:",
          creditError,
        );
        // Don't fail the payment if credit tracking fails
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
      transaction_type,
    } = req.body;

    const existingPayment = await paymentRepository.getById(req.params.id);
    if (!existingPayment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const previousInvoiceId = existingPayment.invoice_id;

    const payment = await paymentRepository.update(req.params.id, {
      invoice_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
      transaction_type: transaction_type || "tenant_to_manager",
    });

    // Reconcile invoice statuses after update.
    try {
      if (previousInvoiceId && previousInvoiceId !== invoice_id) {
        await reconcileInvoiceStatusByBalance(previousInvoiceId);
      }
      if (invoice_id) {
        await reconcileInvoiceStatusByBalance(invoice_id);
      }
    } catch (statusError) {
      console.error(
        "Warning: Could not reconcile invoice status after payment update:",
        statusError,
      );
      // Don't fail the payment update if status update fails
    }

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
    // Get payment details before deleting to know which invoice to check
    const payment = await paymentRepository.getById(req.params.id);

    await paymentRepository.delete(req.params.id);

    // Update invoice status if needed
    if (payment && payment.invoice_id) {
      try {
        await reconcileInvoiceStatusByBalance(payment.invoice_id);
      } catch (statusError) {
        console.error(
          "Warning: Could not reconcile invoice status after payment delete:",
          statusError,
        );
        // Don't fail the delete if status update fails
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /payments/:id/check-stub - Upload or update check stub for a payment
 */
router.put(
  "/payments/:id/check-stub",
  upload.single("check_stub"),
  async (req, res) => {
    try {
      const paymentId = req.params.id;

      // Verify payment exists
      const payment = await paymentRepository.getById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Verify file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Delete existing check stub if present (keep other attachment types)
      await attachmentRepository.deleteByPaymentIdAndType(
        paymentId,
        "check_stub",
      );

      // Create new attachment
      const attachment = await attachmentRepository.create({
        payment_id: paymentId,
        attachment_type: "check_stub",
        file_blob: req.file.buffer,
        filename: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
      });

      res.json(attachment);
    } catch (error) {
      console.error("Error uploading check stub:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /payments/:id/check-stub - Download check stub for a payment
 */
router.get("/payments/:id/check-stub", async (req, res) => {
  try {
    const checkStub = await attachmentRepository.getCheckStubByPaymentId(
      req.params.id,
    );
    if (!checkStub) {
      return res.status(404).json({ error: "Check stub not found" });
    }

    res.setHeader("Content-Type", checkStub.mime_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${checkStub.filename}"`,
    );
    res.send(checkStub.file_blob);
  } catch (error) {
    console.error("Error downloading check stub:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /payments/:id/check-stub - Delete check stub for a payment
 */
router.delete("/payments/:id/check-stub", async (req, res) => {
  try {
    const payment = await paymentRepository.getById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    await attachmentRepository.deleteByPaymentIdAndType(
      req.params.id,
      "check_stub",
    );
    res.json(payment);
  } catch (error) {
    console.error("Error deleting check stub:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /payments/:id/deposit-receipt - Upload or update deposit receipt for a payment
 */
router.put(
  "/payments/:id/deposit-receipt",
  upload.single("deposit_receipt"),
  async (req, res) => {
    try {
      const paymentId = req.params.id;

      const payment = await paymentRepository.getById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Delete existing deposit receipt if present (keep other attachment types)
      await attachmentRepository.deleteByPaymentIdAndType(
        paymentId,
        "deposit_receipt",
      );

      const attachment = await attachmentRepository.create({
        payment_id: paymentId,
        attachment_type: "deposit_receipt",
        file_blob: req.file.buffer,
        filename: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
      });

      res.json(attachment);
    } catch (error) {
      console.error("Error uploading deposit receipt:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /payments/:id/deposit-receipt - Download deposit receipt for a payment
 */
router.get("/payments/:id/deposit-receipt", async (req, res) => {
  try {
    const receipt = await attachmentRepository.getDepositReceiptByPaymentId(
      req.params.id,
    );
    if (!receipt) {
      return res.status(404).json({ error: "Deposit receipt not found" });
    }

    res.setHeader("Content-Type", receipt.mime_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${receipt.filename}"`,
    );
    res.send(receipt.file_blob);
  } catch (error) {
    console.error("Error downloading deposit receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /payments/:id/deposit-receipt - Delete deposit receipt for a payment
 */
router.delete("/payments/:id/deposit-receipt", async (req, res) => {
  try {
    const payment = await paymentRepository.getById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    await attachmentRepository.deleteByPaymentIdAndType(
      req.params.id,
      "deposit_receipt",
    );
    res.json(payment);
  } catch (error) {
    console.error("Error deleting deposit receipt:", error);
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

// ===================================================
// PM EXPENSE RECEIPT ENDPOINTS
// ===================================================

/**
 * GET /pm-expenses/:expense_id/receipts - Get all receipts for an expense
 */
router.get("/pm-expenses/:expense_id/receipts", async (req, res) => {
  try {
    const receipts = await pmExpenseReceiptRepository.getByExpenseId(
      req.params.expense_id,
    );
    res.json(receipts);
  } catch (error) {
    console.error("Error fetching expense receipts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /pm-expenses/receipts/:id - Download receipt file
 */
router.get("/pm-expenses/receipts/:id", async (req, res) => {
  try {
    const receipt = await pmExpenseReceiptRepository.getById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.set("Content-Type", receipt.mime_type);
    res.set(
      "Content-Disposition",
      `attachment; filename="${receipt.filename}"`,
    );
    res.send(receipt.file_blob);
  } catch (error) {
    console.error("Error downloading receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /pm-expenses/:expense_id/receipts - Upload receipt for expense
 */
router.post(
  "/pm-expenses/:expense_id/receipts",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { receipt_type = "receipt" } = req.body;

      const receipt = await pmExpenseReceiptRepository.create({
        pm_expense_id: req.params.expense_id,
        receipt_type,
        file_blob: req.file.buffer,
        filename: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user?.id || null,
      });

      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error uploading receipt:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * DELETE /pm-expenses/receipts/:id - Delete receipt
 */
router.delete("/pm-expenses/receipts/:id", async (req, res) => {
  try {
    await pmExpenseReceiptRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// COMPANY SETTINGS ENDPOINTS
// ===================================================

/**
 * GET /company-settings - Get all company settings
 */
router.get("/company-settings", async (req, res) => {
  try {
    const settings = await companySettingsRepository.getAll();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching company settings:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /company-settings/:key - Get specific company setting
 */
router.get("/company-settings/:key", async (req, res) => {
  try {
    const value = await companySettingsRepository.getByKey(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (error) {
    console.error("Error fetching company setting:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /company-settings/:key - Update specific company setting
 */
router.put("/company-settings/:key", async (req, res) => {
  try {
    const { value } = req.body;
    const result = await companySettingsRepository.update(
      req.params.key,
      value,
    );
    res.json(result);
  } catch (error) {
    console.error("Error updating company setting:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /company-settings - Update multiple company settings
 */
router.put("/company-settings", async (req, res) => {
  try {
    const results = await companySettingsRepository.updateMultiple(req.body);
    res.json(results);
  } catch (error) {
    console.error("Error updating company settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// TRANSACTION RECEIPT ENDPOINTS
// ===================================================

const transactionReceiptsRepository = require("../repositories/transactionReceiptsRepository");

/**
 * POST /ledger/:ledger_id/receipts - Upload receipt for a transaction
 */
router.post(
  "/ledger/:ledger_id/receipts",
  upload.single("file"),
  async (req, res) => {
    try {
      const { ledger_id } = req.params;

      // Verify ledger entry exists
      const ledger = await ledgerRepository.getById(ledger_id);
      if (!ledger) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // Verify a file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Create receipt record
      const receipt = await transactionReceiptsRepository.create({
        ledger_id,
        file_blob: req.file.buffer,
        filename: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
      });

      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error uploading receipt:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /ledger/:ledger_id/receipts - Get all receipts for a transaction
 */
router.get("/ledger/:ledger_id/receipts", async (req, res) => {
  try {
    const { ledger_id } = req.params;

    // Verify ledger entry exists
    const ledger = await ledgerRepository.getById(ledger_id);
    if (!ledger) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const receipts =
      await transactionReceiptsRepository.getByLedgerId(ledger_id);
    res.json(receipts);
  } catch (error) {
    console.error("Error fetching receipts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /receipts/:receipt_id - Download a receipt file
 */
router.get("/receipts/:receipt_id", async (req, res) => {
  try {
    const { receipt_id } = req.params;

    const receipt = await transactionReceiptsRepository.getById(receipt_id);
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    // Send the file with appropriate headers
    res.setHeader("Content-Type", receipt.mime_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${receipt.filename}"`,
    );
    res.send(receipt.file_blob);
  } catch (error) {
    console.error("Error downloading receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /receipts/:receipt_id - Delete a receipt
 */
router.delete("/receipts/:receipt_id", async (req, res) => {
  try {
    const { receipt_id } = req.params;

    const receipt = await transactionReceiptsRepository.getById(receipt_id);
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    await transactionReceiptsRepository.delete(receipt_id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// PM COMPANY INCOME SUMMARY ENDPOINT
// ===================================================

/**
 * GET /pm/income-summary - PM company P&L summary
 * @query start_date - Start date (YYYY-MM-DD), defaults to current year start
 * @query end_date - End date (YYYY-MM-DD), defaults to current year end
 */
router.get("/pm/income-summary", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const startDate = req.query.start_date || `${year}-01-01`;
    const endDate = req.query.end_date || `${year}-12-31`;

    // Run all queries in parallel
    const [
      feeEntries,
      expenseEntries,
      feeMonthly,
      expenseMonthly,
      mileageEntries,
      mileageMonthly,
      rateRows,
    ] = await Promise.all([
      // Management fee income entries
      db.query(
        `SELECT 
          le.id, le.date, le.amount, le.memo, le.property_id, le.owner_id,
          CONCAT(p.address, ', ', p.city) AS property_address,
          o.name AS owner_name
        FROM ledger_entries le
        JOIN accounts a ON le.credit_account_id = a.id
        LEFT JOIN properties p ON le.property_id = p.id
        LEFT JOIN owners o ON le.owner_id = o.id
        WHERE a.name = 'Management Fee Income'
          AND le.date >= ? AND le.date <= ?
        ORDER BY le.date DESC`,
        [startDate, endDate],
      ),
      // PM operating expense entries (ledger)
      db.query(
        `SELECT 
          le.id, le.date, le.amount, le.memo, le.vendor_id,
          v.name AS vendor_name
        FROM ledger_entries le
        JOIN accounts a ON le.debit_account_id = a.id
        LEFT JOIN vendors v ON le.vendor_id = v.id
        WHERE a.name = 'PM Operating Expense'
          AND le.date >= ? AND le.date <= ?
        ORDER BY le.date DESC`,
        [startDate, endDate],
      ),
      // Monthly fees
      db.query(
        `SELECT YEAR(le.date) AS year, MONTH(le.date) AS month, SUM(le.amount) AS fee_income
        FROM ledger_entries le
        JOIN accounts a ON le.credit_account_id = a.id
        WHERE a.name = 'Management Fee Income'
          AND le.date >= ? AND le.date <= ?
        GROUP BY YEAR(le.date), MONTH(le.date)`,
        [startDate, endDate],
      ),
      // Monthly PM expenses
      db.query(
        `SELECT YEAR(le.date) AS year, MONTH(le.date) AS month, SUM(le.amount) AS pm_expenses
        FROM ledger_entries le
        JOIN accounts a ON le.debit_account_id = a.id
        WHERE a.name = 'PM Operating Expense'
          AND le.date >= ? AND le.date <= ?
        GROUP BY YEAR(le.date), MONTH(le.date)`,
        [startDate, endDate],
      ),
      // Mileage entries (individual)
      db.query(
        `SELECT 
          m.id, m.date, m.miles_driven, m.purpose, m.category,
          m.starting_location, m.ending_location, m.notes,
          YEAR(m.date) AS year,
          CONCAT(p.address, ', ', p.city) AS property_address,
          o.name AS owner_name
        FROM mileage_log m
        LEFT JOIN properties p ON m.property_id = p.id
        LEFT JOIN owners o ON m.owner_id = o.id
        WHERE m.date >= ? AND m.date <= ?
        ORDER BY m.date DESC`,
        [startDate, endDate],
      ),
      // Monthly mileage aggregates
      db.query(
        `SELECT YEAR(m.date) AS year, MONTH(m.date) AS month, SUM(m.miles_driven) AS total_miles
        FROM mileage_log m
        WHERE m.date >= ? AND m.date <= ?
        GROUP BY YEAR(m.date), MONTH(m.date)`,
        [startDate, endDate],
      ),
      // Mileage rates from settings
      db.query(
        `SELECT setting_key, setting_value FROM company_settings WHERE setting_key LIKE 'mileage_rate_%'`,
      ),
    ]);

    // Build mileage rate lookup (per year)
    const defaultRates = {
      2022: 0.585,
      2023: 0.655,
      2024: 0.67,
      2025: 0.7,
      2026: 0.725,
    };
    const mileageRates = { ...defaultRates };
    rateRows.forEach(({ setting_key, setting_value }) => {
      const m = setting_key.match(/^mileage_rate_(\d{4})$/);
      if (m) mileageRates[parseInt(m[1])] = parseFloat(setting_value);
    });
    const sortedRateYears = Object.keys(mileageRates).map(Number).sort();
    const getRateForYear = (y) =>
      mileageRates[y] ??
      mileageRates[sortedRateYears[sortedRateYears.length - 1]];

    // Attach calculated dollar value to each mileage entry
    const mileageEntriesWithValue = mileageEntries.map((e) => {
      const miles = parseFloat(e.miles_driven) || 0;
      const rate = getRateForYear(e.year);
      return {
        ...e,
        rate_used: rate,
        calculated_value: Math.round(miles * rate * 100) / 100,
      };
    });

    // Build monthly breakdown map
    const monthlyMap = {};
    const ensureMonth = (y, m) => {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!monthlyMap[key])
        monthlyMap[key] = {
          year: y,
          month: m,
          fee_income: 0,
          pm_expenses: 0,
          mileage_expense: 0,
        };
      return key;
    };

    feeMonthly.forEach(({ year: y, month: m, fee_income }) => {
      monthlyMap[ensureMonth(y, m)].fee_income = parseFloat(fee_income) || 0;
    });
    expenseMonthly.forEach(({ year: y, month: m, pm_expenses }) => {
      monthlyMap[ensureMonth(y, m)].pm_expenses = parseFloat(pm_expenses) || 0;
    });
    mileageMonthly.forEach(({ year: y, month: m, total_miles }) => {
      const miles = parseFloat(total_miles) || 0;
      const rate = getRateForYear(y);
      monthlyMap[ensureMonth(y, m)].mileage_expense =
        Math.round(miles * rate * 100) / 100;
    });

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthlyBreakdown = Object.values(monthlyMap)
      .map((m) => ({
        ...m,
        month_name: monthNames[m.month - 1],
        net:
          Math.round((m.fee_income - m.pm_expenses - m.mileage_expense) * 100) /
          100,
      }))
      .sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month - b.month,
      );

    const totalFeeIncome = feeEntries.reduce(
      (s, e) => s + parseFloat(e.amount),
      0,
    );
    const totalPmExpenses = expenseEntries.reduce(
      (s, e) => s + parseFloat(e.amount),
      0,
    );
    const totalMileage = mileageEntriesWithValue.reduce(
      (s, e) => s + e.calculated_value,
      0,
    );

    res.json({
      period: { start_date: startDate, end_date: endDate },
      totals: {
        management_fee_income: Math.round(totalFeeIncome * 100) / 100,
        pm_operating_expenses: Math.round(totalPmExpenses * 100) / 100,
        mileage_expense: Math.round(totalMileage * 100) / 100,
        net_income:
          Math.round((totalFeeIncome - totalPmExpenses - totalMileage) * 100) /
          100,
      },
      monthly_breakdown: monthlyBreakdown,
      fee_entries: feeEntries,
      expense_entries: expenseEntries,
      mileage_entries: mileageEntriesWithValue,
    });
  } catch (error) {
    console.error("Error fetching PM income summary:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
