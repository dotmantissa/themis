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
    contract.used_evidence = {}
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
        target_repo="dotmantissa/themis",
    )
    parsed = json.loads(res)
    assert parsed["round_id"] == "themis-q4-builders"
    assert parsed["status"] == "OPEN"
    assert parsed["target_repo"] == "dotmantissa/themis"
    assert parsed["deposited_pool_wei"] == "5000000000000000000"

    assert json.loads(contract.get_all_round_ids()) == ["themis-q4-builders"]
    round_data = json.loads(contract.get_round("themis-q4-builders"))
    assert round_data["title"] == "Themis Developer Grant Round 1"
    assert round_data["target_repo"] == "dotmantissa/themis"
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
        target_repo="org/repo",
    )

    # Mock web responses for approval: merged PR and organic tenure
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({
        "title": "Add Sybil Verification Engine",
        "state": "closed",
        "merged": True,
        "user": {"login": "claimant777"},
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
        claimant_address=claimant_addr,
        builder_github="claimant777",
        screenshot_url="https://themis.org/proof/claim-001.png",
        notes="Implemented grant milestone PR #42 with test suite",
    )
    parsed_claim = json.loads(claim_res)
    assert parsed_claim["verdict"] == "APPROVED"
    assert parsed_claim["tier1_pr_merged"] is True
    assert parsed_claim["author_matched"] is True
    assert parsed_claim["fraud_detected"] is False

    # 3. Settlement after finality window
    # Advance time by 100 seconds past the 60s finality window
    mock_gl.message_raw = {"datetime": "2026-09-22T10:01:40Z"}
    target_registry.clear()

    settle_res = contract.settle_claim("claim-001")
    parsed_settle = json.loads(settle_res)
    assert parsed_settle["status"] == "SETTLED"
    assert parsed_settle["verdict"] == "APPROVED"
    assert parsed_settle["claimant_transferred_wei"] == "2200000000000000000"

    # Check that emit_transfer was triggered on claimant address
    claimant_target = target_registry.get(claimant_addr.lower())
    assert claimant_target is not None
    assert len(claimant_target.transfers) == 1
    assert claimant_target.transfers[0]["value"] == 2200000000000000000


def test_user_bound_custody_transfers_to_claimant_not_relayer():
    """
    CRITICAL: Verify that when a relayer broadcasts the claim transaction,
    payout and bond custody are strictly bound to claimant_address, NEVER the relayer.
    """
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    relayer_addr = "0xrelayer88888888888888888888888888888888"
    actual_builder_addr = "0xbuilder99999999999999999999999999999999"

    mock_gl.message = MockSender(address=dao_addr, value=5000000000000000000)
    contract.create_round(
        round_id="user-bound-round",
        title="User Bound Round",
        description="Testing direct builder custody",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=60,
        target_repo="dotmantissa/themis",
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({
        "title": "Core feature",
        "state": "closed",
        "merged": True,
        "user": {"login": "actualbuilder"},
    }).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Active builder profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    # Relayer submits on behalf of builder
    mock_gl.message = MockSender(address=relayer_addr, value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    res = contract.submit_grant_claim(
        claim_id="relayed-claim-01",
        round_id="user-bound-round",
        pr_url="https://github.com/dotmantissa/themis/pull/5",
        activity_url="https://github.com/actualbuilder",
        claimant_address=actual_builder_addr,
        builder_github="actualbuilder",
    )
    parsed = json.loads(res)
    assert parsed["claimant"] == actual_builder_addr

    # Verify claim storage is bound to builder
    stored_claim = json.loads(contract.get_claim("relayed-claim-01"))
    assert stored_claim["claimant"] == actual_builder_addr

    # Settle claim past finality window
    mock_gl.message_raw = {"datetime": "2026-09-22T10:02:00Z"}
    target_registry.clear()

    contract.settle_claim("relayed-claim-01")

    # Builder received payout
    builder_target = target_registry.get(actual_builder_addr.lower())
    assert builder_target is not None
    assert len(builder_target.transfers) == 1
    assert builder_target.transfers[0]["value"] == 1100000000000000000  # 1 GEN grant + 0.1 GEN bond

    # Relayer received ZERO transfers
    relayer_target = target_registry.get(relayer_addr.lower())
    assert relayer_target is None or len(relayer_target.transfers) == 0


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
        target_repo="org/repo",
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Trivial whitespace", "merged": True, "state": "closed", "user": {"login": "frauder999"}}).encode("utf-8")
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
        claimant_address=fraud_addr,
        builder_github="frauder999",
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
        target_repo="org/repo",
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "WIP Feature", "merged": False, "state": "open", "user": {"login": "honest555"}}).encode("utf-8")
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
        claimant_address=honest_addr,
        builder_github="honest555",
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
    assert parsed_settle["refunded_bond_wei"] == "200000000000000000"
    assert parsed_settle["claimant_transferred_wei"] == "200000000000000000"


def test_verified_contribution_provenance_author_mismatch():
    """
    CRITICAL: Verify that when PR author does not match builder_github,
    the claim is rejected with REJECTED_AUTHOR_MISMATCH and bond is refunded.
    """
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    imposter_addr = "0ximposter3333333333333333333333333333333"

    mock_gl.message = MockSender(address=dao_addr, value=5000000000000000000)
    contract.create_round(
        round_id="provenance-round",
        title="Provenance Test Round",
        description="Testing author verification",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=200000000000000000,
        finality_window_seconds=60,
        target_repo="dotmantissa/themis",
    )

    # PR was authored by legitimate builder "alice"
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({
        "title": "Awesome Feature",
        "state": "closed",
        "merged": True,
        "user": {"login": "alice"},
    }).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    # Imposter "bob" tries to claim Alice's merged PR
    mock_gl.message = MockSender(address=imposter_addr, value=200000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}

    res = contract.submit_grant_claim(
        claim_id="imposter-claim",
        round_id="provenance-round",
        pr_url="https://github.com/dotmantissa/themis/pull/10",
        activity_url="https://github.com/bob",
        claimant_address=imposter_addr,
        builder_github="bob",  # Declared bob, but PR author is alice
    )
    parsed = json.loads(res)
    assert parsed["verdict"] == "REJECTED_AUTHOR_MISMATCH"
    assert parsed["author_matched"] is False

    # Advance time and settle -> bond refunded, no grant paid
    mock_gl.message_raw = {"datetime": "2026-09-22T10:02:00Z"}
    target_registry.clear()

    settle_res = contract.settle_claim("imposter-claim")
    assert json.loads(settle_res)["status"] == "REFUNDED"
    assert json.loads(settle_res)["claimant_transferred_wei"] == "200000000000000000"


def test_grant_repository_binding_reverts_on_unauthorized_repo():
    """
    CRITICAL: Verify that submitting a PR from a different repository reverts.
    """
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="target-repo-round",
        title="Target Repo Bound Round",
        description="Bound to dotmantissa/themis",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        target_repo="dotmantissa/themis",
    )

    mock_gl.message = MockSender(address="0xclaimant", value=100000000000000000)
    # PR belongs to "unrelated/repo" -> must revert
    with pytest.raises(ValueError, match="does not match grant repository"):
        contract.submit_grant_claim(
            claim_id="wrong-repo-claim",
            round_id="target-repo-round",
            pr_url="https://github.com/unrelated/repo/pull/1",
            activity_url="https://github.com/claimant",
            claimant_address="0xclaimant000000000000000000000000000000",
            builder_github="claimant",
        )


def test_reusable_evidence_rejection_reverts():
    """
    CRITICAL: Verify that evidence cannot be reused across claims or via alternate URL forms.
    """
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="evidence-round",
        title="Evidence Round",
        description="Testing single-use evidence",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        target_repo="dotmantissa/themis",
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Merged PR", "merged": True, "user": {"login": "builder1"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    # 1. First submission succeeds
    mock_gl.message = MockSender(address="0xbuilder11111111111111111111111111111111", value=100000000000000000)
    contract.submit_grant_claim(
        claim_id="claim-first",
        round_id="evidence-round",
        pr_url="https://github.com/dotmantissa/themis/pull/10",
        activity_url="https://github.com/builder1",
        claimant_address="0xbuilder11111111111111111111111111111111",
        builder_github="builder1",
    )

    # 2. Second submission with exact same URL -> must revert
    with pytest.raises(ValueError, match="Evidence already used"):
        contract.submit_grant_claim(
            claim_id="claim-second-exact",
            round_id="evidence-round",
            pr_url="https://github.com/dotmantissa/themis/pull/10",
            activity_url="https://github.com/builder2",
            claimant_address="0xbuilder22222222222222222222222222222222",
            builder_github="builder2",
        )

    # 3. Third submission with API format -> must also revert (same canonical evidence)
    with pytest.raises(ValueError, match="Evidence already used"):
        contract.submit_grant_claim(
            claim_id="claim-third-api",
            round_id="evidence-round",
            pr_url="https://api.github.com/repos/dotmantissa/themis/pulls/10",
            activity_url="https://github.com/builder3",
            claimant_address="0xbuilder33333333333333333333333333333333",
            builder_github="builder3",
        )


def test_prevent_settle_appealed_claim():
    """
    CRITICAL: Verify that an appealed claim CANNOT be settled.
    """
    contract = create_test_contract()
    dao_addr = "0xdao1111111111111111111111111111111111111"
    claimant_addr = "0xclaimant44444444444444444444444444444444"

    mock_gl.message = MockSender(address=dao_addr, value=5000000000000000000)
    contract.create_round(
        round_id="appeal-settle-round",
        title="Appeal Settle Round",
        description="Testing appeal block on settlement",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=120,
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "Fix", "merged": True, "user": {"login": "claimant444"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    mock_gl.message = MockSender(address=claimant_addr, value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.submit_grant_claim(
        claim_id="claim-to-appeal",
        round_id="appeal-settle-round",
        pr_url="https://github.com/org/repo/pull/50",
        activity_url="https://github.com/claimant444",
        claimant_address=claimant_addr,
        builder_github="claimant444",
    )

    # Register appeal at t+30s
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:30Z"}
    contract.appeal_claim("claim-to-appeal", "Disputing adjudication terms and scope")

    # Fast forward past original finality window (t+150s)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:02:30Z"}

    # Settle MUST fail because claim is in APPEALED state
    with pytest.raises(ValueError, match="Cannot settle non-final claim in 'APPEALED' state"):
        contract.settle_claim("claim-to-appeal")

    # Preview settlement also reports cannot settle
    preview = json.loads(contract.preview_settlement("claim-to-appeal"))
    assert preview["is_appealed"] is True
    assert preview["can_settle_now"] is False


def test_prevent_settle_non_final_claim():
    """
    CRITICAL: Verify that a claim still in its finality window cannot be settled.
    """
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="timelock-round",
        title="Timelock Round",
        description="Testing timelock enforcement",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=3600,  # 1 hour
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR", "merged": True, "user": {"login": "user"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    mock_gl.message = MockSender(address="0xuser1111111111111111111111111111111111", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.submit_grant_claim(
        claim_id="non-final-claim",
        round_id="timelock-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/user",
        claimant_address="0xuser1111111111111111111111111111111111",
        builder_github="user",
    )

    # 10 minutes in (non-final) -> settlement MUST revert
    mock_gl.message_raw = {"datetime": "2026-09-22T10:10:00Z"}
    with pytest.raises(ValueError, match="non-final claims cannot be settled"):
        contract.settle_claim("non-final-claim")


def test_prevent_finalize_round_with_appealed_claim():
    """
    CRITICAL: Verify that finalize_round_payouts reverts if any claim is currently appealed.
    """
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=2000000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.create_round(
        round_id="finalize-appeal-round",
        title="Finalize Appeal Test",
        description="Round with appeal",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=60,
        duration_seconds=3600,
        reward_recipients_count=1,
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR", "merged": True, "user": {"login": "dev"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC", "strength_score": 90})

    mock_gl.message = MockSender(address="0xdev11111111111111111111111111111111111", value=100000000000000000)
    contract.submit_grant_claim(
        claim_id="claim-appeal-round",
        round_id="finalize-appeal-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/dev",
        claimant_address="0xdev11111111111111111111111111111111111",
        builder_github="dev",
    )

    # Appeal is registered
    contract.appeal_claim("claim-appeal-round", "Wait, check my other contributions!")

    # Advance time past round deadline (11:05:00Z)
    mock_gl.message_raw = {"datetime": "2026-09-22T11:05:00Z"}

    # Attempting to finalize round with an active appeal MUST revert
    with pytest.raises(ValueError, match="Cannot finalize round: Claim 'claim-appeal-round' has an active appeal pending"):
        contract.finalize_round_payouts("finalize-appeal-round")


def test_prevent_finalize_round_with_non_final_claim():
    """
    CRITICAL: Verify that finalize_round_payouts reverts if a claim submitted near the deadline
    is still in its appeal timelock window.
    """
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=2000000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.create_round(
        round_id="finalize-nonfinal-round",
        title="Finalize Nonfinal Test",
        description="Round with late claim",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=1800,  # 30 min finality
        duration_seconds=3600,        # 1 hour duration
        reward_recipients_count=1,
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR", "merged": True, "user": {"login": "latedev"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC", "strength_score": 90})

    # Submitted at 10:55:00Z (5 minutes before round expiry, but finality window runs until 11:25:00Z)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:55:00Z"}
    mock_gl.message = MockSender(address="0xlatedev0000000000000000000000000000000", value=100000000000000000)
    contract.submit_grant_claim(
        claim_id="late-claim-01",
        round_id="finalize-nonfinal-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/latedev",
        claimant_address="0xlatedev0000000000000000000000000000000",
        builder_github="latedev",
    )

    # At 11:05:00Z, round deadline has passed, but claim appeal window (expires 11:25:00Z) is non-final!
    mock_gl.message_raw = {"datetime": "2026-09-22T11:05:00Z"}
    with pytest.raises(ValueError, match="Cannot finalize round: Claim 'late-claim-01' is non-final"):
        contract.finalize_round_payouts("finalize-nonfinal-round")


def test_top_ranking_projects_share_pool_at_deadline():
    contract = create_test_contract()
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
    mock_pr_response.body = json.dumps({"title": "PR merged", "merged": True, "user": {"login": "user"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>contributions</html>")

    # 1. Project A: High strength score (95)
    mock_gl.message = MockSender(address="0xclaimantA000000000000000000000000000000", value=100000000000000000)
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
        claimant_address="0xclaimantA000000000000000000000000000000",
        builder_github="user",
    )
    assert json.loads(res_a)["status"] == "ADJUDICATED"

    # 2. Project B: Good strength score (82)
    mock_gl.message = MockSender(address="0xclaimantB000000000000000000000000000000", value=100000000000000000)
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
        claimant_address="0xclaimantB000000000000000000000000000000",
        builder_github="user",
    )
    assert json.loads(res_b)["status"] == "ADJUDICATED"

    # 3. Project C: Runner up strength score (65)
    mock_gl.message = MockSender(address="0xclaimantC000000000000000000000000000000", value=100000000000000000)
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
        claimant_address="0xclaimantC000000000000000000000000000000",
        builder_github="user",
    )
    assert json.loads(res_c)["status"] == "ADJUDICATED"

    # 4. Project D: Sybil Fraud
    mock_gl.message = MockSender(address="0xclaimantD000000000000000000000000000000", value=100000000000000000)
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
        claimant_address="0xclaimantD000000000000000000000000000000",
        builder_github="user",
    )
    assert json.loads(res_d)["status"] == "ADJUDICATED"

    # Advance time past deadline and finality window (11:05:00Z) and finalize payouts
    mock_gl.message_raw = {"datetime": "2026-09-22T11:05:00Z"}
    final_res = json.loads(contract.finalize_round_payouts("top-ranking-round"))
    assert final_res["status"] == "SETTLED"
    assert final_res["winners_count"] == 2
    assert "claim-a" in final_res["winning_claim_ids"]
    assert "claim-b" in final_res["winning_claim_ids"]
    assert final_res["runners_up_count"] == 1

    claim_a = json.loads(contract.get_claim("claim-a"))
    assert claim_a["status"] == "SETTLED"
    assert claim_a["verdict"] == "APPROVED"
    assert claim_a["rank"] == 1

    claim_b = json.loads(contract.get_claim("claim-b"))
    assert claim_b["status"] == "SETTLED"
    assert claim_b["verdict"] == "APPROVED"
    assert claim_b["rank"] == 2

    claim_c = json.loads(contract.get_claim("claim-c"))
    assert claim_c["status"] == "REFUNDED"
    assert claim_c["verdict"] == "HONEST_RUNNER_UP"
    assert claim_c["rank"] == 3

    claim_d = json.loads(contract.get_claim("claim-d"))
    assert claim_d["status"] == "SLASHED"
    assert claim_d["verdict"] == "REJECTED_SYBIL_FRAUD"


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

    mock_gl.message = MockSender(address="0xdao", value=3000000000000000000)
    dep_res = json.loads(contract.deposit_round_funds("deposit-test-round"))
    assert dep_res["new_pool_wei"] == "4000000000000000000"
    assert dep_res["new_remaining_pool_wei"] == "4000000000000000000"


def test_preview_settlement_reflects_appealed_and_non_final_status():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="preview-round",
        title="Preview Round",
        description="Testing preview_settlement",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
        finality_window_seconds=120,
    )

    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR", "merged": True, "user": {"login": "user"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    mock_gl.message = MockSender(address="0xuser000000000000000000000000000000000001", value=100000000000000000)
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:00Z"}
    contract.submit_grant_claim(
        claim_id="preview-claim-1",
        round_id="preview-round",
        pr_url="https://github.com/org/repo/pull/1",
        activity_url="https://github.com/user",
        claimant_address="0xuser000000000000000000000000000000000001",
        builder_github="user",
    )

    # 1. Non-final state check
    mock_gl.message_raw = {"datetime": "2026-09-22T10:00:30Z"}
    p1 = json.loads(contract.preview_settlement("preview-claim-1"))
    assert p1["is_final"] is False
    assert p1["is_appealed"] is False
    assert p1["can_settle_now"] is False
    assert p1["seconds_until_finality"] > 0

    # 2. Appealed state check
    contract.appeal_claim("preview-claim-1", "Contesting adjudication scope")
    p2 = json.loads(contract.preview_settlement("preview-claim-1"))
    assert p2["is_appealed"] is True
    assert p2["can_settle_now"] is False

    # 3. Fast-forward past window while still appealed
    mock_gl.message_raw = {"datetime": "2026-09-22T10:05:00Z"}
    p3 = json.loads(contract.preview_settlement("preview-claim-1"))
    assert p3["is_appealed"] is True
    assert p3["can_settle_now"] is False

    # 4. Resolve appeal -> can_settle becomes True
    mock_gl.message = MockSender(address=contract.owner, value=0)
    contract.resolve_appeal("preview-claim-1", "APPROVED", "Appeal upheld by governor")
    p4 = json.loads(contract.preview_settlement("preview-claim-1"))
    assert p4["is_appealed"] is False
    assert p4["is_final"] is True
    assert p4["can_settle_now"] is True


def test_evidence_used_registry_query():
    contract = create_test_contract()
    mock_gl.message = MockSender(address="0xdao", value=5000000000000000000)
    contract.create_round(
        round_id="lookup-round",
        title="Lookup Round",
        description="Testing is_evidence_used",
        grant_amount_wei=1000000000000000000,
        required_bond_wei=100000000000000000,
    )

    # Query unused evidence
    res1 = json.loads(contract.is_evidence_used("https://github.com/dotmantissa/themis/pull/999"))
    assert res1["is_used"] is False

    # Submit claim
    mock_pr_response = MagicMock()
    mock_pr_response.body = json.dumps({"title": "PR", "merged": True, "user": {"login": "user"}}).encode("utf-8")
    mock_gl.nondet.web.get = MagicMock(return_value=mock_pr_response)
    mock_gl.nondet.web.render = MagicMock(return_value="<html>Profile</html>")
    mock_gl.nondet.exec_prompt = MagicMock(return_value={"sybil_score": 10, "fraud_detected": False, "sybil_tier": "ORGANIC"})

    mock_gl.message = MockSender(address="0xuser000000000000000000000000000000000001", value=100000000000000000)
    contract.submit_grant_claim(
        claim_id="lookup-claim",
        round_id="lookup-round",
        pr_url="https://github.com/dotmantissa/themis/pull/999",
        activity_url="https://github.com/user",
        claimant_address="0xuser000000000000000000000000000000000001",
        builder_github="user",
    )

    # Query now-used evidence
    res2 = json.loads(contract.is_evidence_used("https://github.com/dotmantissa/themis/pull/999"))
    assert res2["is_used"] is True
    assert res2["claim_id"] == "lookup-claim"

    # Query with API URL variant
    res3 = json.loads(contract.is_evidence_used("https://api.github.com/repos/dotmantissa/themis/pulls/999"))
    assert res3["is_used"] is True
    assert res3["claim_id"] == "lookup-claim"

