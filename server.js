const exp = require("constants");
const cors = require("cors");
const express = require("express");
const session = require("express-session");
const app = express();
// Load environment variables from .env if present (dev convenience)
const configModule = require("./config");

// Load environment-based configuration
const { port: configPort, env: nodeEnv } = configModule;
const isDevelopment = nodeEnv === "development";
const isProduction = nodeEnv === "production";
// Dev environment should always use port 3002
const port = isDevelopment ? 3002 : process.env.PORT || configPort || 3002;

// Configure CORS to allow credentials
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from any origin (we'll be more specific if needed)
    // For now, allow all for development
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Request logging middleware - log only state-changing requests (POST, PUT, DELETE, PATCH)
app.use((req, res, next) => {
  if (
    isDevelopment &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)
  ) {
    console.log(`[${req.method}] ${req.path}`);
  }
  next();
});

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Disable caching for all static files to prevent stale files being served
app.use(
  express.static("public", {
    maxAge: 0,
    etag: false,
    setHeaders: (res, path, stat) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  }),
);
app.use(express.json());

// Redirect root requests to the transactions page
app.get(["/", "/index.html"], (req, res) => {
  res.redirect(302, "/transactions.html");
});

// IP-to-User Mapping removed: authentication will rely on session or explicit dev default.

// Default user for development mode (localhost testing)
const devDefaultUser = "TKENT";

// Middleware: Set user from session or IP mapping
app.use((req, res, next) => {
  // Get user from existing session
  if (req.session && req.session.user_id) {
    req.user = req.session.user_id;
  }

  // Dev mode: Use default user if no user identified
  if (!req.user && isDevelopment) {
    req.user = devDefaultUser;
    if (req.session) req.session.user_id = req.user;
  }

  next();
});

// Set CORS headers for requests WITH credentials support
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    // Fallback if no origin header (same-origin requests)
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  next();
});

// Configuration endpoint for UI config
app.get("/config", (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const configPath = path.join(__dirname, "qms.config.json");
    const configData = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configData);
    res.json(config);
  } catch (error) {
    console.error("Error reading config file:", error);
    // Fallback configuration
    res.json({
      ui: { enableRowColors: false },
      table: { defaultSortOrder: "desc" },
      features: { enableEmailNotifications: true },
    });
  }
});

// API configuration endpoint - returns the API URL for frontend to use
app.get("/api/config", (req, res) => {
  let apiUrl = process.env.API_URL;

  // If API_URL not explicitly set, generate it based on environment
  if (!apiUrl) {
    if (isDevelopment) {
      apiUrl = `http://localhost:${port}`;
    } else {
      apiUrl = `http://192.168.1.10:${port}`;
    }
  }

  res.json({ apiUrl });
});

// Client IP endpoint - returns the client's IP address
app.get("/api/client-ip", (req, res) => {
  // Get client IP from various possible headers (for proxy/load balancer scenarios)
  // or fallback to direct connection IP
  const clientIP =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-client-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip;

  res.json({ ip: clientIP });
});

// Autoload routes from the routes directory
const fs = require("fs");
const path = require("path");
const os = require("os");

const routesDir = path.join(__dirname, "routes");

fs.readdirSync(routesDir)
  .filter((file) => file.endsWith(".js") && !file.includes(".vbs"))
  .sort()
  .forEach((file) => {
    const routeName = path.basename(file, ".js");

    // Skip files that are not route modules
    if (["auth"].includes(routeName)) {
      return;
    }

    try {
      const filePath = path.join(routesDir, file);
      const stats = require("fs").statSync(filePath);

      // Skip empty files
      if (stats.size === 0) {
        return;
      }

      const routes = require(filePath);

      // Skip if not a valid middleware function or router
      if (!routes || (typeof routes !== "function" && !routes.stack)) {
        console.warn(`Skipped route ${file}: does not export valid middleware`);
        return;
      }

      // Map file names to route paths
      // Special cases: documents uses "/" root path
      let routePath = `/${routeName}`;
      if (routeName === "documents") {
        routePath = "/";
      }

      app.use(routePath, routes);
    } catch (error) {
      console.error(`Error loading route ${file}:`, error.message);
    }
  });

// Load auth routes separately (typically middleware)
try {
  const authRoutes = require("./routes/auth");
  app.use("/auth", authRoutes);
} catch (error) {
  console.error(`Error loading auth routes:`, error.message);
}

// Load PM operations routes (PM company expenses)
try {
  const pmOperationsRoutes = require("./routes/pm-operations");
  app.use("/pm-expenses", pmOperationsRoutes);
} catch (error) {
  console.error(`Error loading PM operations routes:`, error.message);
}

// Load cert3 routes (new certificate search with drill-down)
// try {
//   const cert3Routes = require("./routes/cert3");
//   app.use("/cert3", cert3Routes);
//   console.log(`Loaded route: /cert3 from cert3.js`);
// } catch (error) {
//   console.error(`Error loading cert3 routes:`, error.message);
// }

// Serve training files from a dedicated directory
const trainingFilesPath =
  process.env.TRAINING_FILES_PATH || path.join(__dirname, "training-files");
app.use("/training-files", express.static(trainingFilesPath));

// Use environment variable for input files path
const inputFilesPath =
  process.env.INPUT_FILES_PATH ||
  "\\\\fs1\\Common\\Quality\\00000_Work Instructions";
app.use("/input-files", express.static(inputFilesPath));

// Use environment variable for document files path
const documentFilesPath =
  process.env.DOCUMENT_FILES_PATH || "\\\\fs1\\Common\\Quality";
app.use("/document-files", express.static(documentFilesPath));

// Use environment variable for device images path
const hostname = os.hostname();
let baseDeviceImagesPath;
if (hostname === "QUALITY-MGR") {
  baseDeviceImagesPath = "C:\\Quality - Records\\7150 - Calibration\\";
} else {
  baseDeviceImagesPath =
    process.env.DEVICE_IMAGES_PATH ||
    "\\\\fs1\\Common\\Quality - Records\\7150 - Calibration\\";
}
const deviceImagesPath = path.join(baseDeviceImagesPath, "_device-images");
app.use("/_device-images", express.static(deviceImagesPath));

// Use environment variable for equipment images path
let baseEquipmentImagesPath;
if (hostname === "QUALITY-MGR") {
  baseEquipmentImagesPath = "C:\\Quality - Records\\8511 - Equipment\\";
} else {
  baseEquipmentImagesPath =
    process.env.EQUIPMENT_IMAGES_PATH ||
    "\\\\fs1\\Common\\Quality - Records\\8511 - Equipment\\";
}
const equipmentImagesPath = path.join(
  baseEquipmentImagesPath,
  "_equipment_images",
);
app.use("/_equipment-images", express.static(equipmentImagesPath));

// Catch-all 404 handler for debugging
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.path} - No matching route found`);
  res
    .status(404)
    .json({ error: "Not found", path: req.path, method: req.method });
});

app.listen(port, "0.0.0.0", async () => {
  console.log(
    `okdOk Server running (${nodeEnv}) on port ${port} - http://localhost:${port}`,
  );
  scheduleAlerts();
});

// ── Daily Alert Scheduler ────────────────────────────────────────────────────
// Fires at 8:00 AM every day, sends any SMS alerts due that day.
function scheduleAlerts() {
  const { runDailyAlerts } = require("./services/alertService");

  function msUntilNext8am() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(8, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  // Also run immediately on startup for any alerts due today that haven't fired
  runDailyAlerts().catch((err) =>
    console.error("[Alerts] Startup check error:", err.message),
  );

  // Schedule first run at 8am, then every 24h after that
  setTimeout(function tick() {
    runDailyAlerts().catch((err) =>
      console.error("[Alerts] Scheduled run error:", err.message),
    );
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, msUntilNext8am());

  console.log(
    `[Alerts] Scheduler started. Next run at 8:00 AM (in ${Math.round(msUntilNext8am() / 60000)} min)`,
  );
}
