// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next(); // User is authenticated, continue
  } else {
    return res.status(401).json({
      message: "Authentication required",
      redirect: "/login.html",
    });
  }
};

// Optional middleware for pages that can work with or without auth
const optionalAuth = (req, res, next) => {
  // Just pass through, letting the frontend handle auth checks
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
};
