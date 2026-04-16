// API endpoint to list input files for work instructions
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const inputFilesPath =
  process.env.INPUT_FILES_PATH ||
  String.raw`\\fs1\Common\Quality\00000_Work Instructions`;

router.get("/list", (req, res) => {
  try {
    const files = fs.readdirSync(inputFilesPath);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Unable to list files" });
  }
});

module.exports = router;
