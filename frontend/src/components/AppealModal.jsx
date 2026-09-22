import React, { useState } from "react";
import { useThemis } from "../context/ThemisContext";
import {
  X,
  Scale,
  AlertOctagon,
  Clock,
  CheckCircle2,
} from "lucide-react";

export function AppealModal({ isOpen, onClose, claim }) {
  const { appealClaim, submitting } = useThemis();
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);

  if (!isOpen || !claim) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Please describe the basis for your dispute or appeal.");
      return;
    }

    try {
      await appealClaim(claim.claim_id, reason.trim());
      onClose();
    } catch (err) {
      setError(err.message || "Failed to register appeal on-chain.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#1d1d42] border border-[#3b3b6d] shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3b3b6d]/60 bg-[#24244f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
              <Scale className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dispute Consensus Verdict</h2>
              <p className="text-xs text-[#a3a3cf]">
                Freeze settlement during native finality window
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
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Claim Summary */}
          <div className="p-3 rounded-xl bg-[#181836] border border-[#3b3b6d] space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a3a3cf]">Claim Docket:</span>
              <span className="text-white font-bold">{claim.claim_id}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a3a3cf]">Current Status:</span>
              <span className="text-[#d4f717]">{claim.verdict} ({claim.status})</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a3a3cf]">Claimant:</span>
              <span className="text-white truncate max-w-[200px]">{claim.claimant}</span>
            </div>
          </div>

          {/* Appeal Reason */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
              Grounds for Dispute
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide evidence demonstrating why the previous consensus verdict was in error or pointing to legitimate human contribution history..."
              required
              className="w-full px-3 py-2.5 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs focus:outline-none focus:border-[#d4f717] resize-none leading-relaxed"
            />
          </div>

          {/* Legal / Protocol Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-[#a3a3cf] leading-relaxed">
              <strong className="text-white">Escrow Finality Freeze:</strong> Registering an appeal marks this claim status as <code className="text-amber-300">APPEALED</code>. Settlement payouts and bond slashes are locked until GenLayer validators review the dispute evidence.
            </div>
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
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg action-btn flex items-center gap-2 ${
                submitting
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-amber-400 hover:bg-amber-300 text-[#181836]"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? "Freezing Settlement..." : "Confirm and Freeze Dispute"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
