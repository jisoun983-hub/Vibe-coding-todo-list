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
    service: "todo-backend",
    mongoReadyState: mongoose.connection.readyState,
    memory: process.memoryUsage()
  });
});

// Ensure model is registered before routes.
void Todo;

app.use(
  "/todos",
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "MongoDB not connected" });
    }
    return next();
  },
  todoRouter
);

const server = app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`listening on http://0.0.0.0:${PORT}`);

  if (!MONGODB_URI) {
    // eslint-disable-next-line no-console
    console.error("MONGODB_URI is not set; MongoDB will not be connected.");
    return;
  }

  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    })
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("MongoDB connected");
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("MongoDB connection failed:", err);
    });
});

const shutdown = async () => {
  await mongoose.disconnect().catch(() => {});
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
