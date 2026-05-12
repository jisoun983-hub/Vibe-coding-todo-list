const path = require("node:path");
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const Todo = require("./models/Todo");
const todoRouter = require("./routers/todoRouter");

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// Ensure model is registered before routes.
void Todo;
app.use("/todos", todoRouter);

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`listening on http://localhost:${PORT}`);

  if (!MONGODB_URI) {
    // eslint-disable-next-line no-console
    console.error(
      "MONGODB_URI is not set. Set it in environment or .env for database features."
    );
    return;
  }

  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("연결 성공");
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
    });
});

const shutdown = async () => {
  await mongoose.disconnect().catch(() => {});
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
