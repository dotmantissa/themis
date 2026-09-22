import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { Agent, setGlobalDispatcher, interceptors } from "undici";
setGlobalDispatcher(new Agent({ connect: { family: 4 } }).compose(interceptors.decompress()));

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(root, ".env") });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_uy0NsKceC6Rf@ep-royal-breeze-b4kgac75-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export const sql = neon(connectionString);

/**
 * Initialize Neon PostgreSQL schema for Themis
 */
export async function initDb() {
  console.log("[Themis DB] Initializing Neon PostgreSQL tables...");

  // Users table (strictly email based auth via Privy)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      privy_did VARCHAR(255),
      wallet_address VARCHAR(255),
      dripped_at TIMESTAMP WITH TIME ZONE,
      dripped_tx_hash VARCHAR(100),
      dripped_amount_wei VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS dripped_at TIMESTAMP WITH TIME ZONE;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS dripped_tx_hash VARCHAR(100);`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS dripped_amount_wei VARCHAR(100);`;


  // Grant rounds table
  await sql`
    CREATE TABLE IF NOT EXISTS rounds (
      id SERIAL PRIMARY KEY,
      round_id VARCHAR(100) UNIQUE NOT NULL,
      creator VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      pool_wei VARCHAR(100) NOT NULL,
      remaining_pool_wei VARCHAR(100) NOT NULL,
      grant_amount_wei VARCHAR(100) NOT NULL,
      bond_amount_wei VARCHAR(100) NOT NULL,
      finality_window_seconds INTEGER NOT NULL DEFAULT 3600,
      duration_seconds INTEGER NOT NULL DEFAULT 604800,
      expires_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
      tx_hash VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE rounds ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 604800;`;
  await sql`ALTER TABLE rounds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;`;
  await sql`ALTER TABLE rounds ADD COLUMN IF NOT EXISTS reward_recipients_count INTEGER DEFAULT 1;`;

  // Claims table (mirrors on-chain two-tier verdicts and evidence)
  await sql`
    CREATE TABLE IF NOT EXISTS claims (
      id SERIAL PRIMARY KEY,
      claim_id VARCHAR(100) UNIQUE NOT NULL,
      round_id VARCHAR(100) NOT NULL,
      claimant VARCHAR(100) NOT NULL,
      claimant_email VARCHAR(255),
      pr_url TEXT NOT NULL,
      activity_url TEXT NOT NULL,
      screenshot_url TEXT,
      notes TEXT,
      bond_wei VARCHAR(100) NOT NULL,
      grant_wei VARCHAR(100) NOT NULL,
      tier1_pr_merged BOOLEAN DEFAULT FALSE,
      tier2_sybil_score INTEGER DEFAULT 0,
      tier2_sybil_tier VARCHAR(50) DEFAULT 'ORGANIC',
      fraud_detected BOOLEAN DEFAULT FALSE,
      verdict VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      verdict_reasoning TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'ADJUDICATED',
      finality_expires_at TIMESTAMP WITH TIME ZONE,
      settled_at TIMESTAMP WITH TIME ZONE,
      is_appealed BOOLEAN DEFAULT FALSE,
      appeal_reason TEXT,
      tx_hash VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS strength_score INTEGER DEFAULT 0;`;
  await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS strength_assessment TEXT;`;
  await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 0;`;
  await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS reward_payout_wei VARCHAR(100) DEFAULT '0';`;

  // Appeals table
  await sql`
    CREATE TABLE IF NOT EXISTS appeals (
      id SERIAL PRIMARY KEY,
      appeal_id VARCHAR(100) UNIQUE NOT NULL,
      claim_id VARCHAR(100) NOT NULL,
      appellant VARCHAR(100) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      tx_hash VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Audit and transaction log
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      actor VARCHAR(100) NOT NULL,
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  console.log("[Themis DB] Database tables initialized successfully.");
}
