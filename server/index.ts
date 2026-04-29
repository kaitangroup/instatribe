import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, testConnection } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// ─── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com"],
            fontSrc: ["'self'", "https://api.fontshare.com", "data:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin (no Origin header) or explicitly listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ─── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  skip: (req) => !req.path.startsWith("/api"), // Only limit API routes
});
app.use(limiter);

// Stricter limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});
app.use("/api/register", authLimiter);
app.use("/api/login", authLimiter);

// ─── Session ───────────────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    name: "kindred.sid",
    secret: process.env.SESSION_SECRET ?? "change-this-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// ─── Request logging ───────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedBody: Record<string, unknown> | undefined;

  if (path.startsWith("/api")) {
    const originalJson = res.json;
    res.json = function (body, ...args) {
      capturedBody = body;
      return originalJson.apply(res, [body, ...args]);
    };
  }

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      let bodyStr = "";
      if (capturedBody !== undefined) {
        bodyStr = JSON.stringify(capturedBody);
        if (bodyStr.length > 80) bodyStr = bodyStr.slice(0, 77) + "…";
      }
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms${bodyStr ? " :: " + bodyStr : ""}`);
    }
  });

  next();
});

// ─── Global error handler ──────────────────────────────────────────────────────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = isProd && status >= 500 ? "Internal server error" : err.message ?? "Internal server error";
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ error: message });
});

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    // Verify DB connectivity before accepting traffic
    await testConnection();
  } catch (err) {
    console.error("[startup] Database connection failed:", err);
    process.exit(1);
  }

  const httpServer = createServer(app);
  registerRoutes(httpServer, app);

  if (isProd) {
    serveStatic(app);
  } else {
    await setupVite(app, httpServer);
  }

  const PORT = Number(process.env.PORT ?? 5000);
  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
