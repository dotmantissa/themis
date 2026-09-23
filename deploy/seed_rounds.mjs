import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { Agent, setGlobalDispatcher, interceptors } from "undici";
setGlobalDispatcher(new Agent({ connect: { family: 4 } }).compose(interceptors.decompress()));

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env"), quiet: true });

const deployedInfo = JSON.parse(
  await readFile(resolve(root, "deploy/deployed_contract.json"), "utf8")
);

const rawPrivateKey = process.env.DEPLOYER_KEY?.trim();
if (!rawPrivateKey) {
  throw new Error("DEPLOYER_KEY environment variable is required to seed rounds");
}
const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;

const account = createAccount(privateKey);
const client = createClient({
  chain: studionet,
  account,
  endpoint: process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api",
});

async function main() {
  console.log("Seeding genesis round into Themis contract:", deployedInfo.contractAddress);
  const roundId = "themis-genesis-grant";
  const title = "Autonomous AI and Protocol Tooling Grant Round";
  const description =
    "DAO grant round supporting open source GenLayer primitives, sybil-resistant tooling, and autonomous agent systems.";
  const grantAmountWei = 100000000000000000n; // 0.1 GEN per winner
  const bondAmountWei = 10000000000000000n;   // 0.01 GEN bond
  const poolDepositWei = 500000000000000000n; // 0.5 GEN (enough for 5 winners)
  const finalitySeconds = 300;                 // 5 minutes finality window
  const durationSeconds = 604800;              // 7 days
  const rewardRecipientsCount = 5;             // Top 5 winners share the pool
  const targetRepo = "dotmantissa/themis";     // Verified grant repository

  const txHash = await client.writeContract({
    address: deployedInfo.contractAddress,
    functionName: "create_round",
    args: [
      roundId,
      title,
      description,
      grantAmountWei,
      bondAmountWei,
      finalitySeconds,
      durationSeconds,
      rewardRecipientsCount,
      targetRepo,
    ],
    value: poolDepositWei,
  });

  console.log("Create round tx submitted:", txHash);
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.ACCEPTED,
    interval: 3000,
    retries: 120,
    fullTransaction: true,
  });

  console.log("Genesis round created on-chain! Tx accepted:", receipt.hash);

  const roundData = await client.readContract({
    address: deployedInfo.contractAddress,
    functionName: "get_round",
    args: [roundId],
  });
  console.log("Live Round Data on-chain:", roundData);
}

main().catch(console.error);
