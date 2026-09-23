import React, { useState, useEffect } from "react";
import { useThemis } from "../context/ThemisContext";
import {
  X,
  GitMerge,
  Globe,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
  Coins,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Lock,
  User,
  Github,
} from "lucide-react";

export function ClaimSubmissionModal({ isOpen, onClose }) {
  const {
    rounds,
    selectedRound,
    submitClaim,
    submitting,
    authenticated,
    login,
    userWalletAddress,
    checkEvidence,
  } = useThemis();

  const [roundId, setRoundId] = useState(selectedRound?.round_id || (rounds[0] ? rounds[0].round_id : ""));
  const [claimId, setClaimId] = useState(() => `claim-${Math.random().toString(36).substring(2, 9)}`);
  const [claimantAddress, setClaimantAddress] = useState(userWalletAddress || "");
  const [builderGithub, setBuilderGithub] = useState("dotmantissa");
  const [prUrl, setPrUrl] = useState("https://github.com/dotmantissa/themis/pull/1");
  const [activityUrl, setActivityUrl] = useState("https://github.com/dotmantissa");
  const [screenshotUrl, setScreenshotUrl] = useState("https://picsum.photos/seed/themis-claim/800/600");
  const [notes, setNotes] = useState("Implemented verified contribution provenance and user-bound custody.");
  const [error, setError] = useState(null);
  const [evidenceWarning, setEvidenceWarning] = useState(null);

  useEffect(() => {
    if (selectedRound?.round_id) {
      setRoundId(selectedRound.round_id);
    } else if (rounds.length > 0 && !roundId) {
      setRoundId(rounds[0].round_id);
    }
  }, [selectedRound, isOpen, rounds]);

  useEffect(() => {
    if (userWalletAddress && !claimantAddress) {
      setClaimantAddress(userWalletAddress);
    }
  }, [userWalletAddress]);

  // Live pre-flight evidence deduplication check
  useEffect(() => {
    let active = true;
    if (!prUrl || !prUrl.startsWith("http")) {
      setEvidenceWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (checkEvidence) {
        const res = await checkEvidence(prUrl);
        if (active && res?.is_used) {
          setEvidenceWarning(
            `Evidence already claimed: PR has already been used on-chain in claim '${res.claim_id}'. Evidence cannot be reused.`
          );
        } else if (active) {
          setEvidenceWarning(null);
        }
      }
    }, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [prUrl, checkEvidence]);

  if (!isOpen) return null;

  const currentRound = rounds.find((r) => r.round_id === roundId) || selectedRound || rounds[0];
  const isSettled = currentRound?.status === "SETTLED";
  const isExpired =
    currentRound?.status === "EXPIRED" ||
    (currentRound?.expires_at && new Date(currentRound.expires_at).getTime() <= Date.now());
  const isClosed = isSettled || isExpired;
  const targetRepo = currentRound?.target_repo || "";

  // Check if PR URL matches target repository
  let repoMismatch = false;
  if (targetRepo && prUrl) {
    const m = prUrl.match(/(?:github\.com\/|api\.github\.com\/repos\/)([^/]+\/[^/#?]+)/i);
    const prRepo = m ? m[1].toLowerCase().replace(/\.git$/, "") : "";
    if (prRepo && prRepo !== targetRepo.toLowerCase()) {
      repoMismatch = true;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isClosed) {
      setError(
        isSettled
          ? "This grant round has already been settled and finalized."
          : "This grant round timeline has elapsed. Applications are closed."
      );
      return;
    }

    if (!claimantAddress || !claimantAddress.startsWith("0x")) {
      setError("Please provide a valid builder wallet address to enforce user-bound custody.");
      return;
    }

    if (!builderGithub.trim()) {
      setError("Please provide your GitHub username for contribution provenance verification.");
      return;
    }

    if (!prUrl.trim() || !activityUrl.trim()) {
      setError("Please provide both your pull request link and your activity graph source.");
      return;
    }

    if (repoMismatch) {
      setError(`PR must belong to the round's grant repository: '${targetRepo}'.`);
      return;
    }

    if (evidenceWarning) {
      setError("Reusable evidence rejected: This pull request has already been claimed on-chain.");
      return;
    }

    try {
      await submitClaim({
        claimId: claimId.trim(),
        roundId: roundId || currentRound?.round_id,
        prUrl: prUrl.trim(),
        activityUrl: activityUrl.trim(),
        claimantAddress: claimantAddress.trim(),
        builderGithub: builderGithub.trim(),
        screenshotUrl: screenshotUrl.trim(),
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit claim. Check your parameters.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#1d1d42] border border-[#3b3b6d] shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3b3b6d]/60 bg-[#24244f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#d4f717]/10 border border-[#d4f717]/30">
              <ShieldCheck className="w-5 h-5 text-[#d4f717]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Submit Grant Claim</h2>
              <p className="text-xs text-[#a3a3cf]">
                User-Bound Custody & Verified Contribution Provenance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a3a3cf] hover:text-white hover:bg-[#3b3b6d]/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {evidenceWarning && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{evidenceWarning}</span>
            </div>
          )}

          {/* Target Round Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-[#a3a3cf]">
                Select Grant Round
              </label>
              {targetRepo && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#5a38fd]/20 text-[#a3a3cf] border border-[#5a38fd]/40">
                  Target Repo: <strong className="text-white">{targetRepo}</strong>
                </span>
              )}
            </div>
            <select
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-sm focus:outline-none focus:border-[#d4f717]"
            >
              {rounds.map((r) => (
                <option key={r.round_id} value={r.round_id}>
                  {r.title} ({r.round_id})
                </option>
              ))}
            </select>
          </div>

          {isClosed && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {isSettled
                  ? "This grant round has already been settled and finalized."
                  : "This grant round timeline has elapsed. Applications are closed."}
              </span>
            </div>
          )}

          {/* User-Bound Custody Wallet */}
          <div className="p-3 rounded-xl bg-[#24244f] border border-[#5a38fd]/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#d4f717] font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>User-Bound Custody Address (Direct Payout Destination)</span>
              </label>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                User Custody
              </span>
            </div>
            <input
              type="text"
              value={claimantAddress}
              onChange={(e) => setClaimantAddress(e.target.value)}
              placeholder="0x... your EVM wallet address"
              required
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
            />
            <p className="text-[11px] text-[#a3a3cf]">
              Grant disbursements and bond refunds transfer directly to this address. Relayers never take custody.
            </p>
          </div>

          {/* Contribution Provenance: GitHub Username & Claim ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5 flex items-center gap-1">
                <Github className="w-3.5 h-3.5 text-white" />
                Builder GitHub Username
              </label>
              <input
                type="text"
                value={builderGithub}
                onChange={(e) => setBuilderGithub(e.target.value)}
                placeholder="e.g. dotmantissa"
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
              <p className="text-[10px] text-[#a3a3cf] mt-1">
                Validators verify that the PR author matches this builder identity.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Claim Identifier
              </label>
              <input
                type="text"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
            </div>
          </div>

          {/* Evidence 1: Static PR URL (Bound to Grant Repo) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-[#a3a3cf] flex items-center gap-1">
                <GitMerge className="w-3.5 h-3.5 text-[#d4f717]" />
                Pull Request URL (Single-Use Evidence)
              </label>
              <span className="text-[10px] text-[#5a38fd] font-bold">gl.nondet.web.get + strict_eq</span>
            </div>
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/dotmantissa/themis/pull/1"
              required
              className={`w-full px-3 py-2 rounded-xl bg-[#181836] border text-white text-xs font-mono focus:outline-none ${
                repoMismatch
                  ? "border-rose-500 focus:border-rose-400"
                  : evidenceWarning
                  ? "border-amber-500 focus:border-amber-400"
                  : "border-[#3b3b6d] focus:border-[#d4f717]"
              }`}
            />
            {repoMismatch ? (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Repository mismatch: PR must be submitted to &apos;{targetRepo}&apos;.
              </p>
            ) : (
              <p className="text-[11px] text-[#a3a3cf] mt-1">
                Checked against protocol single-use registry to permanently prevent replay attacks.
              </p>
            )}
          </div>

          {/* Evidence 2: Dynamic Activity URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-[#a3a3cf] flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#5a38fd]" />
                Claimant Activity / Graph Source (Tier 2 Sybil Analysis)
              </label>
              <span className="text-[10px] text-[#d4f717] font-bold">gl.nondet.web.render</span>
            </div>
            <input
              type="url"
              value={activityUrl}
              onChange={(e) => setActivityUrl(e.target.value)}
              placeholder="https://github.com/username or explorer profile"
              required
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs font-mono focus:outline-none focus:border-[#d4f717]"
            />
            <p className="text-[11px] text-[#a3a3cf] mt-1">
              Rendered with JavaScript execution to evaluate commit topology against sybil cluster patterns.
            </p>
          </div>

          {/* Supplementary Multimodal Screenshot Proof */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-[#d4f717]" />
              Supplementary Multimodal Proof URL (Optional)
            </label>
            <input
              type="url"
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              placeholder="https://... image of benchmark or deployment"
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs font-mono focus:outline-none focus:border-[#d4f717]"
            />
          </div>

          {/* Contributor Notes */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-white" />
              Claim Justification & Provenance Details
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain how this contribution satisfies the grant specifications..."
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs focus:outline-none focus:border-[#d4f717] resize-none"
            />
          </div>

          {/* Security & User-Bound Custody Disclaimer Box */}
          <div className="p-3 rounded-xl bg-[#5a38fd]/10 border border-[#5a38fd]/30 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#d4f717]" />
              <span>User-Bound Custody & Provenance Security</span>
            </div>
            <p className="text-[#a3a3cf] leading-relaxed text-[11px]">
              While our backend relayer sponsors the transaction broadcast, the on-chain intelligent contract enforces that your builder address ({claimantAddress?.substring(0, 8)}...) is the exclusive custody owner. Payouts and bond refunds flow directly to you.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#3b3b6d]/40 text-[#a3a3cf] hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || isClosed || repoMismatch || Boolean(evidenceWarning)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg action-btn flex items-center gap-2 ${
                submitting || isClosed || repoMismatch || Boolean(evidenceWarning)
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#d4f717] to-[#bfe010] text-[#24244f] hover:shadow-[#d4f717]/20"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isClosed
                  ? "Timeline Elapsed"
                  : repoMismatch
                  ? "Repo Mismatch"
                  : evidenceWarning
                  ? "Evidence Reused"
                  : submitting
                  ? "Adjudicating On-Chain..."
                  : "Submit Claim with Bond"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
