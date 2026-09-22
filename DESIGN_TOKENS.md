# Design Tokens & Variance Decisions: Themis

## 1. Random Seed Roll & Parameter Justification
- **Seed**: 1790066550
- **Project**: Themis (Sybil-Resistant Grant Escrow on GenLayer)

### Dimension 1: Layout Archetype
- **Decision**: Dashboard-First Split-Pane with Evidence Dossier Ledger
- **Justification**: Grant allocators and DAO stewards need continuous visibility over the balance scale of funds (pool reserves vs bonded claims) alongside a focused inspection workspace where GitHub PR proofs, sybil cluster activity, and validator consensus tallies are scrutinized in parallel without losing holistic context.

### Dimension 2: Type Pairing
- **Decision**: Cabinet Grotesk (Display Headings, Weight 800/700) + Inter (Interface Body, Weight 400/500/600) + JetBrains Mono (Code Hashes, Consensus Vectors, Balances)
- **Justification**: Conveys forensic authority and judicial precision without appearing sterile. JetBrains Mono provides tabular stability for cryptographic digests, git commit SHAs, and basis-point scores.

### Dimension 3: Motion Signature
- **Decision**: Response-to-Action Motion Only (Zero Ambient Blobs or Drifting Particles)
- **Justification**: A financial adjudication escrow demands solemnity and crisp responsiveness. Animations fire solely upon explicit user action: posting bonds, running verification, inspecting dossiers, and submitting appeals.

### Dimension 4: Structural Device
- **Decision**: The Themis Dual-Chamber Balance Scale & Verification Docket Ribbon
- **Justification**: Represents the fundamental physical and economic metaphor of Themis. One pan holds DAO grant liquidity; the opposing pan holds the claimant's bonded collateral. When validators certify the pull request and clear sybil risk, the scale balances and triggers disbursement. If fraud is detected, the scale tips, slashing collateral into the bounty reserve.

### Dimension 5: Color Palette
- **Deep Navy Background**: `#24244f`
- **Pure White Surface**: `#ffffff`
- **Electric Acid Lime Accent**: `#d4f717`
- **Royal Electric Iris/Violet**: `#5a38fd`
- **Slate Border / Muted Neutral**: `#383870` / `#1a1a3a`
- **High-contrast light and dark themes**

### Banned Patterns Audit
- [x] No ALL-CAPS tracked eyebrow labels
- [x] No "WORD — fragment" em-dash labels
- [x] No generic "→" appended to every button
- [x] No arbitrary numbered 01/02/03 steps
- [x] No identical SaaS card kits with uniform soft grey shadows
- [x] No AI artifacts or unnecessary hyphens across the entire frontend (allowed only where strictly necessary like "on-chain")
- [x] Human-written copy with warmth, wit, and clarity
- [x] Email authentication only (Privy email flow) with transaction abstraction
