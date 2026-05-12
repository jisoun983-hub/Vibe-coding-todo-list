const express = require("express");
const Todo = require("../models/Todo");
const mongoose = require("mongoose");

const router = express.Router();

// GET /todos
router.get("/", async (_req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    return res.json(todos);
  } catch (err) {
    console.error("GET /todos error:", err);
    return res.status(500).json({
      message: "internal error",
      error: err.message,
      detail: String(err),
    });
  }
});

// DELETE /todos/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "invalid id" });
    }

    const deleted = await Todo.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "todo not found" });
    }

    return res.status(204).end();
  } catch (err) {
    console.error("DELETE /todos/:id error:", err);
    return res.status(500).json({
      message: "internal error",
      error: err.message,
      detail: String(err),
    });
  }
});

// PATCH /todos/:id
// body: { content?: string, completed?: boolean }
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "invalid id" });
    }

    const { content, completed } = req.body ?? {};
    const update = {};

    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "content must be a string" });
      }
      update.content = content.trim();
    }

    if (completed !== undefined) {
      if (typeof completed !== "boolean") {
        return res.status(400).json({ message: "completed must be a boolean" });
      }
      update.completed = completed;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "no fields to update" });
    }

    const todo = await Todo.findByIdAndUpdate(id, update, { new: true });
    if (!todo) {
      return res.status(404).json({ message: "todo not found" });
    }

    return res.json(todo);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "internal error" });
  }
});

// POST /todos
// body: { content: string }
router.post("/", async (req, res) => {
  try {
    const { content } = req.body ?? {};

    if (typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "content is required" });
    }

    const todo = await Todo.create({ content: content.trim() });
    return res.status(201).json(todo);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "internal error" });
  }
});

module.exports = router;

