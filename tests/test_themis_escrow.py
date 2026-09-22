import json
import pytest
from unittest.mock import MagicMock, patch
import sys
from pathlib import Path
import types

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))


class MockSender:
    def __init__(self, address="0xbc1399c55538ec034d4da550c03c34ae0c357f53", value=0):
        self.sender_account = address
        self.sender_address = address
        self.value = value
        self.raw = {"datetime": "2026-09-22T10:00:00Z"}


class MockContractTarget:
    def __init__(self, address):
        self.address = address
        self.transfers = []

    def emit_transfer(self, value=0, on="finalized"):
        self.transfers.append({"value": int(value), "on": on})


# Setup mock genlayer environment
_mod = types.ModuleType("genlayer")
mock_gl = MagicMock()
mock_gl.message = MockSender()
mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
mock_gl.Contract = object
mock_gl.public.view = lambda f: f
mock_gl.public.write = lambda f: f
mock_gl.public.write.payable = lambda f: f
mock_gl.vm.UserError = ValueError
mock_gl.vm.Return = dict
mock_gl.vm.run_nondet_unsafe = lambda leader_fn, validator_fn: leader_fn()
mock_gl.eq_principle.strict_eq = lambda fn: fn()
mock_gl.eq_principle.prompt_non_comparative = lambda fn, task="", criteria="": fn()

target_registry = {}


def mock_get_contract_at(address):
    addr_str = str(address).lower()
    if addr_str not in target_registry:
        target_registry[addr_str] = MockContractTarget(address)
    return target_registry[addr_str]


mock_gl.get_contract_at = mock_get_contract_at

_mod.gl = mock_gl
_mod.Address = str
_mod.TreeMap = dict
_mod.DynArray = list
_mod.u256 = int
_mod.u64 = int
_mod.u32 = int
_mod.__all__ = ["gl", "Address", "TreeMap", "DynArray", "u256", "u64", "u32"]

sys.modules["genlayer"] = _mod

from contracts import themis_grant_escrow


def create_test_contract(owner="0xbc1399c55538ec034d4da550c03c34ae0c357f53"):
    """Instantiate a test ThemisGrantEscrow contract with initialized storage."""
    mock_gl.message = MockSender(address=owner, value=0)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract = themis_grant_escrow.ThemisGrantEscrow(default_finality_seconds=3600)
    contract.owner = owner
    contract.rounds = {}
    contract.round_ids = []
    contract.claims = {}
    contract.claim_ids = []
    contract.round_claims = {}
    contract.claimant_claims = {}
    contract.total_rounds = 0
    contract.total_claims = 0
    contract.total_pool_deposited_wei = 0
    contract.total_grants_disbursed_wei = 0
    contract.total_bonds_staked_wei = 0
    contract.total_bonds_refunded_wei = 0
    contract.total_bonds_slashed_wei = 0
    contract.dispute_bounty_pool_wei = 0
    contract.default_finality_seconds = 3600
    return contract


def test_initial_protocol_metrics():
    contract = create_test_contract()
    assert contract.get_owner() == "0xbc1399c55538ec034d4da550c03c34ae0c357f53"
    assert json.loads(contract.get_all_round_ids()) == []
    assert json.loads(contract.get_all_claim_ids()) == []

    metrics = json.loads(contract.get_escrow_metrics())
    assert metrics["total_rounds"] == 0
    assert metrics["total_claims"] == 0
    assert metrics["total_pool_deposited_wei"] == "0"
    assert metrics["total_grants_disbursed_wei"] == "0"
    assert metrics["total_bonds_slashed_wei"] == "0"
    assert metrics["dispute_bounty_pool_wei"] == "0"


def test_round_creation_and_funding():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao1111111111111111111111111111111111111", value=5000000000000000000)

    res = contract.create_round(
        round_id="themis-q4-builders",
        title="Themis Developer Grant Round 1",
        description="Grants for open source GenLayer primitives and tooling",
        grant_amount_wei=1000000000000000000,   # 1 GEN
        required_bond_wei=100000000000000000,    # 0.1 GEN
        finality_window_seconds=1800,
    )
    parsed = json.loads(res)
    assert parsed["round_id"] == "themis-q4-builders"
    assert parsed["status"] == "OPEN"
    assert parsed["deposited_pool_wei"] == "5000000000000000000"

    assert json.loads(contract.get_all_round_ids()) == ["themis-q4-builders"]
    round_data = json.loads(contract.get_round("themis-q4-builders"))
    assert round_data["title"] == "Themis Developer Grant Round 1"
    assert round_data["remaining_pool_wei"] == "5000000000000000000"
    assert round_data["required_bond_wei"] == "100000000000000000"


def test_round_additional_deposit():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao1111111111111111111111111111111111111", value=2000000000000000000)
    contract.create_round(
        round_id="round-extra",
        title="Infrastructure Round",
        description="Core infra",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
    )

    # Deposit additional 3 GEN
    mock_gl.message = MockSender(address="0xdao1111111111111111111111111111111111111", value=3000000000000000000)
    dep_res = contract.deposit_round_funds("round-extra")
    parsed = json.loads(dep_res)
    assert parsed["new_pool_wei"] == "5000000000000000000"
    assert parsed["new_remaining_pool_wei"] == "5000000000000000000"


def test_approved_claim_and_payout_settlement():
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    claimant_addr = "0xclaimant77777777777777777777777777777777"

    # 1. DAO funds round with 10 GEN
    mock_gl.message = MockSender(address=dao_addr, value=10000000000000000000)
    contract.create_round(
        round_id="themis-round-approve",
        title="Public Good Grants",
        description="Public goods funding",
        grant_amount_wei=2000000000000000000,   # 2 GEN
        required_bond_wei=200000000000000000,    # 0.2 GEN
        finality_window_seconds=60,             # 60s finality window
    )

    # Mock web responses for approval: merged PR and organic tenure
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({
        "title": "Add Sybil Verification Engine",
        "state": "closed",
        "merged": True,
    }).encode("utf-8")

    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>150 commits across 2 years. Active verified profile.</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 12,
        "fraud_detected": False,
        "sybil_tier": "ORGANIC",
        "reasoning": "Genuine developer with active historical track record",
    })

    # 2. Claimant posts 0.2 GEN bond
    mock_gl.message = MockSender(address=claimant_addr, value=200000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    claim_res = contract.submit_grant_claim(
        claim_id="claim-001",
        round_id="themis-round-approve",
        pr_url="https://github.com/org/repo/pull/42",
        activity_url="https://github.com/claimant777",
        screenshot_url="https://themis.org/proof/claim-001.png",
        notes="Implemented grant milestone PR #42 with test suite",
    )
    parsed_claim = json.loads(claim_res)
    assert parsed_claim["verdict"] == "APPROVED"
    assert parsed_claim["tier1_pr_merged"] is True
    assert parsed_claim["fraud_detected"] is False

    # 3. Settlement after finality window
    # Advance time by 100 seconds past the 60s finality window
    mock_gl.message_raw = {"datetime": "2026-09-22T10:01:40Z"}
    target_registry.clear()

    settle_res = contract.settle_claim("claim-001")
    parsed_settle = json.loads(settle_res)
    assert parsed_settle["status"] == "SETTLED"
    assert parsed_settle["verdict"] == "APPROVED"
    # Claimant receives 2 GEN grant + 0.2 GEN bond refund = 2.2 GEN (2200000000000000000 wei)
    assert parsed_settle["claimant_transferred_wei"] == "2200000000000000000"

    # Check that emit_transfer was triggered on claimant interface
    claimant_target = target_registry.get(claimant_addr.lower())
    assert claimant_target is not None
    assert len(claimant_target.transfers) == 1
    assert claimant_target.transfers[0]["value"] == 2200000000000000000


def test_sybil_fraud_rejection_slashes_bond():
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    fraud_addr = "0xfrauder99999999999999999999999999999999"

    mock_gl.message = MockSender(address=dao_addr, value=5000000000000000000)
    contract.create_round(
        round_id="themis-round-fraud",
        title="Fraud Testing Round",
        description="Testing sybil slashing",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=300000000000000000,   # 0.3 GEN
        finality_window_seconds=30,
    )

    # Mock PR merged but claimant detected as automated sybil ring
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Trivial whitespace", "merged": True, "state": "closed"}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>Created 2 hours ago. 5 identical forks with synchronized timing.</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 92,
        "fraud_detected": True,
        "sybil_tier": "CONFIRMED_SYBIL",
        "reasoning": "Detected coordinated sybil cluster with batch-minted accounts and empty commit churn",
    })

    # Submitter posts 0.3 GEN bond
    mock_gl.message = MockSender(address=fraud_addr, value=300000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    claim_res = contract.submit_grant_claim(
        claim_id="claim-fraud-01",
        round_id="themis-round-fraud",
        pr_url="https://github.com/org/repo/pull/99",
        activity_url="https://github.com/frauder999",
        screenshot_url="",
        notes="Please gib grant",
    )
    parsed_claim = json.loads(claim_res)
    assert parsed_claim["verdict"] == "REJECTED_SYBIL_FRAUD"
    assert parsed_claim["fraud_detected"] is True
    assert parsed_claim["tier2_sybil_score"] == 92

    # Advance past 30s finality window
    mock_gl.message_raw = {"datetime": "2026-09-22T10:01:00Z"}
    target_registry.clear()

    settle_res = contract.settle_claim("claim-fraud-01")
    parsed_settle = json.loads(settle_res)
    assert parsed_settle["status"] == "SLASHED"
    assert parsed_settle["slashed_wei"] == "300000000000000000"
    assert parsed_settle["claimant_transferred_wei"] == "0"

    # Verify slashed bond entered dispute bounty pool
    metrics = json.loads(contract.get_escrow_metrics())
    assert metrics["dispute_bounty_pool_wei"] == "300000000000000000"
    assert metrics["total_bonds_slashed_wei"] == "300000000000000000"


def test_pr_not_merged_refunds_bond_without_grant():
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    honest_addr = "0xhonest555555555555555555555555555555555"

    mock_gl.message = MockSender(address=dao_addr, value=5000000000000000000)
    contract.create_round(
        round_id="themis-round-unmerged",
        title="Open Round",
        description="Testing honest unmerged PR",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=200000000000000000,
        finality_window_seconds=45,
    )

    # Mock unmerged PR (state open, merged false) with legitimate organic activity
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "WIP Feature", "merged": False, "state": "open"}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>Active open source contributor.</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 15,
        "fraud_detected": False,
        "sybil_tier": "ORGANIC",
        "reasoning": "Organic contributor, but PR is still pending review",
    })

    mock_gl.message = MockSender(address=honest_addr, value=200000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    claim_res = contract.submit_grant_claim(
        claim_id="claim-honest-01",
        round_id="themis-round-unmerged",
        pr_url="https://github.com/org/repo/pull/101",
        activity_url="https://github.com/honest555",
    )
    parsed_claim = json.loads(claim_res)
    assert parsed_claim["verdict"] == "REJECTED_PR_NOT_MERGED"
    assert parsed_claim["tier1_pr_merged"] is False

    # Advance time and settle
    mock_gl.message_raw = {"datetime": "2026-09-22T10:01:00Z"}
    target_registry.clear()

    settle_res = contract.settle_claim("claim-honest-01")
    parsed_settle = json.loads(settle_res)
    assert parsed_settle["status"] == "REFUNDED"
    # Bond refunded to claimant, but zero grant disbursed
    assert parsed_settle["refunded_bond_wei"] == "200000000000000000"
    assert parsed_settle["claimant_transferred_wei"] == "200000000000000000"

    # Pool funds remain completely intact for other claimants
    round_data = json.loads(contract.get_round("themis-round-unmerged"))
    assert round_data["remaining_pool_wei"] == "5000000000000000000"


def test_native_appeal_and_governor_resolution():
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    appellant_addr = "0xappellant44444444444444444444444444444444"

    mock_gl.message = MockSender(address=dao_addr, value=5000000000000000000)
    contract.create_round(
        round_id="themis-appeal-round",
        title="Appeal Test Round",
        description="Testing native appeals",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=200000000000000000,
        finality_window_seconds=120,
    )

    # Initial mistaken rejection
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR in review", "merged": False}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>Contributor profile</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 25, "fraud_detected": False, "sybil_tier": "ORGANIC", "reasoning": "Unmerged PR"})

    mock_gl.message = MockSender(address=appellant_addr, value=200000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.submit_grant_claim(
        claim_id="claim-appeal-01",
        round_id="themis-appeal-round",
        pr_url="https://github.com/org/repo/pull/50",
        activity_url="https://github.com/appellant444",
    )

    # Claimant registers appeal within the 120s finality window (at t+30s)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:30Z"}
    mock_gl.message = MockSender(address=appellant_addr, value=0)
    appeal_res = contract.appeal_claim("claim-appeal-01", "PR was merged into upstream release branch commit 8f4e2a!")
    parsed_appeal = json.loads(appeal_res)
    assert parsed_appeal["status"] == "APPEALED"
    assert parsed_appeal["is_appealed"] is True

    # Settlement attempt during active appeal MUST FAIL
    mock_gl.message_raw = {"datetime": "2026-09-22T10:05:00Z"}
    with pytest.raises(ValueError, match="Claim is not in ADJUDICATED state"):
        contract.settle_claim("claim-appeal-01")

    # Governor resolves appeal to APPROVED
    mock_gl.message = MockSender(address=contract.owner, value=0)
    contract.resolve_appeal("claim-appeal-01", "APPROVED", "Verified upstream merge commit confirmed")

    # Settlement now succeeds
    settle_res = contract.settle_claim("claim-appeal-01")
    assert json.loads(settle_res)["status"] == "SETTLED"


# ─────────────────────────────────────────────────────────────────────────────
# FAILURE-PATH TESTS (Enforcing Reverts on Invalid Operations)
# ─────────────────────────────────────────────────────────────────────────────

def test_failure_insufficient_bond_reverts():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="fail-bond-round",
        title="Bond Test Round",
        description="Testing bond revert",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=500000000000000000,   # 0.5 GEN required
    )

    # Post only 0.1 GEN bond -> must revert
    mock_gl.message = MockSender(address="0xcheapo", value=100000000000000000)
    with pytest.raises(ValueError, match="below required"):
        contract.submit_grant_claim(
            claim_id="fail-claim-01",
            round_id="fail-bond-round",
            pr_url="https://github.com/org/repo/pull/1",
            activity_url="https://github.com/cheapo",
        )


def test_failure_nonexistent_round_reverts():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xclaimant", value=100000000000000000)
    with pytest.raises(ValueError, match="round_id not found"):
        contract.submit_grant_claim(
            claim_id="fail-claim-02",
            round_id="nonexistent-round-999",
            pr_url="https://github.com/org/repo/pull/1",
            activity_url="https://github.com/claimant",
        )


def test_failure_settling_before_finality_window_reverts():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="finality-round",
        title="Finality Round",
        description="Testing timelock",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=3600,   # 1 hour window
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Valid PR", "merged": True}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>Activity</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC", "reasoning": "Organic"})

    mock_gl.message = MockSender(address="0xhasty", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    contract.submit_grant_claim(
        claim_id="hasty-claim",
        round_id="finality-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/hasty",
    )

    # Attempting to settle after only 10 seconds -> must revert
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:10Z"}
    with pytest.raises(ValueError, match="Native appeal window is still active"):
        contract.settle_claim("hasty-claim")


def test_failure_duplicate_claim_id_reverts():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="dup-round",
        title="Duplicate Round",
        description="Testing dupes",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
    )

    mock_gl.message = MockSender(address="0xclaimant", value=100000000000000000)
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Valid PR", "merged": True}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>Activity</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC", "reasoning": "Organic"})

    contract.submit_grant_claim(
        claim_id="unique-claim-1",
        round_id="dup-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/claimant",
    )

    with pytest.raises(ValueError, match="claim_id already submitted"):
        contract.submit_grant_claim(
            claim_id="unique-claim-1",
            round_id="dup-round",
            pr_url="https://github.com/org/repo/pull/2",
            activity_url="https://github.com/claimant",
        )


def test_round_creation_with_duration():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    res = contract.create_round(
        round_id="round-duration-test",
        title="Timed Grant Round",
        description="Testing duration and expiry",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=1800,
        duration_seconds=86400,  # 1 day
    )
    parsed = json.loads(res)
    assert parsed["duration_seconds"] == 86400
    assert parsed["expires_at"] > 0
    assert parsed["status"] == "OPEN"

    round_data = json.loads(contract.get_round("round-duration-test"))
    assert round_data["duration_seconds"] == 86400
    assert round_data["expires_at"] == round_data["created_at"] + 86400
    assert round_data["status"] == "OPEN"


def test_claim_rejection_after_duration_expires():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    # Start round at 10:00:00Z with 3600 seconds duration (expires at 11:00:00Z)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.create_round(
        round_id="expiring-round",
        title="1-Hour Grant Round",
        description="Duration limited",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        duration_seconds=3600,
    )

    # 1. Submission before expiry succeeds
    mock_gl.message = MockSender(address="0xclaimant", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:30:00Z"}
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Fix bug", "merged": True}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html><body>Activity</body></html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 5, "fraud_detected": False, "sybil_tier": "ORGANIC", "reasoning": "Legit"})

    res = contract.submit_grant_claim(
        claim_id="timely-claim",
        round_id="expiring-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/claimant",
    )
    assert json.loads(res)["status"] == "ADJUDICATED"

    # 2. Advance time past expiry (11:00:01Z) -> Submission must revert
    mock_gl.message_raw = {"datetime": "2026-09-22T11:00:01Z"}
    with pytest.raises(ValueError, match="Grant round timeline has elapsed; applications are closed"):
        contract.submit_grant_claim(
            claim_id="late-claim",
            round_id="expiring-round",
            pr_url="https://github.com/org/repo/pull/2",
            activity_url="https://github.com/lateuser",
        )

    # Round status reflected as EXPIRED
    round_data = json.loads(contract.get_round("expiring-round"))
    assert round_data["status"] == "EXPIRED"


def test_top_ranking_projects_share_pool_at_deadline():
    contract = create_test_contract()
    # Fund round with 2 GEN for 2 top winners (1 GEN each)
    mock_gl.message = MockSender(address="0xdao", value=2000000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.create_round(
        round_id="top-ranking-round",
        title="Top Strengths Grant Round",
        description="Top 2 ideas share the pool",
        grant_amount_wei=1000000000000000000,   # 1 GEN per winner
        required_bond_wei=100000000000000000,    # 0.1 GEN bond
        finality_window_seconds=60,
        duration_seconds=3600,                   # 1 hour
        reward_recipients_count=2,
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR merged", "merged": True}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>contributions</html>")

    # 1. Project A: High strength score (95)
    mock_gl.message = MockSender(address="0xclaimantA", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:10:00Z"}
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 10,
        "fraud_detected": False,
        "sybil_tier": "ORGANIC",
        "strength_score": 95,
        "strength_assessment": "Exceptional architecture and test coverage",
        "reasoning": "Organic contributor with stellar PR",
    })
    res_a = contract.submit_grant_claim(
        claim_id="claim-a",
        round_id="top-ranking-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/claimantA",
    )
    assert json.loads(res_a)["status"] == "ADJUDICATED"

    # 2. Project B: Good strength score (82)
    mock_gl.message = MockSender(address="0xclaimantB", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:15:00Z"}
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 15,
        "fraud_detected": False,
        "sybil_tier": "ORGANIC",
        "strength_score": 82,
        "strength_assessment": "Strong idea and clean implementation",
        "reasoning": "Legitimate contributor",
    })
    res_b = contract.submit_grant_claim(
        claim_id="claim-b",
        round_id="top-ranking-round",
        pr_url="https://github.com/org/repo/pull/2",
        activity_url="https://github.com/claimantB",
    )
    assert json.loads(res_b)["status"] == "ADJUDICATED"

    # 3. Project C: Runner up strength score (65)
    mock_gl.message = MockSender(address="0xclaimantC", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:20:00Z"}
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 20,
        "fraud_detected": False,
        "sybil_tier": "ORGANIC",
        "strength_score": 65,
        "strength_assessment": "Average implementation, minimal tests",
        "reasoning": "Organic but lower relative strength",
    })
    res_c = contract.submit_grant_claim(
        claim_id="claim-c",
        round_id="top-ranking-round",
        pr_url="https://github.com/org/repo/pull/3",
        activity_url="https://github.com/claimantC",
    )
    assert json.loads(res_c)["status"] == "ADJUDICATED"

    # 4. Project D: Sybil Fraud
    mock_gl.message = MockSender(address="0xclaimantD", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:25:00Z"}
    mock_gl.nondet.exec_prompt = MagicMock(return_value={
        "sybil_score": 95,
        "fraud_detected": True,
        "sybil_tier": "FARM",
        "strength_score": 10,
        "strength_assessment": "Fraudulent PR farm bot",
        "reasoning": "Bot ring detected",
    })
    res_d = contract.submit_grant_claim(
        claim_id="claim-d",
        round_id="top-ranking-round",
        pr_url="https://github.com/org/repo/pull/4",
        activity_url="https://github.com/claimantD",
    )
    assert json.loads(res_d)["status"] == "ADJUDICATED"

    # Attempting to settle before deadline expires MUST FAIL
    mock_gl.message_raw = {"datetime": "2026-09-22T10:30:00Z"}
    with pytest.raises(ValueError, match="Grant round timeline has not elapsed yet"):
        contract.settle_claim("claim-a")

    # Advance time past deadline (11:05:00Z) and finalize payouts
    mock_gl.message_raw = {"datetime": "2026-09-22T11:05:00Z"}
    final_res = json.loads(contract.finalize_round_payouts("top-ranking-round"))
    assert final_res["status"] == "SETTLED"
    assert final_res["winners_count"] == 2
    assert "claim-a" in final_res["winning_claim_ids"]
    assert "claim-b" in final_res["winning_claim_ids"]
    assert final_res["runners_up_count"] == 1

    # Verify Claim A (Rank 1 Winner)
    claim_a = json.loads(contract.get_claim("claim-a"))
    assert claim_a["status"] == "SETTLED"
    assert claim_a["verdict"] == "APPROVED"
    assert claim_a["rank"] == 1
    assert claim_a["reward_payout_wei"] == "1000000000000000000"

    # Verify Claim B (Rank 2 Winner)
    claim_b = json.loads(contract.get_claim("claim-b"))
    assert claim_b["status"] == "SETTLED"
    assert claim_b["verdict"] == "APPROVED"
    assert claim_b["rank"] == 2
    assert claim_b["reward_payout_wei"] == "1000000000000000000"

    # Verify Claim C (Honest Runner-up: refunded bond, 0 grant)
    claim_c = json.loads(contract.get_claim("claim-c"))
    assert claim_c["status"] == "REFUNDED"
    assert claim_c["verdict"] == "HONEST_RUNNER_UP"
    assert claim_c["rank"] == 3
    assert claim_c["reward_payout_wei"] == "0"

    # Verify Claim D (Sybil Fraud: Slashed)
    claim_d = json.loads(contract.get_claim("claim-d"))
    assert claim_d["status"] == "SLASHED"
    assert claim_d["verdict"] == "REJECTED_SYBIL_FRAUD"

    # Verify round status and remaining pool
    round_data = json.loads(contract.get_round("top-ranking-round"))
    assert round_data["status"] == "SETTLED"
    assert round_data["remaining_pool_wei"] == "0"


def test_deposit_round_funds_increases_pool_accounting():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=1000000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.create_round(
        round_id="deposit-test-round",
        title="Fundable Round",
        description="Receives additional funds",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=60,
        duration_seconds=86400,
    )

    # DAO deposits another 3 GEN
    mock_gl.message = MockSender(address="0xdao", value=3000000000000000000)
    dep_res = json.loads(contract.deposit_round_funds("deposit-test-round"))
    assert dep_res["new_pool_wei"] == "4000000000000000000"
    assert dep_res["new_remaining_pool_wei"] == "4000000000000000000"

    round_data = json.loads(contract.get_round("deposit-test-round"))
    assert round_data["pool_wei"] == "4000000000000000000"
    assert round_data["remaining_pool_wei"] == "4000000000000000000"


