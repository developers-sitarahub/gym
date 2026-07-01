import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import prisma from "./prisma.js";
import { initSocket } from "./socket.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import whatsappRouter from "./routes/whatsapp.route.js";
import whatsappWebhookRouter from "./routes/whatsappWebhook.route.js";
import whatsappTemplatesRouter from "./routes/whatsappTemplates.route.js";
import inboxRouter from "./routes/inbox.route.js";
import membersRouter from "./routes/members.route.js";
import plansRouter from "./routes/plans.route.js";
import paymentsRouter from "./routes/payments.route.js";
import { authenticateToken, scopeToGym } from "./middleware/auth.js";
import "./lib/queue.js";


import mediaRouter from "./routes/media.route.js";

const app = express();
app.set("trust proxy", 1);

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman, webhooks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🔒 CORS Blocked: Request origin "${origin}" is not allowed. Allowed:`, allowedOrigins);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.set("etag", false);

/* ================= ROUTES ================= */
app.get("/ping", (req, res) => res.send("pong"));

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard/:gymSlug/whatsapp/templates", authenticateToken, scopeToGym, whatsappTemplatesRouter);
app.use("/api/dashboard/:gymSlug/whatsapp", authenticateToken, scopeToGym, whatsappRouter);
app.use("/api/dashboard/:gymSlug/inbox", authenticateToken, scopeToGym, inboxRouter);
app.use("/api/dashboard/:gymSlug/members", authenticateToken, scopeToGym, membersRouter);
app.use("/api/dashboard/:gymSlug/plans", authenticateToken, scopeToGym, plansRouter);
app.use("/api/dashboard/:gymSlug/payments", authenticateToken, scopeToGym, paymentsRouter);
app.use("/api/media/:gymSlug", authenticateToken, scopeToGym, mediaRouter);
app.use("/uploads", express.static("uploads"));
app.use("/webhook", whatsappWebhookRouter);



/* ================= ERROR HANDLING ================= */
app.use((err, req, res, next) => {
  if (err) {
    console.error("❌ Global Error:", err);
    return res.status(500).json({
      message: "Internal Server Error",
      error: err.message || "Unknown error occurred",
    });
  }
  next();
});

/* ================= SERVER START ================= */
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(error);
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Gym Backend + WebSocket running on port ${PORT}`);
  });
}

startServer();
