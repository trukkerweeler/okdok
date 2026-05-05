/**
 * Ledger Posting Service
 * Handles all double-entry accounting transactions
 * Ensures that every financial event is recorded as debit and credit
 */
const accountRepository = require("../repositories/accountRepository");
const ledgerRepository = require("../repositories/ledgerRepository");

const ledgerService = {
  /**
   * Post a transaction to the ledger (double-entry)
   * @param {object} transaction
   * @param {number} transaction.debit_account_id - Account to debit
   * @param {number} transaction.credit_account_id - Account to credit
   * @param {number} transaction.amount - Amount to post
   * @param {string} transaction.memo - Transaction memo
   * @param {number} transaction.property_id - (optional) Associated property
   * @param {number} transaction.owner_id - (optional) Associated owner
   * @param {number} transaction.tenant_id - (optional) Associated tenant
   * @param {number} transaction.vendor_id - (optional) Associated vendor
   * @param {string} transaction.attachment_url - (optional) Attachment URL
   * @param {Date} transaction.date - (optional) Transaction date
   * @throws Error if validation fails
   * @returns {Promise<object>} Created ledger entry
   */
  postTransaction: async (transaction) => {
    const {
      debit_account_id,
      credit_account_id,
      amount,
      memo,
      property_id = null,
      owner_id = null,
      tenant_id = null,
      vendor_id = null,
      attachment_url = null,
      date = new Date(),
    } = transaction;

    // Validate required fields
    if (!debit_account_id || !credit_account_id) {
      throw new Error(
        "Both debit_account_id and credit_account_id are required",
      );
    }

    if (!amount || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    if (!memo || memo.trim() === "") {
      throw new Error("Memo is required");
    }

    // Validate that debit and credit accounts are different
    if (debit_account_id === credit_account_id) {
      throw new Error("Debit and credit accounts must be different");
    }

    // Validate that both accounts exist
    const [debitAccount, creditAccount] = await Promise.all([
      accountRepository.getById(debit_account_id),
      accountRepository.getById(credit_account_id),
    ]);

    if (!debitAccount) {
      throw new Error(`Debit account ${debit_account_id} not found`);
    }

    if (!creditAccount) {
      throw new Error(`Credit account ${credit_account_id} not found`);
    }

    // Enforce trust fund compliance: prevent commingling of trust and operating funds
    const trustTypes = ["trust_cash"];
    const operatingTypes = ["operating_cash"];

    const debitIsTrust = trustTypes.includes(debitAccount.type);
    const creditIsTrust = trustTypes.includes(creditAccount.type);
    const debitIsOperating = operatingTypes.includes(debitAccount.type);
    const creditIsOperating = operatingTypes.includes(creditAccount.type);

    // Allow: loan between trust/operating and income/expense
    // Prevent: direct transfers between trust and operating
    if (
      (debitIsTrust && creditIsOperating) ||
      (debitIsOperating && creditIsTrust)
    ) {
      throw new Error(
        "Cannot transfer directly between trust and operating funds. Use intermediate accounts.",
      );
    }

    // Create ledger entry
    const entry = await ledgerRepository.create({
      date: new Date(date),
      debit_account_id,
      credit_account_id,
      amount,
      memo,
      property_id,
      owner_id,
      tenant_id,
      vendor_id,
      attachment_url,
    });

    return entry;
  },

  /**
   * Get all transactions affecting an account
   * @param {number} account_id
   * @returns {Promise<array>}
   */
  getAccountTransactions: async (account_id) => {
    return ledgerRepository.getByAccountId(account_id);
  },

  /**
   * Calculate account balance (sum of debits minus credits, or vice versa depending on account type)
   * @param {number} account_id
   * @returns {Promise<number>} Current balance
   */
  getAccountBalance: async (account_id) => {
    const account = await accountRepository.getById(account_id);
    if (!account) {
      throw new Error(`Account ${account_id} not found`);
    }

    const entries = await ledgerRepository.getByAccountId(account_id);

    // For asset and expense accounts: debits increase, credits decrease
    // For liability, equity, and income accounts: credits increase, debits decrease
    const assetTypes = ["trust_cash", "operating_cash"];
    const liabilityTypes = ["liability"];
    const incomeTypes = ["income"];
    const expenseTypes = ["expense"];

    let balance = 0;

    entries.forEach((entry) => {
      if (
        assetTypes.includes(account.type) ||
        expenseTypes.includes(account.type)
      ) {
        // Debits increase, credits decrease
        if (entry.debit_account_id === account_id) {
          balance += entry.amount;
        } else {
          balance -= entry.amount;
        }
      } else {
        // Credits increase, debits decrease (liability, equity, income)
        if (entry.credit_account_id === account_id) {
          balance += entry.amount;
        } else {
          balance -= entry.amount;
        }
      }
    });

    return balance;
  },

  /**
   * Get all transactions for an owner
   * @param {number} owner_id
   * @returns {Promise<array>}
   */
  getOwnerTransactions: async (owner_id) => {
    return ledgerRepository.getByOwnerId(owner_id);
  },

  /**
   * Get owner balance (sum of rent - expenses - fees - distributions)
   * @param {number} owner_id
   * @returns {Promise<object>} Owner balance summary
   */
  getOwnerBalance: async (owner_id) => {
    const entries = await ledgerRepository.getByOwnerId(owner_id);

    const rentIncomeAccounts = await accountRepository.getByType("income");
    const rentIncomeIds = rentIncomeAccounts.map((a) => parseInt(a.id));

    const expenseAccounts = await accountRepository.getByType("expense");
    const expenseIds = expenseAccounts.map((a) => parseInt(a.id));

    let rentCollected = 0;
    let expensesIncurred = 0;
    let managementFees = 0;
    let distributions = 0;

    entries.forEach((entry) => {
      const creditId = parseInt(entry.credit_account_id);
      const debitId = parseInt(entry.debit_account_id);
      const amount = parseFloat(entry.amount) || 0;

      if (rentIncomeIds.includes(creditId)) {
        rentCollected += amount;
      }
      if (expenseIds.includes(debitId)) {
        expensesIncurred += amount;
      }
      // Management fees are debits from owner equity
      if (entry.memo && entry.memo.toLowerCase().includes("management fee")) {
        managementFees += amount;
      }
      // Distributions are debits from owner equity
      if (entry.memo && entry.memo.toLowerCase().includes("distribution")) {
        distributions += amount;
      }
    });

  /**
   * Get unreimbursed owner expenses
   * @param {number} owner_id
   * @returns {Promise<array>} Array of unreimbursed expense entries
   */
  getUnreimbursedExpenses: async (owner_id) => {
    return ledgerRepository.getUnreimbursedExpenses(owner_id);
  },

  /**
   * Link a distribution to expenses (marks them as reimbursed)
   * @param {number} distribution_id - Distribution entry ID
   * @param {array} expense_ids - Array of expense IDs to link
   * @returns {Promise<void>}
   */
  linkDistributionToExpenses: async (distribution_id, expense_ids) => {
    return ledgerRepository.linkDistributionToExpenses(
      distribution_id,
      expense_ids,
    );
  },

  /**
   * Get expenses linked to a distribution
   * @param {number} distribution_id
   * @returns {Promise<array>} Array of expenses linked to this distribution
   */
  getDistributionExpenses: async (distribution_id) => {
    return ledgerRepository.getDistributionExpenses(distribution_id);
  },
};

module.exports = ledgerService;
