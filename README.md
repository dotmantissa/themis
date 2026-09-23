# Themis: Sybil Resistant Grant Escrow on GenLayer

Every grant program in crypto eventually runs into the same quiet heartbreak: a pool of capital meant for earnest builders gets vacuumed up by bot farms, automated PR spammers, and coordinated multi-wallet rings. The usual response is either heavy manual bureaucracy that grinds disbursements to a halt, or naive token voting that favors whoever owns the most capital.

**Themis** takes a fundamentally different path. Built as an Intelligent Contract on GenLayer, Themis blends deterministic financial escrow with optimistic AI consensus. Honest contributors submit verifiable git work, post a small refundable bond, and let independent AI validators inspect both code merges and behavioral graph topology. Genuine builders get paid directly from the custody vault; sybil fraudsters get their deposits slashed into a community dispute pool.

---

## Live Deployment on Vercel & GenLayer Studio

### Live Production Web Application
Themis is deployed and live on Vercel:
- **Primary Production URL**: [https://themis-escrow.vercel.app](https://themis-escrow.vercel.app)
- **Protocol Alias**: [https://themis-genlayer.vercel.app](https://themis-genlayer.vercel.app)
- **Grant Alias**: [https://themis-grant.vercel.app](https://themis-grant.vercel.app)

### On-Chain Contract on GenLayer
Themis Intelligent Contract is live on the GenLayer Studio Network:

- **Intelligent Contract Address**: `0xF09CA43446e0F7f5037883BD1D4522e515313A16`
- **Deployer / Relayer Address**: `0xBC1399c55538eC034d4Da550C03c34Ae0C357f53`
- **Network**: GenLayer Studio (`studionet`)
- **Chain ID**: `61999`
- **RPC URL**: `https://studio.genlayer.com/api`
- **Deployment Transaction**: `0x9f70d9002ccb09844cd5cc383c8d543f163f8670f7e6577d6f3fbdbb175bdf71`
- **Genesis Round Transaction**: `0x4e5dd5fa5fd8b4e70b79625c2fa5d0d81de80ba040f9abdd5d30f63e46af9cd2`
- **Genesis Round**: `themis-genesis-grant` ("Autonomous AI and Protocol Tooling Grant Round" bound to `dotmantissa/themis` and funded with real GEN)

---

## The 10 GenLayer Core Primitives in Themis

Themis implements all ten core GenLayer architectural capabilities inside production code:

### 1. Static PR Fetch (`gl.nondet.web.get`)
To verify whether a code pull request was legitimately merged into a target upstream repository, validators call `gl.nondet.web.get()` on GitHub API endpoints. Because git merge states are immutable and static, a raw HTTP GET retrieves the exact payload without the overhead of browser rendering.

### 2. Dynamic DOM Activity Render (`gl.nondet.web.render`)
Sybil rings disguise themselves behind throwaway accounts created hours before a grant deadline. To uncover genuine builder history, validators invoke `gl.nondet.web.render()` with JavaScript execution enabled. This renders dynamic contributor activity graphs, commit heatmaps, and transaction histories that plain GET requests cannot see.

### 3. Exact Match Boolean Equivalence (`gl.eq_principle.strict_eq`)
Tier 1 verification demands mathematical certainty: either a PR was merged by repository maintainers or it was not. Leader and validator nodes evaluate the boolean merge status using `strict_eq`, reaching instant deterministic consensus on code deliverables.

### 4. Independent Validator Rubric Consensus (`gl.eq_principle.prompt_non_comparative`)
Tier 2 sybil detection requires subjective forensic appraisal. Rather than letting validators peek at each other's outputs or compare intermediate thoughts, Themis applies `prompt_non_comparative`. Each validator independently examines activity graph topology against an explicit multi-point sybil rubric, ensuring true uncoordinated consensus.

### 5. Custom Equivalence Execution (`gl.vm.run_nondet_unsafe`)
To ensure total separation between non-deterministic data gathering and state updates, the contract executes leader and validator functions inside `gl.vm.run_nondet_unsafe`. Leaders extract forensic evidence and compute risk scores; validators independently execute verification without trusting leader state.

### 6. Native GEN Ghost Custody & User-Bound Routing (`emit_transfer`)
Themis does not hold funds in wrapped third-party tokens or insecure multi-sigs. Round pools and claimant bonds are stored natively in the EVM ghost custody contract. Upon settlement, the contract executes `emit_transfer` directly to the builder's verified address (`claimant_address`). The relayer never holds custody of claimant rewards or bond refunds.

### 7. Native Consensus Dispute Window & Settlement Protection
Decentralized justice requires time for human arbitration. Every adjudication enters an appeal window (`finality_window_seconds`). The contract strictly prevents appealed or non-final claims from being settled. Any active appeal freezes payouts; attempting to settle or finalize payouts before the dispute timelock elapses reverts immediately on-chain.

### 8. Mixed Deterministic and Non-Deterministic Logic
Themis brings together the best of both worlds. Financial bookkeeping (depositing pools, calculating balances, tracking bonds, enforcing timelocks, single-use evidence registry) is strictly deterministic and auditable. AI powered verification (pulling git evidence, inspecting DOM graphs, scoring fraud risk, author matching) runs non-deterministically through GenLayer consensus within the same unified Python contract.

### 9. Web3 Frontend with User-Bound Transaction Abstraction
The user interface is powered by `genlayer-js` on top of `viem`, connecting to GenLayer Studio Chain 61999. Contributor actions feature transaction abstraction: contributors sign in with their email via Privy, while backend relayers sponsor transaction gas. Importantly, the builder's own custody address is recorded as the claimant on-chain, keeping the relayer purely non-custodial. All embedded signer keys have been removed from the repository in favor of standard runtime environment variables.

### 10. Automated Test Suite with Revert Verification (18 Pytest + 10 Node Integration Tests)
The full test suite (`tests/test_themis_escrow.py` and `tests/test_backend_api.mjs`) provides 100% verification across all protocol states. Crucially, tests verify forced consensus failure paths:
- User-bound custody: payouts and bond refunds transfer directly to claimant address, not relayer
- Single-use evidence registry: replaying identical pull request evidence reverts immediately
- Grant repository binding: PRs from unauthorized repositories revert on-chain
- Verified contribution provenance: author mismatches between PR author and claimed builder are flagged and rejected
- Appeal settlement blocking: claims with active appeals strictly revert settlement attempts
- Non-final settlement blocking: claims whose dispute window has not expired strictly revert settlement attempts
- Rejection of claims with insufficient bond deposits
- Rejection of claims against nonexistent round identifiers
- Automatic bond slashing upon consensus sybil fraud detection

---

## Security & Protocol Integrity Guarantees

Themis enforces four non-negotiable security boundaries on GenLayer:

1. **User-Bound Custody**:
   Every claim submission requires a valid builder wallet address (`claimant_address`). When `settle_claim` or `finalize_round_payouts` executes, `self._transfer_funds` invokes `emit_transfer` directly to `claimant_address`. Even though the backend relayer sponsors transaction gas and deposits the bond on the builder's behalf, the relayer has zero custody or redirection capability.

2. **Verified Contribution Provenance & Repository Binding**:
   Grant rounds are created with a designated target repository (`target_repo`). During claim submission, validators verify that the pull request originates strictly from `target_repo`. Furthermore, Tier 1 consensus extracts the git commit author and verifies it against the builder's claimed GitHub handle (`builder_github`). Mismatches result in rejection and prevent unearned grant capture.

3. **Single-Use Evidence Registry**:
   To prevent replay attacks where a single merged PR is reused across multiple rounds or by multiple accounts, Themis maintains an on-chain `used_evidence` registry. PR URLs are normalized into a canonical format (`github:owner/repo#pr-num`). Any attempt to reuse registered evidence reverts on-chain.

4. **Settlement Timelock & Dispute Protection**:
   Claims cannot be finalized or settled while in `APPEALED` status or before `now >= finality_expires_at`. Both `settle_claim` and `finalize_round_payouts` enforce strict on-chain require statements that revert if any claim is unfinalized or under active dispute.

---

## System Architecture

```
                                +-----------------------------------+
                                |        Themis User Interface      |
                                | (React 18, Vite, Tailwind, Privy) |
                                +-----------------+-----------------+
                                                  |
                                    REST API / Transaction Relay
                                                  |
                                                  v
                                +-----------------+-----------------+
                                |      Themis Node.js Relayer       |
                                |  (Neon PostgreSQL + genlayer-js)  |
                                +-----------------+-----------------+
                                                  |
                                       JSON-RPC (Chain 61999)
                                                  |
                                                  v
                        +---------------------------------------------------+
                        |             GenLayer Intelligent Contract         |
                        |             (ThemisGrantEscrow in Python)         |
                        +-------------------------+-------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
           +---------------------------+                     +---------------------------+
           | Tier 1: Pull Request Proof|                     | Tier 2: Sybil Graph Proof |
           |   gl.nondet.web.get()     |                     |   gl.nondet.web.render()  |
           |   gl.eq.strict_eq         |                     |   prompt_non_comparative  |
           +-------------+-------------+                     +-------------+-------------+
                         |                                                 |
                         +------------------------+------------------------+
                                                  |
                                                  v
                                    +---------------------------+
                                    |    EVM Ghost Custody      |
                                    |       emit_transfer       |
                                    | (Payout or Slash to Pool) |
                                    +---------------------------+
```

---

## Repository Structure

```
├── contracts/
│   └── themis_grant_escrow.py      # Core Intelligent Contract in Python (10 primitives)
├── tests/
│   ├── test_themis_escrow.py       # Pytest suite with failure path reverts (11 tests)
│   └── test_backend_api.mjs        # Full integration test suite for backend API
├── backend/
│   ├── src/
│   │   ├── app.js                  # Express API with transaction abstraction & static serving
│   │   ├── server.js               # Server entrypoint on port 3001
│   │   ├── db.js                   # Neon PostgreSQL schema and connection pooler
│   │   ├── genlayer.js             # On-chain relayer client with custom provider
│   │   └── privy.js                # Email-only authentication middleware
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BalanceScaleHero.jsx      # Dual-Chamber balance scale device
│   │   │   ├── Navbar.jsx                # Navigation, metrics ribbon, Privy auth
│   │   │   ├── RoundsList.jsx            # DAO grant rounds browser
│   │   │   ├── ClaimsDocketList.jsx      # Filterable claims ledger
│   │   │   ├── ClaimDossierInspector.jsx # Deep evidence inspector (Tier 1 & 2)
│   │   │   ├── ClaimSubmissionModal.jsx  # Dual evidence submission modal
│   │   │   ├── CreateRoundModal.jsx      # Round creation and funding modal
│   │   │   └── AppealModal.jsx           # Protocol dispute and settlement freeze
│   │   ├── context/
│   │   │   ├── ThemisContext.jsx         # Global state & abstracted relay actions
│   │   │   └── ThemeContext.jsx          # Theme styling management
│   │   ├── App.jsx                       # Split-pane dashboard assembly
│   │   └── main.jsx                      # PrivyProvider and React root
│   ├── index.html                        # Zero-hyphen entry HTML
│   └── vite.config.js                    # Vite bundler configuration
├── deploy/
│   ├── deploy.mjs                  # Script to deploy contract to Studio network
│   ├── seed_rounds.mjs             # Script to fund initial DAO grant rounds
│   └── deployed_contract.json      # On-chain deployment record and transaction hash
└── package.json                    # Workspace scripts and dependencies
```

---

## Getting Started

### Prerequisites
- Node.js v18 or later
- Python 3.10+
- GenLayer Studio access / RPC endpoint

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/dotmantissa/themis.git
cd themis

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Environment Setup

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
GENLAYER_RPC_URL="https://studio.genlayer.com/api"
GENLAYER_CHAIN_ID=61999
GENLAYER_PRIVATE_KEY="0x..."

DATABASE_URL="postgresql://..."
PRIVY_APP_ID="cmucf5bf7034l0cl2v3l0do5j"
PRIVY_APP_SECRET="..."

PORT=3001
VITE_PORT=5173
```

### Running Test Suites

Run the contract test suite (11 unit and revert failure tests):

```bash
npm run test
# Or directly: pytest tests/test_themis_escrow.py -v
```

Run backend API integration tests:

```bash
node tests/test_backend_api.mjs
```

### Building and Running the Full Stack

Build the frontend:

```bash
npm run build:frontend
```

Start the production server (serves both API and frontend on port 3001):

```bash
npm run start:backend
```

Open your browser at `http://localhost:3001` to access Themis.

---

## Design System and Palette

Themis is styled with a custom aesthetic:
- Deep Navy: `#24244f`
- Clean White: `#ffffff`
- Acid Lime: `#d4f717`
- Electric Violet: `#5a38fd`

Typography pairs **Syne** for impactful headers, **JetBrains Mono** for on-chain telemetry and hashes, and **Inter** for readable forensic dossiers.

---

## License

MIT License. Designed and engineered for the GenLayer ecosystem.
