import { app } from "./app.js";
import { initDb } from "./db.js";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(root, ".env") });

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    console.log("[Themis Escrow Backend] Initializing database and services...");
    await initDb();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Themis Escrow Backend] Server running on http://0.0.0.0:${PORT}`);
      console.log(`[Themis Escrow Backend] Health endpoint: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error("[Themis Escrow Backend] Failed to start:", err);
    process.exit(1);
  }
}

start();
