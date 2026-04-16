const express = require("express");
const router = express.Router();

// Auth routes (session-based).
// Configure allowed users via env:
// - AUTH_USERS = "user1:pass1,user2:pass2"  OR
// - AUTH_USER and AUTH_PASS (single user)
// NOTE: Passwords are plain-text in env for this simple implementation —
// for production, use hashed passwords stored in a secure store or the DB.

function loadUsersFromEnv() {
  const users = {};
  const list = process.env.AUTH_USERS;
  if (list) {
    list.split(",").forEach((pair) => {
      const [u, p] = pair.split(":");
      if (u && p) users[u.trim()] = p.trim();
    });
  }
  if (process.env.AUTH_USER && process.env.AUTH_PASS) {
    users[process.env.AUTH_USER] = process.env.AUTH_PASS;
  }
  return users;
}

const USERS = loadUsersFromEnv();

// POST /auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  // If AUTH_USERS provided, check against it
  if (Object.keys(USERS).length > 0) {
    const expected = USERS[username];
    if (!expected || expected !== password) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    // success
    if (req.session) {
      req.session.user = username;
    }
    return res.json({ ok: true, user: username });
  }

  // No env users configured: allow any username when in development (auto-login)
  if ((process.env.NODE_ENV || "development") === "development") {
    if (req.session) req.session.user = username;
    return res.json({ ok: true, user: username, note: "dev auto-login" });
  }

  return res.status(403).json({ error: "authentication not configured" });
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  } else {
    res.json({ ok: true });
  }
});

// GET /auth/me
router.get("/me", (req, res) => {
  if (req.session && req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

module.exports = router;
