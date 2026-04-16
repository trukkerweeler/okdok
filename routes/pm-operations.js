/**
 * PM Operations Routes
 * REST API endpoints for PM company operating expenses
 */
const express = require("express");
const router = express.Router();

const pmExpensesRepository = require("../repositories/pmExpensesRepository");

// ===================================================
// PM EXPENSES ENDPOINTS
// ===================================================

/**
 * GET / - Get all PM expenses
 */
router.get("/", async (req, res) => {
  try {
    const expenses = await pmExpensesRepository.getAll();
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching PM expenses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:id - Get PM expense by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const expense = await pmExpensesRepository.getById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    console.error("Error fetching PM expense:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /category/:category - Get PM expenses by category
 */
router.get("/category/:category", async (req, res) => {
  try {
    const expenses = await pmExpensesRepository.getByCategory(
      req.params.category,
    );
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching PM expenses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST / - Create new PM expense
 */
router.post("/", async (req, res) => {
  try {
    const { category, amount, description, vendor_id, date } = req.body;

    // Validation
    if (!category || !amount || !description) {
      return res
        .status(400)
        .json({ error: "Category, amount, and description are required" });
    }

    if (amount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be greater than zero" });
    }

    if (!vendor_id) {
      return res.status(400).json({ error: "Vendor is required" });
    }

    const expense = await pmExpensesRepository.create({
      category,
      amount,
      description,
      vendor_id,
      date,
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error("Error creating PM expense:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /:id - Update PM expense
 */
router.put("/:id", async (req, res) => {
  try {
    const { category, amount, description, vendor_id, date } = req.body;

    const expense = await pmExpensesRepository.update(req.params.id, {
      category,
      amount,
      description,
      vendor_id,
      date,
    });

    res.json(expense);
  } catch (error) {
    console.error("Error updating PM expense:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /:id - Delete PM expense
 */
router.delete("/:id", async (req, res) => {
  try {
    await pmExpensesRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting PM expense:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /summary/:year/:month - Get PM expenses summary
 */
router.get("/summary/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const summary = await pmExpensesRepository.getSummary(year, month);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching PM expenses summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /summary/:year - Get PM expenses summary by year
 */
router.get("/summary/:year", async (req, res) => {
  try {
    const { year } = req.params;
    const summary = await pmExpensesRepository.getSummary(year);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching PM expenses summary:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
