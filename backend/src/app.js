import express from "express";
import cors from "cors";
import { sql } from "./db.js";
import {
  getContractAddress,
  getDeployerAddress,
  readMetricsOnChain,
  readRoundOnChain,
  readClaimOnChain,
  readAllRoundIdsOnChain,
  readClaimsByRoundOnChain,
  submitClaimAbstracted,
  createRoundAbstracted,
  settleClaimAbstracted,
  appealClaimAbstracted,
} from "./genlayer.js";
import { optionalAuth, requireAuth } from "./privy.js";

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsed}ms)`);
  });
  next();
});

import { initDb } from "./db.js";

let dbReady = false;
let dbPromise = null;
async function ensureDb() {
  if (dbReady) return;
  if (!dbPromise) {
    dbPromise = initDb()
      .then(() => {
        dbReady = true;
      })
      .catch((err) => {
        console.warn("[Themis DB] Lazy initDb warning:", err.message);
        dbPromise = null;
      });
  }
  return dbPromise;
}

app.use(async (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path === "/health" ||
    req.path === "/rounds" ||
    req.path === "/claims"
  ) {
    await ensureDb();
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// System & Telemetry Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get(["/api", "/api/", "/api/health", "/health"], async (req, res) => {
  let dbOk = false;
  try {
    const dbTest = await sql`SELECT NOW() AS now`;
    dbOk = Boolean(dbTest?.[0]?.now);
  } catch (err) {
    console.error("[Health] DB check failed:", err.message);
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbOk ? "connected" : "degraded",
    network: "studionet",
    contract: getContractAddress(),
    deployer: getDeployerAddress(),
  });
});

app.get(["/api/config", "/config"], (req, res) => {
  res.json({
    contractAddress: getContractAddress(),
    chainId: 61999,
    network: "studionet",
    rpcUrl: "https://studio.genlayer.com/api",
    explorerUrl: "https://genlayer-explorer.vercel.app",
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID,
  });
});

app.get(["/api/metrics", "/metrics"], async (req, res) => {
  try {
    const onChain = await readMetricsOnChain();

    // Query DB totals as well
    const dbRoundsCount = await sql`SELECT COUNT(*) AS count FROM rounds`;
    const dbClaimsCount = await sql`SELECT COUNT(*) AS count FROM claims`;
    const dbApprovedCount = await sql`SELECT COUNT(*) AS count FROM claims WHERE verdict = 'APPROVED'`;
    const dbFraudCount = await sql`SELECT COUNT(*) AS count FROM claims WHERE verdict = 'REJECTED_SYBIL_FRAUD'`;

    res.json({
      onChain: onChain || {
        total_rounds: 0,
        total_claims: 0,
        total_pool_deposited_wei: "0",
        total_grants_disbursed_wei: "0",
        total_bonds_staked_wei: "0",
        total_bonds_slashed_wei: "0",
        dispute_bounty_pool_wei: "0",
      },
      db: {
        rounds: Number(dbRoundsCount[0]?.count || 0),
        claims: Number(dbClaimsCount[0]?.count || 0),
        approved: Number(dbApprovedCount[0]?.count || 0),
        fraud_slashed: Number(dbFraudCount[0]?.count || 0),
      },
    });
  } catch (err) {
    console.error("[Metrics Error]:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// User & Auth Endpoints (Email-Only)
// ─────────────────────────────────────────────────────────────────────────────

app.post(["/api/auth/sync", "/auth/sync"], async (req, res) => {
  try {
    const { email, privyDid, walletAddress } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await sql`
      INSERT INTO users (email, privy_did, wallet_address, last_login)
      VALUES (${cleanEmail}, ${privyDid || null}, ${walletAddress || null}, NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        privy_did = COALESCE(EXCLUDED.privy_did, users.privy_did),
        wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address),
        last_login = NOW()
      RETURNING *;
    `;

    res.json({ success: true, user: result[0] });
  } catch (err) {
    console.error("[Auth Sync Error]:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

app.get(["/api/users/:email", "/users/:email"], async (req, res) => {
  try {
    const cleanEmail = req.params.email.trim().toLowerCase();
    const users = await sql`SELECT * FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    if (!users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const claims = await sql`
      SELECT * FROM claims WHERE claimant_email = ${cleanEmail} ORDER BY created_at DESC
    `;

    res.json({
      user: users[0],
      claims,
    });
  } catch (err) {
    console.error("[Get User Error]:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Grant Rounds Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get(["/api/rounds", "/rounds"], async (req, res) => {
  try {
    // 1. Fetch rounds from DB
    const dbRounds = await sql`SELECT * FROM rounds ORDER BY created_at DESC`;

    // 2. Fetch all round IDs from on-chain contract to ensure complete sync
    const onChainRoundIds = await readAllRoundIdsOnChain();

    // Map of existing round IDs
    const existingIds = new Set(dbRounds.map((r) => r.round_id));

    // Backfill any on-chain rounds not yet stored in DB
    for (const rid of onChainRoundIds) {
      if (!existingIds.has(rid)) {
        const onChainData = await readRoundOnChain(rid);
        if (onChainData) {
          await sql`
            INSERT INTO rounds (
              round_id, creator, title, description,
              pool_wei, remaining_pool_wei, grant_amount_wei, bond_amount_wei,
              finality_window_seconds, status, created_at
            ) VALUES (
              ${rid},
              ${onChainData.creator || "0x0"},
              ${onChainData.title || "Grant Round"},
              ${onChainData.description || ""},
              ${onChainData.pool_wei || "0"},
              ${onChainData.remaining_pool_wei || "0"},
              ${onChainData.grant_amount_per_claim_wei || "0"},
              ${onChainData.required_bond_wei || "0"},
              ${Number(onChainData.finality_window_seconds || 3600)},
              ${onChainData.status || "OPEN"},
              to_timestamp(${Number(onChainData.created_at || Math.floor(Date.now() / 1000))})
            )
            ON CONFLICT (round_id) DO NOTHING;
          `;
        }
      }
    }

    // Return fresh refreshed rounds
    const refreshedRounds = await sql`SELECT * FROM rounds ORDER BY created_at DESC`;
    res.json(refreshedRounds);
  } catch (err) {
    console.error("[Get Rounds Error]:", err);
    res.status(500).json({ error: "Failed to fetch grant rounds" });
  }
});

app.get(["/api/rounds/:id", "/rounds/:id"], async (req, res) => {
  try {
    const roundId = req.params.id;
    const dbRound = await sql`SELECT * FROM rounds WHERE round_id = ${roundId} LIMIT 1`;

    let round = dbRound[0] || null;
    if (!round) {
      const onChain = await readRoundOnChain(roundId);
      if (onChain) {
        round = {
          round_id: roundId,
          creator: onChain.creator,
          title: onChain.title,
          description: onChain.description,
          pool_wei: onChain.pool_wei,
          remaining_pool_wei: onChain.remaining_pool_wei,
          grant_amount_wei: onChain.grant_amount_per_claim_wei,
          bond_amount_wei: onChain.required_bond_wei,
          finality_window_seconds: onChain.finality_window_seconds,
          status: onChain.status,
        };
      }
    }

    if (!round) {
      return res.status(404).json({ error: "Round not found" });
    }

    // Fetch claims for this round
    const claims = await sql`
      SELECT * FROM claims WHERE round_id = ${roundId} ORDER BY created_at DESC
    `;

    res.json({ round, claims });
  } catch (err) {
    console.error("[Get Round Detail Error]:", err);
    res.status(500).json({ error: "Failed to fetch round detail" });
  }
});

app.post(["/api/rounds", "/rounds"], optionalAuth, async (req, res) => {
  try {
    const {
      roundId,
      title,
      description,
      grantAmountWei,
      bondAmountWei,
      poolDepositWei,
      finalitySeconds = 3600,
    } = req.body;

    if (!roundId || !title || !grantAmountWei || !bondAmountWei || !poolDepositWei) {
      return res.status(400).json({ error: "Missing required round parameters" });
    }

    // Submit abstracted transaction on GenLayer
    const { txHash, round } = await createRoundAbstracted({
      roundId,
      title,
      description: description || "",
      grantAmountWei,
      bondAmountWei,
      poolDepositWei,
      finalitySeconds,
    });

    // Record in Neon DB
    await sql`
      INSERT INTO rounds (
        round_id, creator, title, description,
        pool_wei, remaining_pool_wei, grant_amount_wei, bond_amount_wei,
        finality_window_seconds, status, tx_hash
      ) VALUES (
        ${roundId},
        ${round.creator || getDeployerAddress()},
        ${title},
        ${description || ""},
        ${String(poolDepositWei)},
        ${String(poolDepositWei)},
        ${String(grantAmountWei)},
        ${String(bondAmountWei)},
        ${Number(finalitySeconds)},
        'OPEN',
        ${txHash}
      )
      ON CONFLICT (round_id) DO UPDATE SET
        remaining_pool_wei = EXCLUDED.remaining_pool_wei,
        pool_wei = EXCLUDED.pool_wei,
        tx_hash = EXCLUDED.tx_hash;
    `;

    await sql`
      INSERT INTO audit_logs (action, actor, details)
      VALUES (
        'ROUND_CREATED',
        ${req.user?.email || "anonymous"},
        ${JSON.stringify({ roundId, txHash, poolDepositWei })}
      );
    `;

    res.json({ success: true, txHash, round });
  } catch (err) {
    console.error("[Create Round Error]:", err);
    res.status(500).json({ error: err.message || "Failed to create round" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Grant Claims & Consensus Adjudication Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get(["/api/claims", "/claims"], async (req, res) => {
  try {
    const { roundId, verdict, status, limit = 50, offset = 0 } = req.query;

    let query = sql`SELECT * FROM claims WHERE 1=1`;

    if (roundId) {
      query = sql`${query} AND round_id = ${roundId}`;
    }
    if (verdict) {
      query = sql`${query} AND verdict = ${verdict}`;
    }
    if (status) {
      query = sql`${query} AND status = ${status}`;
    }

    const claims = await sql`
      ${query} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    res.json(claims);
  } catch (err) {
    console.error("[Get Claims Error]:", err);
    res.status(500).json({ error: "Failed to list claims" });
  }
});

app.get(["/api/claims/:id", "/claims/:id"], async (req, res) => {
  try {
    const claimId = req.params.id;
    const dbClaim = await sql`SELECT * FROM claims WHERE claim_id = ${claimId} LIMIT 1`;

    if (dbClaim.length) {
      return res.json(dbClaim[0]);
    }

    // Try reading on-chain
    const onChain = await readClaimOnChain(claimId);
    if (!onChain) {
      return res.status(404).json({ error: "Claim not found" });
    }

    res.json(onChain);
  } catch (err) {
    console.error("[Get Claim Error]:", err);
    res.status(500).json({ error: "Failed to fetch claim" });
  }
});

/**
 * Submit Grant Claim (Abstracted Transaction)
 * Posts the required bond and runs two-tier consensus adjudication on GenLayer.
 */
app.post(["/api/claims/submit", "/claims/submit"], optionalAuth, async (req, res) => {
  try {
    const {
      claimId,
      roundId,
      prUrl,
      activityUrl,
      screenshotUrl = "",
      notes = "",
      claimantEmail,
    } = req.body;

    const email = claimantEmail || req.user?.email || "claimant@themis.grant";

    if (!claimId || !roundId || !prUrl || !activityUrl) {
      return res.status(400).json({ error: "Missing required claim parameters" });
    }

    console.log(`[Claim Submit] Processing claim ${claimId} by ${email}`);

    // Call on-chain abstracted relayer
    const { txHash, claim } = await submitClaimAbstracted({
      claimId,
      roundId,
      prUrl,
      activityUrl,
      screenshotUrl,
      notes,
    });

    // Mirror to Neon DB
    const finalityDate = claim.finality_expires_at
      ? new Date(claim.finality_expires_at * 1000)
      : new Date(Date.now() + 3600 * 1000);

    const inserted = await sql`
      INSERT INTO claims (
        claim_id, round_id, claimant, claimant_email,
        pr_url, activity_url, screenshot_url, notes,
        bond_wei, grant_wei,
        tier1_pr_merged, tier2_sybil_score, tier2_sybil_tier,
        fraud_detected, verdict, verdict_reasoning,
        status, finality_expires_at, tx_hash
      ) VALUES (
        ${claimId},
        ${roundId},
        ${claim.claimant || getDeployerAddress()},
        ${email},
        ${prUrl},
        ${activityUrl},
        ${screenshotUrl || null},
        ${notes || ""},
        ${claim.bond_wei || "0"},
        ${claim.grant_wei || "0"},
        ${Boolean(claim.tier1_pr_merged)},
        ${Number(claim.tier2_sybil_score || 0)},
        ${claim.tier2_sybil_tier || "ORGANIC"},
        ${Boolean(claim.fraud_detected)},
        ${claim.verdict || "ADJUDICATED"},
        ${claim.verdict_reasoning || ""},
        'ADJUDICATED',
        ${finalityDate},
        ${txHash}
      )
      ON CONFLICT (claim_id) DO UPDATE SET
        tier1_pr_merged = EXCLUDED.tier1_pr_merged,
        tier2_sybil_score = EXCLUDED.tier2_sybil_score,
        tier2_sybil_tier = EXCLUDED.tier2_sybil_tier,
        fraud_detected = EXCLUDED.fraud_detected,
        verdict = EXCLUDED.verdict,
        verdict_reasoning = EXCLUDED.verdict_reasoning,
        status = EXCLUDED.status,
        tx_hash = EXCLUDED.tx_hash
      RETURNING *;
    `;

    // Audit log
    await sql`
      INSERT INTO audit_logs (action, actor, details)
      VALUES (
        'CLAIM_ADJUDICATED',
        ${email},
        ${JSON.stringify({
          claimId,
          roundId,
          verdict: claim.verdict,
          tier1_pr_merged: claim.tier1_pr_merged,
          tier2_sybil_score: claim.tier2_sybil_score,
          txHash,
        })}
      );
    `;

    res.json({
      success: true,
      txHash,
      claim: inserted[0] || claim,
    });
  } catch (err) {
    console.error("[Claim Submission Error]:", err);
    res.status(500).json({ error: err.message || "Failed to submit and adjudicate claim" });
  }
});

/**
 * Execute Settlement (Abstracted Transaction)
 * Transfers grant + bond refund to claimant or slashes bond if fraud detected.
 */
app.post(["/api/claims/:id/settle", "/claims/:id/settle"], optionalAuth, async (req, res) => {
  try {
    const claimId = req.params.id;
    console.log(`[Claim Settle] Executing settlement for ${claimId}`);

    const { txHash, claim } = await settleClaimAbstracted(claimId);

    // Update DB record
    await sql`
      UPDATE claims
      SET
        status = ${claim.status || "SETTLED"},
        settled_at = NOW()
      WHERE claim_id = ${claimId};
    `;

    await sql`
      INSERT INTO audit_logs (action, actor, details)
      VALUES (
        'CLAIM_SETTLED',
        ${req.user?.email || "relayer"},
        ${JSON.stringify({ claimId, txHash, status: claim.status })}
      );
    `;

    res.json({ success: true, txHash, claim });
  } catch (err) {
    console.error("[Settle Claim Error]:", err);
    res.status(500).json({ error: err.message || "Failed to settle claim" });
  }
});

/**
 * Register Appeal (Abstracted Transaction)
 */
app.post(["/api/claims/:id/appeal", "/claims/:id/appeal"], optionalAuth, async (req, res) => {
  try {
    const claimId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: "Appeal reason must be at least 10 characters" });
    }

    const email = req.user?.email || "appellant@themis.grant";
    const { txHash, claim } = await appealClaimAbstracted(claimId, reason);

    // Update DB
    await sql`
      UPDATE claims
      SET
        is_appealed = TRUE,
        appeal_reason = ${reason},
        status = 'APPEALED'
      WHERE claim_id = ${claimId};
    `;

    await sql`
      INSERT INTO appeals (appeal_id, claim_id, appellant, reason, tx_hash)
      VALUES (
        ${`appeal-${Date.now()}`},
        ${claimId},
        ${email},
        ${reason},
        ${txHash}
      );
    `;

    res.json({ success: true, txHash, claim });
  } catch (err) {
    console.error("[Appeal Claim Error]:", err);
    res.status(500).json({ error: err.message || "Failed to submit appeal" });
  }
});

// Serve frontend dist static files in production
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../../frontend/dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

