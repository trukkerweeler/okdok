/**
 * PM Operations Routes
 * REST API endpoints for PM company operating expenses
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();

const pmExpensesRepository = require("../repositories/pmExpensesRepository");
const pmExpenseReceiptRepository = require("../repositories/pmExpenseReceiptRepository");
const pmExpenseCategoryRepository = require("../repositories/pmExpenseCategoryRepository");

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

// ===================================================
// PM EXPENSES ENDPOINTS
// ===================================================

/**
 * GET / - Get all PM expenses
 */
router.get("/", async (req, res) => {
  try {
    const expenses = await pmExpensesRepository.getAll();

    // Add receipt count to each expense
    const expensesWithReceipts = await Promise.all(
      expenses.map(async (expense) => {
        const receiptCount =
          await pmExpenseReceiptRepository.getCountByExpenseId(expense.id);
        return {
          ...expense,
          receipt_count: receiptCount,
        };
      }),
    );

    res.json(expensesWithReceipts);
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

// ===================================================
// PM EXPENSE SUMMARY ENDPOINTS (Must come before /:id)
// ===================================================

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

// ===================================================
// PM EXPENSE CATEGORIES ENDPOINTS (Must come before /:id)
// ===================================================

/**
 * GET /categories - Get all active expense categories
 */
router.get("/categories", async (req, res) => {
  try {
    const categories = await pmExpenseCategoryRepository.getAll();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /categories/all - Get all categories including inactive (admin only)
 */
router.get("/categories/all", async (req, res) => {
  try {
    const categories =
      await pmExpenseCategoryRepository.getAllIncludeInactive();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /categories - Create new expense category
 */
router.post("/categories", async (req, res) => {
  try {
    const { name, code, color = "#999999", sort_order = 0 } = req.body;

    // Validation
    if (!name || !code) {
      return res
        .status(400)
        .json({ error: "Category name and code are required" });
    }

    // Check if code already exists
    const exists = await pmExpenseCategoryRepository.codeExists(code);
    if (exists) {
      return res.status(400).json({ error: "Category code already exists" });
    }

    const category = await pmExpenseCategoryRepository.create({
      name,
      code,
      color,
      sort_order,
    });

    res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /categories/:id - Update expense category
 */
router.put("/categories/:id", async (req, res) => {
  try {
    const { name, color, sort_order, is_active } = req.body;

    const category = await pmExpenseCategoryRepository.getById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const updated = await pmExpenseCategoryRepository.update(req.params.id, {
      name: name || category.name,
      color: color !== undefined ? color : category.color,
      sort_order: sort_order !== undefined ? sort_order : category.sort_order,
      is_active: is_active !== undefined ? is_active : category.is_active,
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /categories/:id - Delete expense category
 */
router.delete("/categories/:id", async (req, res) => {
  try {
    const category = await pmExpenseCategoryRepository.getById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    await pmExpenseCategoryRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    // If error mentions expenses exist, return 409 Conflict
    if (error.message.includes("Cannot delete category")) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Error deleting category:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// PM EXPENSE CATEGORY FILTER ENDPOINTS (Must come before /:id)
// ===================================================

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

// ===================================================
// PM EXPENSE RECEIPTS ENDPOINTS (Must come before /:id)
// ===================================================

/**
 * GET /receipts/:receiptId - Download receipt file
 */
router.get("/receipts/:receiptId", async (req, res) => {
  try {
    const receipt = await pmExpenseReceiptRepository.getById(
      req.params.receiptId,
    );
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

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
 * DELETE /receipts/:receiptId - Delete receipt file
 */
router.delete("/receipts/:receiptId", async (req, res) => {
  try {
    const receipt = await pmExpenseReceiptRepository.getById(
      req.params.receiptId,
    );
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    await pmExpenseReceiptRepository.delete(req.params.receiptId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting receipt:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================================
// GENERIC PM EXPENSE ENDPOINTS (/:id routes MUST come last)
// ===================================================

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
 * POST /:id/receipts - Upload receipt for PM expense
 */
router.post("/:id/receipts", upload.single("file"), async (req, res) => {
  try {
    const expenseId = req.params.id;

    // Verify expense exists
    const expense = await pmExpensesRepository.getById(expenseId);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    // Verify file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Create new receipt
    const receipt = await pmExpenseReceiptRepository.create({
      pm_expense_id: expenseId,
      receipt_type: req.body.receipt_type || "receipt",
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
});

/**
 * GET /:id/receipts - Get all receipts for PM expense
 */
router.get("/:id/receipts", async (req, res) => {
  try {
    const expenseId = req.params.id;

    // Verify expense exists
    const expense = await pmExpensesRepository.getById(expenseId);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    const receipts = await pmExpenseReceiptRepository.getByExpenseId(expenseId);
    res.json(receipts);
  } catch (error) {
    console.error("Error fetching receipts:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
