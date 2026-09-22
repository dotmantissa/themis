import assert from "node:assert";

const BASE_URL = process.env.API_URL || "http://localhost:3001";

async function testBackend() {
  console.log("=========================================");
  console.log("Testing Themis Backend API Endpoints");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("=========================================");

  // 1. Health check
  console.log("1. GET /api/health");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(healthRes.status, 200, "Health endpoint should return 200");
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, "ok");
  assert.strictEqual(healthData.database, "connected");
  assert.ok(healthData.contract.startsWith("0x"), "Contract address should be valid hex");
  console.log("   Health verified:", healthData.database, healthData.contract);

  // 2. Config check
  console.log("2. GET /api/config");
  const configRes = await fetch(`${BASE_URL}/api/config`);
  assert.strictEqual(configRes.status, 200);
  const configData = await configRes.json();
  assert.strictEqual(configData.chainId, 61999);
  assert.ok(configData.privyAppId, "Privy App ID should be present");
  console.log("   Config verified. Chain ID:", configData.chainId);

  // 3. Metrics check
  console.log("3. GET /api/metrics");
  const metricsRes = await fetch(`${BASE_URL}/api/metrics`);
  assert.strictEqual(metricsRes.status, 200);
  const metricsData = await metricsRes.json();
  assert.ok(metricsData.onChain.total_rounds >= 1, "At least 1 round should be registered on-chain");
  console.log("   On-Chain rounds:", metricsData.onChain.total_rounds);

  // 4. Rounds check
  console.log("4. GET /api/rounds");
  const roundsRes = await fetch(`${BASE_URL}/api/rounds`);
  assert.strictEqual(roundsRes.status, 200);
  const rounds = await roundsRes.json();
  assert.ok(Array.isArray(rounds), "Rounds should be an array");
  assert.ok(rounds.length >= 1, "Should have at least 1 round");
  const genesis = rounds.find((r) => r.round_id === "themis-genesis-grant");
  assert.ok(genesis, "Genesis round should be present");
  console.log("   Genesis round verified:", genesis.title);

  // 5. Round detail check
  console.log("5. GET /api/rounds/themis-genesis-grant");
  const roundDetailRes = await fetch(`${BASE_URL}/api/rounds/themis-genesis-grant`);
  assert.strictEqual(roundDetailRes.status, 200);
  const roundDetail = await roundDetailRes.json();
  assert.ok(roundDetail.round, "Round object should exist");
  assert.ok(Array.isArray(roundDetail.claims), "Claims should be an array");
  console.log("   Round detail verified. Associated claims:", roundDetail.claims.length);

  // 6. Auth sync check (Email-Only)
  console.log("6. POST /api/auth/sync (Email-Only Identity)");
  const syncEmail = "evaluator@themis.grant";
  const authRes = await fetch(`${BASE_URL}/api/auth/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: syncEmail,
      privyDid: "did:privy:cmucf5bf7034l0cl2v3l0do5j-evaluator",
      walletAddress: "0x111122223333444455556666777788889999aaaa",
    }),
  });
  assert.strictEqual(authRes.status, 200);
  const authData = await authRes.json();
  assert.strictEqual(authData.success, true);
  assert.strictEqual(authData.user.email, syncEmail);
  console.log("   User email auth synced:", authData.user.email);

  // 7. Get user profile
  console.log(`7. GET /api/users/${syncEmail}`);
  const userRes = await fetch(`${BASE_URL}/api/users/${syncEmail}`);
  assert.strictEqual(userRes.status, 200);
  const userData = await userRes.json();
  assert.strictEqual(userData.user.email, syncEmail);
  console.log("   User profile verified.");

  console.log("=========================================");
  console.log("All Backend API Integration Tests Passed!");
  console.log("=========================================");
}

testBackend().catch((err) => {
  console.error("Backend test failed:", err);
  process.exit(1);
});
