/**
 * Owner Statement Generator
 * Generates monthly owner statements showing financial activity
 */

const accountRepository = require("../repositories/accountRepository");
const ledgerRepository = require("../repositories/ledgerRepository");
const ownerRepository = require("../repositories/ownerRepository");
const ledgerService = require("../services/ledgerService");

const statementGenerator = {
  /**
   * Generate a monthly statement for an owner
   * @param {number} owner_id - Owner ID
   * @param {number} year - Year (e.g., 2024)
   * @param {number} month - Month (1-12)
   * @returns {Promise<object>} Statement object
   */
  generateMonthlyStatement: async (owner_id, year, month) => {
    try {
      const owner = await ownerRepository.getById(owner_id);
      if (!owner) {
        throw new Error(`Owner ${owner_id} not found`);
      }

      // Get first and last day of the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get all ledger entries for the month
      const monthlyEntries = await ledgerRepository.getByDateRange(
        owner_id,
        startDate,
        endDate,
      );

      // Get previous month's ending balance (beginning balance for current month)
      const previousMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);
      const previousEntries = await ledgerRepository.getByDateRange(
        owner_id,
        new Date(2000, 0, 1),
        previousMonthEnd,
      );

      // Calculate beginning balance
      let beginningBalance = 0;
      const rentIncomeAccounts = await accountRepository.getByType("income");
      const rentIncomeIds = rentIncomeAccounts.map((a) => a.id);
      const expenseAccounts = await accountRepository.getByType("expense");
      const expenseIds = expenseAccounts.map((a) => a.id);

      previousEntries.forEach((entry) => {
        if (rentIncomeIds.includes(entry.credit_account_id)) {
          beginningBalance += entry.amount;
        }
        if (expenseIds.includes(entry.debit_account_id)) {
          beginningBalance -= entry.amount;
        }
        if (entry.memo && entry.memo.toLowerCase().includes("management fee")) {
          beginningBalance -= entry.amount;
        }
        if (entry.memo && entry.memo.toLowerCase().includes("distribution")) {
          beginningBalance -= entry.amount;
        }
      });

      // Calculate current month totals
      let rentCollected = 0;
      let expensesIncurred = 0;
      let managementFees = 0;
      let distributions = 0;
      const lineItems = [];

      monthlyEntries.forEach((entry) => {
        if (rentIncomeIds.includes(entry.credit_account_id)) {
          rentCollected += entry.amount;
          lineItems.push({
            date: entry.date,
            description: entry.memo,
            category: "Rent Collected",
            amount: entry.amount,
          });
        }
        if (expenseIds.includes(entry.debit_account_id)) {
          expensesIncurred += entry.amount;
          lineItems.push({
            date: entry.date,
            description: entry.memo,
            category: "Expense",
            amount: entry.amount,
          });
        }
        if (entry.memo && entry.memo.toLowerCase().includes("management fee")) {
          managementFees += entry.amount;
          lineItems.push({
            date: entry.date,
            description: entry.memo,
            category: "Management Fee",
            amount: entry.amount,
          });
        }
        if (entry.memo && entry.memo.toLowerCase().includes("distribution")) {
          distributions += entry.amount;
          lineItems.push({
            date: entry.date,
            description: entry.memo,
            category: "Distribution",
            amount: entry.amount,
          });
        }
      });

      const endingBalance =
        beginningBalance +
        rentCollected -
        expensesIncurred -
        managementFees -
        distributions;

      return {
        owner: owner,
        period: {
          year,
          month: String(month).padStart(2, "0"),
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
        summary: {
          beginningBalance,
          rentCollected,
          expensesIncurred,
          managementFees,
          distributions,
          endingBalance,
        },
        lineItems: lineItems.sort(
          (a, b) => new Date(a.date) - new Date(b.date),
        ),
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Generate HTML version of statement
   * @param {object} statement - Statement object from generateMonthlyStatement
   * @returns {string} HTML content
   */
  generateHTML: (statement) => {
    const { owner, period, summary, lineItems } = statement;
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
    const monthName = monthNames[parseInt(period.month) - 1];

    const formatCurrency = (num) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num);
    };

    const lineItemsHTML = lineItems
      .map(
        (item) => `
      <tr>
        <td>${new Date(item.date).toLocaleDateString()}</td>
        <td>${item.description}</td>
        <td>${item.category}</td>
        <td style="text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Owner Statement - ${owner.name} - ${monthName} ${period.year}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .owner-info { margin-bottom: 20px; }
          .owner-info p { margin: 5px 0; }
          .summary-box { background: #f9f9f9; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0; }
          .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .summary-row:last-child { border-bottom: none; }
          .summary-row.total { font-weight: bold; background: #f0f0f0; padding: 10px 0; }
          .summary-label { font-weight: 500; }
          .summary-value { text-align: right; font-family: 'Courier New', monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #0066cc; color: white; padding: 10px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Owner Account Statement</h1>
            <p>${monthName} ${period.year}</p>
          </div>

          <div class="owner-info">
            <p><strong>Owner:</strong> ${owner.name}</p>
            <p><strong>Email:</strong> ${owner.email}</p>
            <p><strong>Phone:</strong> ${owner.phone}</p>
          </div>

          <div class="summary-box">
            <div class="summary-row">
              <span class="summary-label">Beginning Balance</span>
              <span class="summary-value">${formatCurrency(summary.beginningBalance)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Rent Collected</span>
              <span class="summary-value">${formatCurrency(summary.rentCollected)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Expenses</span>
              <span class="summary-value">-${formatCurrency(summary.expensesIncurred)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Management Fees</span>
              <span class="summary-value">-${formatCurrency(summary.managementFees)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Distributions</span>
              <span class="summary-value">-${formatCurrency(summary.distributions)}</span>
            </div>
            <div class="summary-row total">
              <span class="summary-label">Ending Balance</span>
              <span class="summary-value">${formatCurrency(summary.endingBalance)}</span>
            </div>
          </div>

          <h2>Transaction Details</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHTML || "<tr><td colspan='4' style='text-align: center;'>No transactions this period</td></tr>"}
            </tbody>
          </table>

          <div class="footer">
            <p>This statement was generated on ${new Date().toLocaleString()}.</p>
            <p>Please contact us if you have any questions about your account.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generate JSON version of statement
   * @param {object} statement - Statement object
   * @returns {object} JSON statement
   */
  generateJSON: (statement) => {
    return statement;
  },
};

module.exports = statementGenerator;
