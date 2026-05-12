const path = require("node:path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Put it in .env");
  }

  await mongoose.connect(MONGODB_URI);

  // Disable any legacy collection validation rules left in the DB.
  // This project now uses Mongoose-only schema rules.
  await mongoose.connection.db.command({
    collMod: "todos",
    validator: {},
    validationLevel: "off"
  });

  // eslint-disable-next-line no-console
  console.log("todos validator disabled");

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

