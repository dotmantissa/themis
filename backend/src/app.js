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
  finalizeRoundAbstracted,
  settleClaimAbstracted,
  appealClaimAbstracted,
  dripNativeGen,
  getWalletBalance,
  isEvidenceUsedOnChain,
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
    const existing = await sql`SELECT * FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    let drippedInfo = null;

    const targetWallet = walletAddress || existing[0]?.wallet_address;
    if (targetWallet && targetWallet.startsWith("0x")) {
      const alreadyDripped = Boolean(existing[0]?.dripped_at);
      if (!alreadyDripped) {
        try {
          console.log(`[Onboarding Faucet] Dripping 10 GEN to new account ${cleanEmail} (${targetWallet})`);
          drippedInfo = await dripNativeGen(targetWallet, "10");
        } catch (dripErr) {
          console.error("[Onboarding Faucet Error]:", dripErr.message);
        }
      }
    }

    const result = await sql`
      INSERT INTO users (
        email, privy_did, wallet_address,
        dripped_at, dripped_tx_hash, dripped_amount_wei,
        last_login
      )
      VALUES (
        ${cleanEmail},
        ${privyDid || null},
        ${targetWallet || null},
        ${drippedInfo ? sql`NOW()` : (existing[0]?.dripped_at || null)},
        ${drippedInfo?.txHash || existing[0]?.dripped_tx_hash || null},
        ${drippedInfo?.amountWei || existing[0]?.dripped_amount_wei || null},
        NOW()
      )
      ON CONFLICT (email)
      DO UPDATE SET
        privy_did = COALESCE(EXCLUDED.privy_did, users.privy_did),
        wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address),
        dripped_at = COALESCE(users.dripped_at, EXCLUDED.dripped_at),
        dripped_tx_hash = COALESCE(users.dripped_tx_hash, EXCLUDED.dripped_tx_hash),
        dripped_amount_wei = COALESCE(users.dripped_amount_wei, EXCLUDED.dripped_amount_wei),
        last_login = NOW()
      RETURNING *;
    `;

    // Fetch live balance
    let balance = { balanceWei: "0", balanceGen: "0" };
    if (targetWallet) {
      balance = await getWalletBalance(targetWallet);
    }

    res.json({
      success: true,
      user: result[0],
      dripped: drippedInfo,
      balance,
    });
  } catch (err) {
    console.error("[Auth Sync Error]:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

app.post(["/api/faucet/drip", "/faucet/drip"], async (req, res) => {
  try {
    const { walletAddress, email } = req.body;
    if (!walletAddress || !walletAddress.startsWith("0x")) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    const dripResult = await dripNativeGen(walletAddress, "10");
    if (email) {
      await sql`
        UPDATE users
        SET
          dripped_at = NOW(),
          dripped_tx_hash = ${dripResult.txHash},
          dripped_amount_wei = ${dripResult.amountWei},
          wallet_address = ${walletAddress}
        WHERE email = ${email.trim().toLowerCase()}
      `;
    }

    const balance = await getWalletBalance(walletAddress);
    res.json({ success: true, drip: dripResult, balance });
  } catch (err) {
    console.error("[Faucet Drip Error]:", err);
    res.status(500).json({ error: err.message || "Failed to drip GEN" });
  }
});

app.get(["/api/faucet/balance/:address", "/faucet/balance/:address"], async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await getWalletBalance(address);
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: "Failed to get balance" });
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
          const expiresAtVal = onChainData.expires_at ? new Date(Number(onChainData.expires_at) * 1000) : null;
          await sql`
            INSERT INTO rounds (
              round_id, creator, title, description, target_repo,
              pool_wei, remaining_pool_wei, grant_amount_wei, bond_amount_wei,
              finality_window_seconds, duration_seconds, reward_recipients_count, expires_at, status, created_at
            ) VALUES (
              ${rid},
              ${onChainData.creator || "0x0"},
              ${onChainData.title || "Grant Round"},
              ${onChainData.description || ""},
              ${onChainData.target_repo || ""},
              ${onChainData.pool_wei || "0"},
              ${onChainData.remaining_pool_wei || "0"},
              ${onChainData.reward_amount_per_recipient_wei || onChainData.grant_amount_per_claim_wei || "0"},
              ${onChainData.required_bond_wei || "0"},
              ${Number(onChainData.finality_window_seconds || 3600)},
              ${Number(onChainData.duration_seconds || 604800)},
              ${Number(onChainData.reward_recipients_count || onChainData.max_winners || 1)},
              ${expiresAtVal},
              ${onChainData.status || "OPEN"},
              to_timestamp(${Number(onChainData.created_at || Math.floor(Date.now() / 1000))})
            )
            ON CONFLICT (round_id) DO NOTHING;
          `;
        }
      }
    }

    // Return fresh refreshed rounds with dynamic status evaluation
    const refreshedRounds = await sql`SELECT * FROM rounds ORDER BY created_at DESC`;
    const nowMs = Date.now();
    const evaluatedRounds = refreshedRounds.map((r) => {
      let status = r.status || "OPEN";
      const expiresAtMs = r.expires_at ? new Date(r.expires_at).getTime() : null;
      if (status !== "SETTLED") {
        if (expiresAtMs && nowMs >= expiresAtMs) {
          status = "EXPIRED";
        }
      }
      return { ...r, status };
    });

    res.json(evaluatedRounds);
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
          grant_amount_wei: onChain.reward_amount_per_recipient_wei || onChain.grant_amount_per_claim_wei,
          bond_amount_wei: onChain.required_bond_wei,
          finality_window_seconds: onChain.finality_window_seconds,
          duration_seconds: onChain.duration_seconds,
          reward_recipients_count: onChain.reward_recipients_count || onChain.max_winners || 1,
          expires_at: onChain.expires_at ? new Date(Number(onChain.expires_at) * 1000).toISOString() : null,
          status: onChain.status,
        };
      }
    }

    if (!round) {
      return res.status(404).json({ error: "Round not found" });
    }

    // Dynamic status evaluation
    const nowMs = Date.now();
    const expiresAtMs = round.expires_at ? new Date(round.expires_at).getTime() : null;
    if (round.status !== "SETTLED") {
      if (expiresAtMs && nowMs >= expiresAtMs) {
        round.status = "EXPIRED";
      }
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

app.post(["/api/rounds/:id/finalize", "/rounds/:id/finalize"], optionalAuth, async (req, res) => {
  try {
    const roundId = req.params.id;
    console.log(`[Round Finalize] Finalizing rewards for round ${roundId}`);

    const { txHash, round, claims } = await finalizeRoundAbstracted(roundId);

    // Update round in DB
    await sql`
      UPDATE rounds
      SET
        status = 'SETTLED',
        remaining_pool_wei = ${round?.remaining_pool_wei || "0"}
      WHERE round_id = ${roundId};
    `;

    // Sync updated claims in DB
    if (Array.isArray(claims)) {
      for (const c of claims) {
        await sql`
          UPDATE claims
          SET
            status = ${c.status || "SETTLED"},
            verdict = ${c.verdict || "APPROVED"},
            rank = ${Number(c.rank || 0)},
            reward_payout_wei = ${c.reward_payout_wei || "0"},
            settled_at = NOW()
          WHERE claim_id = ${c.claim_id};
        `;
      }
    }

    await sql`
      INSERT INTO audit_logs (action, actor, details)
      VALUES (
        'ROUND_FINALIZED',
        ${req.user?.email || "relayer"},
        ${JSON.stringify({ roundId, txHash })}
      );
    `;

    res.json({ success: true, txHash, round, claims });
  } catch (err) {
    console.error("[Round Finalize Error]:", err);
    res.status(500).json({ error: err.message || "Failed to finalize round payouts" });
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
      durationSeconds = 604800,
      rewardRecipientsCount = 1,
      targetRepo = "",
      target_repo = "",
    } = req.body;

    const assignedTargetRepo = (targetRepo || target_repo || "").trim();

    if (!roundId || !title || !grantAmountWei || !bondAmountWei || !poolDepositWei) {
      return res.status(400).json({ error: "Missing required round parameters" });
    }

    const durationSec = Number(durationSeconds) || 604800;
    const recipientsCount = Math.max(1, Number(rewardRecipientsCount) || 1);
    const expiresAt = new Date(Date.now() + durationSec * 1000);

    // Submit abstracted transaction on GenLayer
    const { txHash, round } = await createRoundAbstracted({
      roundId,
      title,
      description: description || "",
      grantAmountWei,
      bondAmountWei,
      poolDepositWei,
      finalitySeconds,
      durationSeconds: durationSec,
      rewardRecipientsCount: recipientsCount,
      targetRepo: assignedTargetRepo,
    });

    // Record in Neon DB
    await sql`
      INSERT INTO rounds (
        round_id, creator, title, description, target_repo,
        pool_wei, remaining_pool_wei, grant_amount_wei, bond_amount_wei,
        finality_window_seconds, duration_seconds, reward_recipients_count, expires_at, status, tx_hash
      ) VALUES (
        ${roundId},
        ${round?.creator || getDeployerAddress()},
        ${title},
        ${description || ""},
        ${assignedTargetRepo || round?.target_repo || ""},
        ${String(poolDepositWei)},
        ${String(poolDepositWei)},
        ${String(grantAmountWei)},
        ${String(bondAmountWei)},
        ${Number(finalitySeconds)},
        ${durationSec},
        ${recipientsCount},
        ${expiresAt},
        'OPEN',
        ${txHash}
      )
      ON CONFLICT (round_id) DO UPDATE SET
        target_repo = COALESCE(EXCLUDED.target_repo, rounds.target_repo),
        remaining_pool_wei = EXCLUDED.remaining_pool_wei,
        pool_wei = EXCLUDED.pool_wei,
        duration_seconds = EXCLUDED.duration_seconds,
        reward_recipients_count = EXCLUDED.reward_recipients_count,
        expires_at = EXCLUDED.expires_at,
        tx_hash = EXCLUDED.tx_hash;
    `;

    await sql`
      INSERT INTO audit_logs (action, actor, details)
      VALUES (
        'ROUND_CREATED',
        ${req.user?.email || "anonymous"},
        ${JSON.stringify({ roundId, txHash, poolDepositWei, durationSeconds: durationSec })}
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

/**
 * Evidence Deduplication Pre-flight Check
 */
app.get(["/api/claims/check-evidence", "/claims/check-evidence"], async (req, res) => {
  try {
    const { prUrl } = req.query;
    if (!prUrl) return res.status(400).json({ error: "prUrl parameter is required" });
    const result = await isEvidenceUsedOnChain(prUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to check evidence" });
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
      claimantAddress,
      builderGithub,
      screenshotUrl = "",
      notes = "",
      claimantEmail,
    } = req.body;

    const email = claimantEmail || req.user?.email || "claimant@themis.grant";

    if (!claimId || !roundId || !prUrl || !activityUrl) {
      return res.status(400).json({ error: "Missing required claim parameters" });
    }

    // Determine claimantAddress for User-Bound Custody
    let targetClaimant = claimantAddress || req.user?.wallet_address || req.body.walletAddress;
    if (!targetClaimant && email) {
      const u = await sql`SELECT wallet_address FROM users WHERE email = ${email.trim().toLowerCase()} LIMIT 1`;
      if (u[0]?.wallet_address) {
        targetClaimant = u[0].wallet_address;
      }
    }

    if (!targetClaimant || !targetClaimant.startsWith("0x")) {
      return res.status(400).json({
        error: "claimantAddress (builder wallet) is required to enforce user-bound custody",
      });
    }

    console.log(`[Claim Submit] Processing claim ${claimId} by ${email} bound to custody address ${targetClaimant}`);

    // Pre-flight check 1: Verify round expiry before submitting
    let targetRepo = null;
    let expiresAtMs = null;
    const roundCheck = await sql`SELECT * FROM rounds WHERE round_id = ${roundId} LIMIT 1`;
    if (roundCheck.length) {
      expiresAtMs = roundCheck[0].expires_at ? new Date(roundCheck[0].expires_at).getTime() : null;
      targetRepo = roundCheck[0].target_repo;
    }
    // Also consult on-chain round if targetRepo is not in DB yet
    if (!targetRepo) {
      const onChainRound = await readRoundOnChain(roundId);
      if (onChainRound) {
        targetRepo = onChainRound.target_repo;
        if (!expiresAtMs && onChainRound.expires_at) {
          expiresAtMs = Number(onChainRound.expires_at) * 1000;
        }
        if (targetRepo) {
          await sql`UPDATE rounds SET target_repo = ${targetRepo} WHERE round_id = ${roundId}`;
        }
      }
    }

    if (expiresAtMs && Date.now() >= expiresAtMs) {
      return res.status(400).json({ error: "Grant round timeline has elapsed; applications are closed" });
    }

    // Pre-flight check 2: Grant repository binding
    if (targetRepo) {
      const expectedRepo = targetRepo.trim().toLowerCase();
      const m = prUrl.match(/(?:github\.com\/|api\.github\.com\/repos\/)([^/]+\/[^/#?]+)/i);
      const prRepo = m ? m[1].toLowerCase().replace(/\.git$/, "") : "";
      if (prRepo && prRepo !== expectedRepo) {
        return res.status(400).json({
          error: `PR repository '${prRepo}' does not match grant repository '${expectedRepo}'`,
        });
      }
    }

    // Pre-flight check 3: Reusable evidence check
    const evidenceStatus = await isEvidenceUsedOnChain(prUrl);
    if (evidenceStatus?.is_used) {
      return res.status(400).json({
        error: `Evidence already used: Pull request has already been claimed on-chain in claim ${evidenceStatus.claim_id}`,
      });
    }

    // Call on-chain abstracted relayer with user-bound custody
    const { txHash, claim } = await submitClaimAbstracted({
      claimId,
      roundId,
      prUrl,
      activityUrl,
      claimantAddress: targetClaimant,
      builderGithub: builderGithub || "",
      screenshotUrl,
      notes,
    });

    if (!claim) {
      return res.status(400).json({
        error: "Claim submission rejected or failed to read on-chain claim state",
      });
    }

    // Mirror to Neon DB
    const finalityDate = claim.finality_expires_at
      ? new Date(claim.finality_expires_at * 1000)
      : new Date(Date.now() + 3600 * 1000);

    const inserted = await sql`
      INSERT INTO claims (
        claim_id, round_id, claimant, claimant_email,
        builder_github, canonical_evidence, target_repo, pr_author, author_matched,
        pr_url, activity_url, screenshot_url, notes,
        bond_wei, grant_wei,
        tier1_pr_merged, tier2_sybil_score, tier2_sybil_tier,
        fraud_detected, strength_score, strength_assessment,
        rank, reward_payout_wei, verdict, verdict_reasoning,
        status, finality_expires_at, tx_hash
      ) VALUES (
        ${claimId},
        ${roundId},
        ${claim.claimant || targetClaimant},
        ${email},
        ${claim.builder_github || builderGithub || ""},
        ${claim.canonical_evidence || null},
        ${claim.target_repo || null},
        ${claim.pr_author || null},
        ${claim.author_matched !== undefined ? Boolean(claim.author_matched) : true},
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
        ${Number(claim.strength_score || 0)},
        ${claim.strength_assessment || ""},
        ${Number(claim.rank || 0)},
        ${claim.reward_payout_wei || "0"},
        ${claim.verdict || "ADJUDICATED"},
        ${claim.verdict_reasoning || ""},
        'ADJUDICATED',
        ${finalityDate},
        ${txHash}
      )
      ON CONFLICT (claim_id) DO UPDATE SET
        claimant = EXCLUDED.claimant,
        builder_github = EXCLUDED.builder_github,
        canonical_evidence = EXCLUDED.canonical_evidence,
        target_repo = EXCLUDED.target_repo,
        pr_author = EXCLUDED.pr_author,
        author_matched = EXCLUDED.author_matched,
        tier1_pr_merged = EXCLUDED.tier1_pr_merged,
        tier2_sybil_score = EXCLUDED.tier2_sybil_score,
        tier2_sybil_tier = EXCLUDED.tier2_sybil_tier,
        fraud_detected = EXCLUDED.fraud_detected,
        strength_score = EXCLUDED.strength_score,
        strength_assessment = EXCLUDED.strength_assessment,
        rank = EXCLUDED.rank,
        reward_payout_wei = EXCLUDED.reward_payout_wei,
        verdict = EXCLUDED.verdict,
        verdict_reasoning = EXCLUDED.verdict_reasoning,
        status = EXCLUDED.status,
        finality_expires_at = EXCLUDED.finality_expires_at,
        tx_hash = EXCLUDED.tx_hash
      RETURNING *;
    `;

    // Audit log
    await sql`
      INSERT INTO audit_logs (action, actor, details)
      VALUES (
        'CLAIM_SUBMITTED',
        ${email},
        ${JSON.stringify({
          claimId,
          roundId,
          verdict: claim.verdict,
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

app.post(["/api/claims/:id/settle", "/claims/:id/settle"], optionalAuth, async (req, res) => {
  try {
    const claimId = req.params.id;
    console.log(`[Claim Settle] Executing settlement for ${claimId}`);

    // Pre-flight check: Prevent appealed or non-final claims from being settled
    const existing = await readClaimOnChain(claimId);
    if (existing) {
      if (existing.is_appealed || existing.status === "APPEALED") {
        return res.status(400).json({
          error: "Claim has an active appeal in progress and cannot be settled",
        });
      }

      const nowTs = Math.floor(Date.now() / 1000);
      const finalityExp = Number(existing.finality_expires_at || 0);
      if (nowTs < finalityExp) {
        return res.status(400).json({
          error: `Claim appeal window is still active (${finalityExp - nowTs}s remaining); non-final claims cannot be settled`,
        });
      }
    }

    const { txHash, claim } = await settleClaimAbstracted(claimId);

    // Update DB record
    await sql`
      UPDATE claims
      SET
        status = ${claim.status || "SETTLED"},
        settled_at = NOW()
      WHERE claim_id = ${claimId};
    `;

    // Sync round pool and status if available
    if (claim.round_id) {
      const onChainRound = await readRoundOnChain(claim.round_id);
      if (onChainRound) {
        await sql`
          UPDATE rounds
          SET
            remaining_pool_wei = ${onChainRound.remaining_pool_wei || "0"},
            status = ${onChainRound.status || "OPEN"}
          WHERE round_id = ${claim.round_id};
        `;
      }
    }

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

