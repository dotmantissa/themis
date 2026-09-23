import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { Agent, setGlobalDispatcher, interceptors } from "undici";
setGlobalDispatcher(new Agent({ connect: { family: 4 } }).compose(interceptors.decompress()));

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, chains } from "genlayer-js";
import { ethers } from "ethers";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(root, ".env") });

let deployedInfo = null;
try {
  const raw = await readFile(resolve(root, "deploy/deployed_contract.json"), "utf8");
  deployedInfo = JSON.parse(raw);
} catch (err) {
  console.warn("[Themis On-Chain] deployed_contract.json not found yet:", err.message);
}

const contractAddress =
  process.env.CONTRACT_ADDRESS ||
  deployedInfo?.contractAddress ||
  "0x016A4143cACEc8Ce4Ac0DD241260D5426C0eeE39";

// Load signer key strictly from environment variables without hardcoded fallbacks
const rawPrivateKey = process.env.DEPLOYER_KEY?.trim();
if (!rawPrivateKey) {
  console.warn("[Themis On-Chain] Warning: DEPLOYER_KEY environment variable is not configured. Read-only mode active.");
}

const privateKey = rawPrivateKey
  ? (rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`)
  : null;

const wallet = privateKey ? new ethers.Wallet(privateKey) : null;
export const DEPLOYER_ADDRESS = wallet
  ? wallet.address
  : "0x0000000000000000000000000000000000000000";

const RPC_URL = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";

export async function rpcCall(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "identity",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return data.result;
}

const customProvider = {
  async request({ method, params = [] }) {
    if (method === "eth_sendTransaction") {
      if (!wallet) {
        throw new Error("DEPLOYER_KEY is not configured in environment; cannot sign transactions");
      }
      const tx = params[0];
      const nonce = await rpcCall("eth_getTransactionCount", [
        DEPLOYER_ADDRESS,
        "latest",
      ]);
      const chainId = await rpcCall("eth_chainId", []);
      const signed = await wallet.signTransaction({
        to: tx.to ?? null,
        data: tx.data,
        value: tx.value ?? "0x0",
        gas: tx.gas ?? "0x4C4B40",
        gasPrice: tx.gasPrice ?? "0x0",
        nonce,
        chainId: parseInt(chainId, 16),
      });
      return rpcCall("eth_sendRawTransaction", [signed]);
    }
    if (method === "eth_estimateGas") return "0x4C4B40";
    return rpcCall(method, params);
  },
};

export const glClient = createClient({
  chain: chains.studionet,
  endpoint: RPC_URL,
  account: DEPLOYER_ADDRESS,
  provider: customProvider,
});

export function getContractAddress() {
  return contractAddress;
}

export function getDeployerAddress() {
  return DEPLOYER_ADDRESS;
}

/**
 * Read protocol metrics directly from GenLayer intelligent contract
 */
export async function readMetricsOnChain() {
  try {
    const raw = await glClient.readContract({
      address: contractAddress,
      functionName: "get_escrow_metrics",
      args: [],
    });
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("[Themis On-Chain] Failed to read metrics:", err.message);
    return null;
  }
}

/**
 * Read round info on-chain
 */
export async function readRoundOnChain(roundId) {
  try {
    const raw = await glClient.readContract({
      address: contractAddress,
      functionName: "get_round",
      args: [String(roundId).trim()],
    });
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error(`[Themis On-Chain] Failed to read round ${roundId}:`, err.message);
    return null;
  }
}

/**
 * Read claim on-chain
 */
export async function readClaimOnChain(claimId) {
  try {
    const raw = await glClient.readContract({
      address: contractAddress,
      functionName: "get_claim",
      args: [String(claimId).trim()],
    });
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error(`[Themis On-Chain] Failed to read claim ${claimId}:`, err.message);
    return null;
  }
}

/**
 * Read all round IDs on-chain
 */
export async function readAllRoundIdsOnChain() {
  try {
    const raw = await glClient.readContract({
      address: contractAddress,
      functionName: "get_all_round_ids",
      args: [],
    });
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        const matches = raw.match(/['"]([^'"]+)['"]/g);
        if (matches) return matches.map((m) => m.replace(/['"]/g, ""));
      }
    }
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.error("[Themis On-Chain] Failed to read round IDs:", err.message);
    return [];
  }
}

/**
 * Read claims by round on-chain
 */
export async function readClaimsByRoundOnChain(roundId) {
  try {
    const raw = await glClient.readContract({
      address: contractAddress,
      functionName: "get_claims_by_round",
      args: [String(roundId).trim()],
    });
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error(`[Themis On-Chain] Failed to read claims for round ${roundId}:`, err.message);
    return [];
  }
}

/**
 * Check whether a PR or contribution evidence is already used on-chain
 */
export async function isEvidenceUsedOnChain(prUrl) {
  try {
    const raw = await glClient.readContract({
      address: contractAddress,
      functionName: "is_evidence_used",
      args: [String(prUrl).trim()],
    });
    if (!raw) return { is_used: false };
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("[Themis On-Chain] Failed to check evidence used:", err.message);
    return { is_used: false };
  }
}

/**
 * Abstracted Grant Claim Submission with User-Bound Custody
 * Relayer sponsors transaction broadcast and bond posting, but smart contract
 * guarantees claimant identity and custody belongs strictly to claimantAddress.
 */
export async function submitClaimAbstracted({
  claimId,
  roundId,
  prUrl,
  activityUrl,
  claimantAddress,
  builderGithub = "",
  screenshotUrl = "",
  notes = "",
  bondWei = 10000000000000000n, // Default 0.01 GEN bond
}) {
  if (!wallet) {
    throw new Error("DEPLOYER_KEY environment variable is required to execute write transactions");
  }

  if (!claimantAddress || !ethers.isAddress(claimantAddress)) {
    throw new Error(`Invalid builder claimant address for user-bound custody: ${claimantAddress}`);
  }

  console.log(`[Themis Relayer] Submitting claim ${claimantAddress} -> claim ${claimId} in round ${roundId}...`);

  const round = await readRoundOnChain(roundId);
  if (!round) {
    throw new Error(`Round ${roundId} not found on-chain`);
  }

  const requiredBond = BigInt(round.required_bond_wei || bondWei);

  const txHash = await glClient.writeContract({
    address: contractAddress,
    functionName: "submit_grant_claim",
    args: [
      claimId,
      roundId,
      prUrl,
      activityUrl,
      claimantAddress,
      builderGithub,
      screenshotUrl,
      notes,
    ],
    value: requiredBond,
  });

  console.log(`[Themis Relayer] Claim tx submitted: ${txHash}, waiting for consensus...`);

  const receipt = await glClient.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    interval: 3000,
    retries: 120,
    fullTransaction: true,
  });

  console.log(`[Themis Relayer] Claim tx accepted on-chain: ${receipt.hash}`);

  const updatedClaim = await readClaimOnChain(claimId);

  return {
    txHash: receipt.hash,
    claim: updatedClaim,
  };
}

/**
 * Abstracted Round Creation with Target Grant Repository
 */
export async function createRoundAbstracted({
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
}) {
  if (!wallet) {
    throw new Error("DEPLOYER_KEY environment variable is required to execute write transactions");
  }

  console.log(`[Themis Relayer] Submitting abstracted round creation ${roundId} (repo: ${targetRepo})...`);

  const txHash = await glClient.writeContract({
    address: contractAddress,
    functionName: "create_round",
    args: [
      roundId,
      title,
      description,
      BigInt(grantAmountWei),
      BigInt(bondAmountWei),
      Number(finalitySeconds),
      Number(durationSeconds),
      Number(rewardRecipientsCount),
      targetRepo,
    ],
    value: BigInt(poolDepositWei),
  });

  const receipt = await glClient.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    interval: 3000,
    retries: 120,
    fullTransaction: true,
  });

  const createdRound = await readRoundOnChain(roundId);
  return {
    txHash: receipt.hash,
    round: createdRound,
  };
}

/**
 * Abstracted Round Payouts Finalization
 */
export async function finalizeRoundAbstracted(roundId) {
  if (!wallet) {
    throw new Error("DEPLOYER_KEY environment variable is required to execute write transactions");
  }

  console.log(`[Themis Relayer] Finalizing round payouts for ${roundId}...`);

  const txHash = await glClient.writeContract({
    address: contractAddress,
    functionName: "finalize_round_payouts",
    args: [String(roundId).trim()],
  });

  const receipt = await glClient.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    interval: 3000,
    retries: 120,
    fullTransaction: true,
  });

  const finalizedRound = await readRoundOnChain(roundId);
  const updatedClaims = await readClaimsByRoundOnChain(roundId);
  return {
    txHash: receipt.hash,
    round: finalizedRound,
    claims: updatedClaims,
  };
}

/**
 * Abstracted Claim Settlement
 */
export async function settleClaimAbstracted(claimId) {
  if (!wallet) {
    throw new Error("DEPLOYER_KEY environment variable is required to execute write transactions");
  }

  console.log(`[Themis Relayer] Executing abstracted settlement for claim ${claimId}...`);

  const txHash = await glClient.writeContract({
    address: contractAddress,
    functionName: "settle_claim",
    args: [claimId],
  });

  const receipt = await glClient.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    interval: 3000,
    retries: 120,
    fullTransaction: true,
  });

  const settledClaim = await readClaimOnChain(claimId);
  return {
    txHash: receipt.hash,
    claim: settledClaim,
  };
}

/**
 * Abstracted Appeal Registration
 */
export async function appealClaimAbstracted(claimId, reason) {
  if (!wallet) {
    throw new Error("DEPLOYER_KEY environment variable is required to execute write transactions");
  }

  console.log(`[Themis Relayer] Submitting appeal for claim ${claimId}...`);

  const txHash = await glClient.writeContract({
    address: contractAddress,
    functionName: "appeal_claim",
    args: [claimId, reason],
  });

  const receipt = await glClient.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    interval: 3000,
    retries: 120,
    fullTransaction: true,
  });

  const appealedClaim = await readClaimOnChain(claimId);
  return {
    txHash: receipt.hash,
    claim: appealedClaim,
  };
}

/**
 * Drip native GEN from deployer wallet to a user's embedded wallet
 */
export async function dripNativeGen(recipientAddress, amountGen = "10") {
  if (!wallet) {
    throw new Error("DEPLOYER_KEY environment variable is required to drip GEN");
  }

  if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`);
  }

  console.log(`[Themis Faucet] Dripping ${amountGen} GEN to embedded wallet ${recipientAddress}...`);

  const nonceHex = await rpcCall("eth_getTransactionCount", [
    DEPLOYER_ADDRESS,
    "latest",
  ]);
  const chainIdHex = await rpcCall("eth_chainId", []);
  const chainId = parseInt(chainIdHex, 16);

  const rawTx = await wallet.signTransaction({
    to: recipientAddress,
    value: ethers.parseEther(String(amountGen)),
    gasLimit: "0x4C4B40",
    gasPrice: "0x0",
    nonce: parseInt(nonceHex, 16),
    chainId,
  });

  const txHash = await rpcCall("eth_sendRawTransaction", [rawTx]);
  console.log(`[Themis Faucet] Drip broadcast with hash: ${txHash}`);

  return {
    txHash,
    recipient: recipientAddress,
    amountGen,
    amountWei: ethers.parseEther(String(amountGen)).toString(),
  };
}

/**
 * Get native GEN balance for any address
 */
export async function getWalletBalance(address) {
  if (!address || !ethers.isAddress(address)) {
    return { address, balanceWei: "0", balanceGen: "0" };
  }
  try {
    const raw = await rpcCall("eth_getBalance", [address, "latest"]);
    const balanceWei = BigInt(raw || "0").toString();
    const balanceGen = ethers.formatEther(balanceWei);
    return { address, balanceWei, balanceGen };
  } catch (err) {
    console.warn(`[Themis Balance] Failed to fetch balance for ${address}:`, err.message);
    return { address, balanceWei: "0", balanceGen: "0" };
  }
}
