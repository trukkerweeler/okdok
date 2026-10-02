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
      const separatorIndex = pair.indexOf(":");
      if (separatorIndex > 0) {
        const username = pair.slice(0, separatorIndex).trim();
        const password = pair.slice(separatorIndex + 1).trim();
        if (username && password) users[username] = password;
      }
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

  if (Object.keys(USERS).length === 0) {
    return res.status(503).json({
      error: "Authentication is not configured. Set AUTH_USER and AUTH_PASS in .env.",
    });
  }

  const expected = USERS[username];
  if (!expected || expected !== password) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  if (!req.session) {
    return res.status(500).json({ error: "Session support is unavailable" });
  }

  req.session.regenerate((error) => {
    if (error) {
      console.error("Failed to create login session:", error);
      return res.status(500).json({ error: "Unable to start a login session" });
    }
    req.session.user = username;
    req.session.user_id = username;
    req.session.save((saveError) => {
      if (saveError) {
        console.error("Failed to save login session:", saveError);
        return res.status(500).json({ error: "Unable to save login session" });
      }
      return res.json({ ok: true, user: username });
    });
  });
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((error) => {
      if (error) {
        console.error("Failed to destroy login session:", error);
        return res.status(500).json({ error: "Unable to log out" });
      }
      res.clearCookie("connect.sid");
      return res.json({ ok: true });
    });
  } else {
    res.json({ ok: true });
  }
});

// GET /auth/status
router.get("/status", (req, res) => {
  const user = req.session && req.session.user;
  res.json({ loggedIn: Boolean(user), authenticated: Boolean(user), user: user || null });
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
