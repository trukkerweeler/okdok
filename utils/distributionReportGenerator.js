/**
 * Distribution Reconciliation Report Generator
 * Generates HTML reports showing payment details and reconciled expenses
 */

const ledgerRepository = require("../repositories/ledgerRepository");
const ownerRepository = require("../repositories/ownerRepository");
const propertyRepository = require("../repositories/propertyRepository");
const vendorsRepository = require("../repositories/vendorsRepository");
const db = require("../repositories/db");

const distributionReportGenerator = {
  /**
   * Generate a reconciliation report for a distribution
   * @param {number} distribution_id - Distribution ledger entry ID
   * @returns {Promise<object>} Report data with distribution and linked expenses
   */
  generateReport: async (distribution_id) => {
    // Get the distribution entry
    const distribution = await ledgerRepository.getById(distribution_id);
    if (!distribution) {
      throw new Error(`Distribution ${distribution_id} not found`);
    }

    // Get owner details
    const owner = await ownerRepository.getById(distribution.owner_id);

    // Get property details if applicable
    let property = null;
    if (distribution.property_id) {
      property = await propertyRepository.getById(distribution.property_id);
    }

    // Get linked expenses
    const expenses =
      await ledgerRepository.getDistributionExpenses(distribution_id);

    // Get linked management fees
    const fees = await ledgerRepository.getDistributionFees(distribution_id);

    // Load vendor names
    const vendorMap = {};
    try {
      const vendors = await vendorsRepository.getAll();
      vendors.forEach((v) => {
        vendorMap[v.id] = v.name;
      });
    } catch (error) {
      console.warn("Could not load vendors for report:", error);
    }

    // Calculate totals
    let totalExpenses = 0;
    expenses.forEach((exp) => {
      totalExpenses += parseFloat(exp.reimbursed_amount || exp.amount) || 0;
    });

    let totalFees = 0;
    fees.forEach((fee) => {
      totalFees += parseFloat(fee.fee_amount || fee.amount) || 0;
    });

    return {
      distribution: {
        id: distribution.id,
        date: distribution.date,
        amount: parseFloat(distribution.amount),
        memo: distribution.memo,
        created_at: distribution.created_at,
      },
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
      },
      property: property
        ? {
            id: property.id,
            address: property.address,
            city: property.city,
            state: property.state,
          }
        : null,
      expenses: expenses.map((exp) => ({
        id: exp.id,
        date: exp.date,
        memo: exp.memo,
        amount: parseFloat(exp.reimbursed_amount || exp.amount),
        vendor_id: exp.vendor_id,
        vendor_name: vendorMap[exp.vendor_id] || "Unknown",
      })),
      fees: fees.map((fee) => ({
        id: fee.id,
        date: fee.date,
        memo: fee.memo,
        amount: parseFloat(fee.fee_amount || fee.amount),
      })),
      totals: {
        expenses: totalExpenses,
        fees: totalFees,
        distribution: parseFloat(distribution.amount),
      },
    };
  },

  /**
   * Generate HTML report for display/printing
   * @param {object} reportData - Report data from generateReport()
   * @returns {string} HTML report
   */
  generateHTML: (reportData) => {
    const { distribution, owner, property, expenses, fees, totals } =
      reportData;

    const expenseRows = expenses
      .map(
        (exp) => `
        <tr>
          <td style="padding: 4px 7px; border-bottom: 1px solid #ddd;">${formatDate(exp.date)}</td>
          <td style="padding: 4px 7px; border-bottom: 1px solid #ddd;">${escapeHtml(exp.memo)}</td>
          <td style="padding: 4px 7px; border-bottom: 1px solid #ddd; color: #666; font-size: 12px;">
            ${exp.vendor_name}
          </td>
          <td style="padding: 4px 7px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 600;">
            $${parseFloat(exp.amount).toFixed(2)}
          </td>
        </tr>
      `,
      )
      .join("");

    const propertyInfo = property
      ? `
        <div style="margin: 8px 0; padding: 8px 10px; background: #f9f9f9; border-left: 4px solid #0066cc; font-size: 13px;">
          <strong>Property:</strong> ${escapeHtml(property.address)}, ${escapeHtml(property.city)}, ${escapeHtml(property.state)}
        </div>
      `
      : "";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reconciliation Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #333;
      line-height: 1.6;
    }
    
    .report-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 16px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 12px;
    }
    
    .header h1 {
      font-size: 22px;
      color: #0066cc;
      margin-bottom: 2px;
    }
    
    .header p {
      color: #666;
      font-size: 13px;
    }
    
    .section {
      margin: 14px 0;
      padding: 0;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .info-item {
      padding: 8px 10px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    
    .info-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 2px;
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    
    .amount-large {
      font-size: 18px;
      color: #28a745;
    }
    
    .expenses-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
    }
    
    .expenses-table thead {
      background: #f0f0f0;
    }
    
    .expenses-table th {
      padding: 4px 7px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #333;
      border-bottom: 2px solid #ddd;
    }
    
    .expenses-table td {
      padding: 4px 7px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    
    .expenses-table tr:nth-child(even) {
      background: #fafafa;
    }
    
    .summary-section {
      background: #f9f9f9;
      padding: 12px 16px;
      border-radius: 4px;
      margin-top: 14px;
      border-left: 4px solid #0066cc;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 13px;
    }
    
    .summary-row.total {
      border-top: 2px solid #ddd;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 16px;
      font-weight: 700;
    }
    
    .summary-row.total .label {
      color: #333;
    }
    
    .summary-row.total .amount {
      color: #28a745;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #999;
      font-size: 11px;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .report-container {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <h1>Payment Reconciliation Report</h1>
      <p>OKDOK Property Management Accounting</p>
    </div>
    
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Owner</div>
        <div class="info-value">${escapeHtml(owner.name)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Payment Date</div>
        <div class="info-value">${formatDate(distribution.date)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Payment Amount</div>
        <div class="info-value amount-large">$${parseFloat(distribution.amount).toFixed(2)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Reference ID</div>
        <div class="info-value">#${distribution.id}</div>
      </div>
    </div>
    
    ${propertyInfo}
    
    <div class="section">
      <div class="section-title">Management Fees</div>

      ${
        fees && fees.length > 0
          ? `
        <table class="expenses-table">
          <thead>
            <tr>
              <th style="width: 20%;">Date</th>
              <th style="width: 65%;">Description</th>
              <th style="width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${fees
              .map(
                (fee) => `
              <tr>
                <td>${formatDate(fee.date)}</td>
                <td>${escapeHtml(fee.memo)}</td>
                <td style="text-align: right; font-weight: 600;">$${parseFloat(fee.amount).toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `
          : '<p style="color: #999; padding: 8px; text-align: center; font-size: 12px;">No management fees charged in this period.</p>'
      }
    </div>

    <div class="section">
      <div class="section-title">Expenses Reconciled in This Payment</div>
      
      ${
        expenses.length > 0
          ? `
        <table class="expenses-table">
          <thead>
            <tr>
              <th style="width: 15%;">Date</th>
              <th style="width: 45%;">Description</th>
              <th style="width: 25%;">Vendor</th>
              <th style="width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenseRows}
          </tbody>
        </table>
      `
          : '<p style="color: #999; padding: 8px; text-align: center; font-size: 12px;">No expenses reconciled in this payment.</p>'
      }
    </div>
    
    <div class="summary-section">
      <div class="section-title" style="margin-top: 0;">Payment Summary</div>
      ${
        totals.fees > 0
          ? `<div class="summary-row">
        <span>Management Fees:</span>
        <span>-$${parseFloat(totals.fees).toFixed(2)}</span>
      </div>`
          : ""
      }
      <div class="summary-row">
        <span>Expenses Reconciled:</span>
        <span>-$${parseFloat(totals.expenses).toFixed(2)}</span>
      </div>
      <div class="summary-row total">
        <span class="label">Net Payment to Owner:</span>
        <span class="amount">$${parseFloat(totals.distribution).toFixed(2)}</span>
      </div>
    </div>
    
    ${
      distribution.memo
        ? `
      <div class="section" style="margin-top: 12px;">
        <div class="section-title">Notes</div>
        <p style="padding: 8px 10px; background: #f9f9f9; border-radius: 4px; color: #555; font-size: 13px;">
          ${escapeHtml(distribution.memo)}
        </p>
      </div>
    `
        : ""
    }
    
    <div class="footer">
      <p>This report was generated on ${formatDateTime(new Date())} and serves as documentation of expenses reconciled with this payment.</p>
      <p style="margin-top: 6px; color: #ccc;">For questions, please contact your property manager.</p>
    </div>
  </div>
</body>
</html>
    `;
  },
};

// Helper functions for HTML generation
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

module.exports = distributionReportGenerator;
