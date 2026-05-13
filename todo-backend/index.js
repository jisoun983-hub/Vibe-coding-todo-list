const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

mongoose.set("bufferCommands", false);

let lastMongoError = null;

function summarizeMongoError(err) {
  if (!err || typeof err !== "object") {
    return { message: String(err) };
  }
  const anyErr = /** @type {any} */ (err);
  return {
    name: typeof anyErr.name === "string" ? anyErr.name : undefined,
    message: typeof anyErr.message === "string" ? anyErr.message : String(err),
    code: anyErr.code
  };
}

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
    service: "todo-backend",
    mongoReadyState: mongoose.connection.readyState,
    endpoints: ["/health", "/todos"],
    lastMongoError
  });
});

// Ensure model is registered before routes.
void Todo;

app.use(
  "/todos",
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "MongoDB not connected",
        mongoReadyState: mongoose.connection.readyState
      });
    }
    return next();
  },
  todoRouter
);

async function start() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      // eslint-disable-next-line no-console
      console.log("MongoDB connected successfully");
      lastMongoError = null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("MongoDB connection failed; HTTP server will still start.");
      // eslint-disable-next-line no-console
      console.error(err);
      lastMongoError = summarizeMongoError(err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("MONGODB_URI is not set; skipping MongoDB connect.");
    lastMongoError = { message: "MONGODB_URI is not set" };
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`HTTP server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async () => {
    await mongoose.disconnect().catch(() => {});
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.log("Fatal error during startup:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
