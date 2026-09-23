import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { Agent, setGlobalDispatcher, interceptors } from "undici";
setGlobalDispatcher(new Agent({ connect: { family: 4 } }).compose(interceptors.decompress()));

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env"), quiet: true });

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function privateKey() {
  const raw = required("DEPLOYER_KEY");
  const value = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("DEPLOYER_KEY must be a 32-byte hex private key");
  }
  return value;
}

function contractAddress(receipt) {
  const candidates = [
    receipt.txDataDecoded?.contractAddress,
    receipt.contractAddress,
    receipt.recipient,
    receipt.to_address,
    receipt.to,
  ];
  const address = candidates.find(
    (value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
  );
  if (!address) {
    throw new Error("The deployment receipt did not include a contract address");
  }
  return address;
}

async function retry(label, operation, attempts = 15) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
      }
    }
  }
  throw new Error(`${label} failed: ${lastError?.message ?? lastError}`);
}

async function main() {
  console.log("=================================================");
  console.log("Deploying ThemisGrantEscrow to GenLayer Studio Network");
  console.log("RPC: https://studio.genlayer.com/api");
  console.log("Chain ID: 61999");
  console.log("=================================================");

  const codePath = resolve(root, "contracts", "themis_grant_escrow.py");
  const code = await readFile(codePath, "utf8");

  const account = createAccount(privateKey());
  const endpoint = process.env.GENLAYER_RPC_URL?.trim() || "https://studio.genlayer.com/api";
  const client = createClient({
    chain: studionet,
    account,
    endpoint,
  });

  const balance = await client.getBalance({ address: account.address });
  console.log(`Deployer address: ${account.address}`);
  console.log(`Deployer balance: ${balance.toString()} wei`);

  console.log("\nSubmitting ThemisGrantEscrow deployment transaction...");
  const deploymentTransaction = await client.deployContract({
    code,
    args: [3600], // 3600 seconds default finality window
  });
  console.log(`Deployment transaction hash: ${deploymentTransaction}`);

  console.log("Waiting for transaction receipt (ACCEPTED status)...");
  const receipt = await client.waitForTransactionReceipt({
    hash: deploymentTransaction,
    status: TransactionStatus.ACCEPTED,
    interval: 3_000,
    retries: 180,
    fullTransaction: true,
  });

  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error("Deployment execution finished with an error");
  }

  const address = contractAddress(receipt);
  console.log(`\n>>> ThemisGrantEscrow DEPLOYED AT: ${address}`);

  // Schema verification
  console.log("Verifying deployed contract schema...");
  const schema = await retry("Contract schema verification", () =>
    client.getContractSchema(address)
  );
  console.log("Contract methods found:", Object.keys(schema?.methods || {}));

  // Initial state check
  console.log("Verifying on-chain state read...");
  const metricsRaw = await retry("Initial state verification", () =>
    client.readContract({
      address,
      functionName: "get_escrow_metrics",
      args: [],
      jsonSafeReturn: true,
    })
  );
  console.log("On-chain metrics verified:", metricsRaw);

  const sourceSha256 = createHash("sha256").update(code).digest("hex");
  const deploymentData = {
    contractName: "ThemisGrantEscrow",
    contractAddress: address,
    deploymentTxHash: deploymentTransaction,
    deployerAddress: account.address,
    network: "studionet",
    chainId: 61999,
    rpcUrl: endpoint,
    explorerUrl: "https://genlayer-explorer.vercel.app",
    deployedAt: new Date().toISOString(),
    sourceSha256,
  };

  await mkdir(resolve(root, "deploy"), { recursive: true });
  await writeFile(
    resolve(root, "deploy/deployed_contract.json"),
    JSON.stringify(deploymentData, null, 2),
    "utf8"
  );
  console.log("Saved deployment metadata to deploy/deployed_contract.json");
  console.log("=================================================");
  console.log("ThemisGrantEscrow deployment completed successfully!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
