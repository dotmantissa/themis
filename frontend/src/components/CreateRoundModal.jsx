import React, { useState } from "react";
import { useThemis } from "../context/ThemisContext";
import {
  X,
  Layers,
  Coins,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Sparkles,
  PlusCircle,
} from "lucide-react";

export function CreateRoundModal({ isOpen, onClose }) {
  const { createRound, submitting } = useThemis();

  const [roundId, setRoundId] = useState(() => `round-${Math.random().toString(36).substring(2, 7)}`);
  const [title, setTitle] = useState("Open Protocol Infrastructure Grant");
  const [description, setDescription] = useState("Empowering independent developers building decentralized tooling, client libraries, and consensus infrastructure.");
  const [grantAmountGen, setGrantAmountGen] = useState("0.1");
  const [bondAmountGen, setBondAmountGen] = useState("0.01");
  const [poolDepositGen, setPoolDepositGen] = useState("0.5");
  const [finalityHours, setFinalityHours] = useState("1");
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!roundId.trim() || !title.trim()) {
      setError("Please specify both a round identifier and title.");
      return;
    }

    try {
      const finalitySeconds = Math.max(60, Math.round(parseFloat(finalityHours || "1") * 3600));
      await createRound({
        roundId: roundId.trim(),
        title: title.trim(),
        description: description.trim(),
        grantAmountGen: grantAmountGen.trim(),
        bondAmountGen: bondAmountGen.trim(),
        poolDepositGen: poolDepositGen.trim(),
        finalitySeconds,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create round.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#1d1d42] border border-[#3b3b6d] shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3b3b6d]/60 bg-[#24244f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#5a38fd]/15 border border-[#5a38fd]/30">
              <Layers className="w-5 h-5 text-[#d4f717]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create DAO Grant Round</h2>
              <p className="text-xs text-[#a3a3cf]">
                Deterministic escrow pool with optimistic validator arbitration
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

          {/* Round Identifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Round Unique Identifier
              </label>
              <input
                type="text"
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Total Pool Deposit (GEN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={poolDepositGen}
                onChange={(e) => setPoolDepositGen(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-[#d4f717] font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
              Round Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs focus:outline-none focus:border-[#d4f717]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
              Round Objective and Scope
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white text-xs focus:outline-none focus:border-[#d4f717] resize-none"
            />
          </div>

          {/* Financial Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Grant Per Claim (GEN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={grantAmountGen}
                onChange={(e) => setGrantAmountGen(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Required Bond (GEN)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={bondAmountGen}
                onChange={(e) => setBondAmountGen(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#a3a3cf] mb-1.5">
                Dispute Window (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={finalityHours}
                onChange={(e) => setFinalityHours(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#181836] border border-[#3b3b6d] text-white font-mono text-xs focus:outline-none focus:border-[#d4f717]"
              />
            </div>
          </div>

          {/* Mechanics Callout */}
          <div className="p-3 rounded-xl bg-[#24244f]/80 border border-[#3b3b6d]/60 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-[#d4f717] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Native Ghost Custody Protection</span>
            </div>
            <p className="text-[#a3a3cf] leading-relaxed text-[11px]">
              Deposited round funds are held natively in the EVM ghost custody contract. Payouts are made through <code className="text-[#d4f717]">emit_transfer</code> upon settlement, safeguarding community capital against malicious drains.
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
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg action-btn flex items-center gap-2 ${
                submitting
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#d4f717] to-[#bfe010] text-[#24244f] hover:shadow-[#d4f717]/20"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{submitting ? "Funding Round On-Chain..." : "Fund Round Pool"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
