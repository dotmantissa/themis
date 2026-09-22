import React, { useState } from "react";
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
} from "lucide-react";

export function ClaimSubmissionModal({ isOpen, onClose }) {
  const { rounds, selectedRound, submitClaim, submitting, authenticated, login } = useThemis();

  const [roundId, setRoundId] = useState(selectedRound?.round_id || (rounds[0] ? rounds[0].round_id : ""));
  const [claimId, setClaimId] = useState(() => `claim-${Math.random().toString(36).substring(2, 9)}`);
  const [prUrl, setPrUrl] = useState("https://github.com/torvalds/linux/pull/101");
  const [activityUrl, setActivityUrl] = useState("https://github.com/torvalds");
  const [screenshotUrl, setScreenshotUrl] = useState("https://picsum.photos/seed/themis-claim/800/600");
  const [notes, setNotes] = useState("Implemented core protocol optimizations and passed regression tests.");
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const currentRound = rounds.find((r) => r.round_id === roundId) || selectedRound || rounds[0];
  const isExhausted =
    currentRound?.status === "EXHAUSTED" ||
    BigInt(currentRound?.remaining_pool_wei || "0") < BigInt(currentRound?.grant_amount_wei || "0");
  const isExpired =
    currentRound?.status === "EXPIRED" ||
    (currentRound?.expires_at && new Date(currentRound.expires_at).getTime() <= Date.now());
  const isClosed = isExhausted || isExpired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isClosed) {
      setError(
        isExhausted
          ? "This grant round pool is exhausted. No further claims can be submitted."
          : "This grant round timeline has elapsed. Applications are closed."
      );
      return;
    }

    if (!prUrl.trim() || !activityUrl.trim()) {
      setError("Please provide both your pull request link and your activity graph source.");
      return;
    }

    try {
      await submitClaim({
        claimId: claimId.trim(),
        roundId: roundId || currentRound?.round_id,
        prUrl: prUrl.trim(),
        activityUrl: activityUrl.trim(),
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
              <GitMerge className="w-5 h-5 text-[#d4f717]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Submit Grant Claim</h2>
              <p className="text-xs text-[#a3a3cf]">
                Evaluated by GenLayer validators using dual web evidence
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

          {/* Target Round Picker */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
              Select Grant Round
            </label>
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
                {isExhausted
                  ? "This grant round pool is exhausted. No further claims can be submitted."
                  : "This grant round timeline has elapsed. Applications are closed."}
              </span>
            </div>
          )}

          {/* Claim Identifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Refundable Bond
              </label>
              <div className="px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-[#d4f717] font-mono text-xs flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>0.01 GEN (Refunded if honest)</span>
              </div>
            </div>
          </div>

          {/* Evidence 1: Static PR URL */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <GitMerge className="w-3.5 h-3.5 text-[#d4f717]" />
                Pull Request URL (Tier 1 Merge Check)
              </span>
              <span className="text-[10px] text-[#5a38fd] font-bold">gl.nondet.web.get</span>
            </label>
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/org/repo/pull/123"
              required
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs font-mono focus:outline-none focus:border-[#d4f717]"
            />
            <p className="text-[11px] text-[#a3a3cf] mt-1">
              Validators pull raw JSON commit state to verify merge status deterministically.
            </p>
          </div>

          {/* Evidence 2: Dynamic Activity URL */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#5a38fd]" />
                Claimant Activity / Graph Source (Tier 2 Sybil Analysis)
              </span>
              <span className="text-[10px] text-[#d4f717] font-bold">gl.nondet.web.render</span>
            </label>
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
              Claim Justification and Deliverables
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain how this contribution satisfies the grant specifications..."
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs focus:outline-none focus:border-[#d4f717] resize-none"
            />
          </div>

          {/* Security & Sybil Disclaimer Box */}
          <div className="p-3 rounded-xl bg-[#5a38fd]/10 border border-[#5a38fd]/30 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#d4f717]" />
              <span>Gasless Relayer and Protocol Bonding</span>
            </div>
            <p className="text-[#a3a3cf] leading-relaxed text-[11px]">
              All GenLayer transactions are abstracted through our server relayer. Your 0.01 GEN bond is held in the Intelligent Contract. If your claim passes consensus, your bond is returned with your grant payout. If consensus flags a sybil cluster, the bond is forfeited to the community dispute pool.
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
              disabled={submitting || isClosed}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg action-btn flex items-center gap-2 ${
                submitting || isClosed
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#d4f717] to-[#bfe010] text-[#24244f] hover:shadow-[#d4f717]/20"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isClosed
                  ? isExhausted
                    ? "Round Pool Exhausted"
                    : "Timeline Elapsed"
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
