const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Todo = require("./models/Todo");
const todoRouter = require("./routers/todoRouter");

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "todo-backend",
    message: "Todo backend is running",
    endpoints: ["/health", "/todos"]
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    dbState: mongoose.connection.readyState
  });
});

// Ensure model is registered before routes.
void Todo;

app.use(
  "/todos",
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        message: "database not connected",
        dbState: mongoose.connection.readyState
      });
    }
    return next();
  },
  todoRouter
);

async function start() {
  if (!MONGODB_URI) {
    // eslint-disable-next-line no-console
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    // eslint-disable-next-line no-console
    console.log("MongoDB connected");

    const server = app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`listening on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      await mongoose.disconnect().catch(() => {});
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}

start();
