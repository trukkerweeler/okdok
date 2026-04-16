/**
 * Sample Data Seeding Script
 * Creates example owners, properties, tenants, and transactions for testing
 * Run with: node seed/sample-data.js
 */

const ownerRepository = require("../repositories/ownerRepository");
const propertyRepository = require("../repositories/propertyRepository");
const tenantRepository = require("../repositories/tenantRepository");
const ledgerService = require("../services/ledgerService");
const accountRepository = require("../repositories/accountRepository");

const seedSampleData = async () => {
  try {
    console.log("Seeding sample data...\n");

    // ===================================================
    // Create Sample Owners
    // ===================================================
    console.log("Creating sample owners...");
    const owner1 = await ownerRepository.create({
      name: "Robert Johnson",
      email: "robert.johnson@example.com",
      phone: "555-0101",
      payout_bank_account: "9876543210",
    });
    console.log(`✓ Created owner: ${owner1.name} (ID: ${owner1.id})`);

    const owner2 = await ownerRepository.create({
      name: "Sarah Williams",
      email: "sarah.williams@example.com",
      phone: "555-0102",
      payout_bank_account: "9876543211",
    });
    console.log(`✓ Created owner: ${owner2.name} (ID: ${owner2.id})`);

    // ===================================================
    // Create Sample Properties
    // ===================================================
    console.log("\nCreating sample properties...");
    const property1 = await propertyRepository.create({
      owner_id: owner1.id,
      address: "123 Main Street",
      city: "Springfield",
      state: "IL",
      zip: "62701",
      status: "active",
    });
    console.log(
      `✓ Created property: ${property1.address} (ID: ${property1.id})`,
    );

    const property2 = await propertyRepository.create({
      owner_id: owner1.id,
      address: "456 Oak Avenue",
      city: "Springfield",
      state: "IL",
      zip: "62702",
      status: "active",
    });
    console.log(
      `✓ Created property: ${property2.address} (ID: ${property2.id})`,
    );

    const property3 = await propertyRepository.create({
      owner_id: owner2.id,
      address: "789 Elm Street",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      status: "active",
    });
    console.log(
      `✓ Created property: ${property3.address} (ID: ${property3.id})`,
    );

    // ===================================================
    // Create Sample Tenants
    // ===================================================
    console.log("\nCreating sample tenants...");
    const tenant1 = await tenantRepository.create({
      property_id: property1.id,
      name: "Alice Smith",
      email: "alice.smith@example.com",
      phone: "555-0201",
      lease_start: "2024-01-01",
      lease_end: "2025-01-01",
      rent_amount: 1500.0,
      deposit_amount: 1500.0,
    });
    console.log(`✓ Created tenant: ${tenant1.name} (ID: ${tenant1.id})`);

    const tenant2 = await tenantRepository.create({
      property_id: property1.id,
      name: "Bob Brown",
      email: "bob.brown@example.com",
      phone: "555-0202",
      lease_start: "2024-02-15",
      lease_end: "2025-02-15",
      rent_amount: 1200.0,
      deposit_amount: 1200.0,
    });
    console.log(`✓ Created tenant: ${tenant2.name} (ID: ${tenant2.id})`);

    const tenant3 = await tenantRepository.create({
      property_id: property2.id,
      name: "Carol Davis",
      email: "carol.davis@example.com",
      phone: "555-0203",
      lease_start: "2024-01-15",
      lease_end: "2025-01-15",
      rent_amount: 1800.0,
      deposit_amount: 1800.0,
    });
    console.log(`✓ Created tenant: ${tenant3.name} (ID: ${tenant3.id})`);

    const tenant4 = await tenantRepository.create({
      property_id: property3.id,
      name: "Diana Evans",
      email: "diana.evans@example.com",
      phone: "555-0204",
      lease_start: "2024-01-01",
      lease_end: "2025-01-01",
      rent_amount: 2000.0,
      deposit_amount: 2000.0,
    });
    console.log(`✓ Created tenant: ${tenant4.name} (ID: ${tenant4.id})`);

    // ===================================================
    // Get Required Accounts
    // ===================================================
    console.log("\nFetching system accounts...");
    const trustAccount =
      await accountRepository.getByName("Trust Cash Account");
    const rentIncomeAccount = await accountRepository.getByName("Rent Income");
    const ownerExpenseAccount =
      await accountRepository.getByName("Owner Expense");
    const managementFeeAccount = await accountRepository.getByName(
      "Management Fee Income",
    );
    const ownerEquityAccount =
      await accountRepository.getByName("Owner Equity");
    const depositLiabilityAccount = await accountRepository.getByName(
      "Security Deposit Liability",
    );

    if (
      !trustAccount ||
      !rentIncomeAccount ||
      !ownerExpenseAccount ||
      !managementFeeAccount ||
      !ownerEquityAccount ||
      !depositLiabilityAccount
    ) {
      console.error(
        "\n❌ Required accounts not found! Please run: node seed/accounts.js",
      );
      process.exit(1);
    }

    // ===================================================
    // Create Sample Transactions - March 2024
    // ===================================================
    console.log("\nCreating sample transactions for March 2024...");

    // Security deposits
    await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: depositLiabilityAccount.id,
      amount: 1500.0,
      memo: "Security deposit received from Alice Smith",
      property_id: property1.id,
      owner_id: owner1.id,
      tenant_id: tenant1.id,
      date: new Date("2024-03-01"),
    });
    console.log("✓ Recorded security deposit for tenant 1");

    await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: depositLiabilityAccount.id,
      amount: 1200.0,
      memo: "Security deposit received from Bob Brown",
      property_id: property1.id,
      owner_id: owner1.id,
      tenant_id: tenant2.id,
      date: new Date("2024-03-15"),
    });
    console.log("✓ Recorded security deposit for tenant 2");

    // Rent collections
    await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: rentIncomeAccount.id,
      amount: 1500.0,
      memo: "Rent collected from Alice Smith for March 2024",
      property_id: property1.id,
      owner_id: owner1.id,
      tenant_id: tenant1.id,
      date: new Date("2024-03-05"),
    });
    console.log("✓ Recorded rent collection from tenant 1");

    await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: rentIncomeAccount.id,
      amount: 1200.0,
      memo: "Rent collected from Bob Brown for March 2024",
      property_id: property1.id,
      owner_id: owner1.id,
      tenant_id: tenant2.id,
      date: new Date("2024-03-10"),
    });
    console.log("✓ Recorded rent collection from tenant 2");

    await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: rentIncomeAccount.id,
      amount: 1800.0,
      memo: "Rent collected from Carol Davis for March 2024",
      property_id: property2.id,
      owner_id: owner1.id,
      tenant_id: tenant3.id,
      date: new Date("2024-03-08"),
    });
    console.log("✓ Recorded rent collection from tenant 3");

    await ledgerService.postTransaction({
      debit_account_id: trustAccount.id,
      credit_account_id: rentIncomeAccount.id,
      amount: 2000.0,
      memo: "Rent collected from Diana Evans for March 2024",
      property_id: property3.id,
      owner_id: owner2.id,
      tenant_id: tenant4.id,
      date: new Date("2024-03-03"),
    });
    console.log("✓ Recorded rent collection from tenant 4");

    // Expenses
    await ledgerService.postTransaction({
      debit_account_id: ownerExpenseAccount.id,
      credit_account_id: trustAccount.id,
      amount: 250.0,
      memo: "Plumbing repairs at 123 Main Street",
      property_id: property1.id,
      owner_id: owner1.id,
      date: new Date("2024-03-12"),
    });
    console.log("✓ Recorded owner expense");

    await ledgerService.postTransaction({
      debit_account_id: ownerExpenseAccount.id,
      credit_account_id: trustAccount.id,
      amount: 150.0,
      memo: "Electrical repairs at 456 Oak Avenue",
      property_id: property2.id,
      owner_id: owner1.id,
      date: new Date("2024-03-20"),
    });
    console.log("✓ Recorded owner expense");

    // Management fees
    await ledgerService.postTransaction({
      debit_account_id: ownerEquityAccount.id,
      credit_account_id: managementFeeAccount.id,
      amount: 325.0,
      memo: "Management fee for March 2024 (property 123 Main)",
      property_id: property1.id,
      owner_id: owner1.id,
      date: new Date("2024-03-01"),
    });
    console.log("✓ Recorded management fee");

    await ledgerService.postTransaction({
      debit_account_id: ownerEquityAccount.id,
      credit_account_id: managementFeeAccount.id,
      amount: 270.0,
      memo: "Management fee for March 2024 (property 456 Oak)",
      property_id: property2.id,
      owner_id: owner1.id,
      date: new Date("2024-03-01"),
    });
    console.log("✓ Recorded management fee");

    await ledgerService.postTransaction({
      debit_account_id: ownerEquityAccount.id,
      credit_account_id: managementFeeAccount.id,
      amount: 300.0,
      memo: "Management fee for March 2024 (property 789 Elm)",
      property_id: property3.id,
      owner_id: owner2.id,
      date: new Date("2024-03-01"),
    });
    console.log("✓ Recorded management fee");

    // Owner distributions
    await ledgerService.postTransaction({
      debit_account_id: ownerEquityAccount.id,
      credit_account_id: trustAccount.id,
      amount: 2500.0,
      memo: "Quarterly distribution to owner for Q1 2024",
      property_id: property1.id,
      owner_id: owner1.id,
      date: new Date("2024-03-31"),
    });
    console.log("✓ Recorded owner distribution");

    // ===================================================
    // Print Summary
    // ===================================================
    console.log("\n" + "=".repeat(50));
    console.log("SAMPLE DATA SEEDING COMPLETED");
    console.log("=".repeat(50));

    // Print balances
    const owner1Balance = await ledgerService.getOwnerBalance(owner1.id);
    const owner2Balance = await ledgerService.getOwnerBalance(owner2.id);

    console.log("\nOwner 1 Balance Summary:");
    console.log(`  Rent Collected: $${owner1Balance.rentCollected.toFixed(2)}`);
    console.log(
      `  Expenses Incurred: $${owner1Balance.expensesIncurred.toFixed(2)}`,
    );
    console.log(
      `  Management Fees: $${owner1Balance.managementFees.toFixed(2)}`,
    );
    console.log(`  Distributions: $${owner1Balance.distributions.toFixed(2)}`);
    console.log(`  Current Balance: $${owner1Balance.balance.toFixed(2)}`);

    console.log("\nOwner 2 Balance Summary:");
    console.log(`  Rent Collected: $${owner2Balance.rentCollected.toFixed(2)}`);
    console.log(
      `  Expenses Incurred: $${owner2Balance.expensesIncurred.toFixed(2)}`,
    );
    console.log(
      `  Management Fees: $${owner2Balance.managementFees.toFixed(2)}`,
    );
    console.log(`  Distributions: $${owner2Balance.distributions.toFixed(2)}`);
    console.log(`  Current Balance: $${owner2Balance.balance.toFixed(2)}`);

    console.log("\n✓ Sample data seeded successfully!");
    console.log("\nYou can now test the accounting API:");
    console.log(
      `  - View owner 1 balance: GET /accounting/owners/${owner1.id}/balance`,
    );
    console.log(
      `  - View owner 2 balance: GET /accounting/owners/${owner2.id}/balance`,
    );
    console.log(
      `  - Get statement for owner 1: GET /accounting/owners/${owner1.id}/statement/2024/3`,
    );
    console.log(
      `  - Get HTML statement: GET /accounting/owners/${owner1.id}/statement/2024/3?format=html`,
    );
  } catch (error) {
    console.error("Error seeding sample data:", error);
    process.exit(1);
  }
};

seedSampleData().then(() => {
  console.log("\nDone.");
  process.exit(0);
});
