import React from "react";
import { useThemis } from "../context/ThemisContext";
import { Coins, Shield, Clock, Users, PlusCircle, CheckCircle2 } from "lucide-react";

export function RoundsList({ onOpenCreateRound, onOpenSubmit }) {
  const { rounds, selectedRound, setSelectedRound, loading } = useThemis();

  const formatGen = (weiStr) => {
    try {
      const val = parseFloat(BigInt(weiStr || "0").toString()) / 1e18;
      return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
    } catch {
      return "0";
    }
  };

  const formatRemainingDuration = (expiresAt) => {
    if (!expiresAt) return "Perpetual duration";
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return "Timeline elapsed";
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h remaining`;
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <span>Active Grant Rounds</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#5a38fd]/30 text-[#d4f717]">
              {rounds.length}
            </span>
          </h2>
          <p className="text-xs text-[#a3a3cf]">
            Choose an open pool to inspect or submit your completed milestones
          </p>
        </div>

        <button
          onClick={onOpenCreateRound}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5a38fd]/20 hover:bg-[#5a38fd]/40 border border-[#5a38fd]/50 text-xs font-semibold text-white action-btn"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#d4f717]" />
          <span>New Round</span>
        </button>
      </div>

      {loading && rounds.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#1d1d42]/60 border border-[#3b3b6d]/40">
          <div className="animate-spin w-6 h-6 border-2 border-[#d4f717] border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-xs font-mono text-[#a3a3cf]">Fetching on-chain round pools...</p>
        </div>
      ) : rounds.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#1d1d42]/60 border border-[#3b3b6d]/40 space-y-3">
          <p className="text-sm text-[#a3a3cf]">
            No active rounds found on-chain. Be the first DAO patron to fund a grant pool!
          </p>
          <button
            onClick={onOpenCreateRound}
            className="px-4 py-2 rounded-xl bg-[#d4f717] text-[#24244f] font-bold text-xs action-btn"
          >
            Launch Genesis Round
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const isSelected = selectedRound?.round_id === round.round_id;
            const isExhausted =
              round.status === "EXHAUSTED" ||
              BigInt(round.remaining_pool_wei || "0") < BigInt(round.grant_amount_wei || "0");
            const isExpired =
              round.status === "EXPIRED" ||
              (round.expires_at && new Date(round.expires_at).getTime() <= Date.now());
            const isOpen = round.status === "OPEN" && !isExhausted && !isExpired;

            return (
              <div
                key={round.round_id}
                onClick={() => setSelectedRound(round)}
                className={`p-4 rounded-xl cursor-pointer border transition-all duration-150 action-btn ${
                  isSelected
                    ? "bg-[#2d2d5e] border-[#d4f717] shadow-md shadow-[#d4f717]/10"
                    : "bg-[#1d1d42]/70 hover:bg-[#252554] border-[#3b3b6d]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
                      <span>{round.title}</span>
                      {isSelected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#d4f717]" />
                      )}
                    </h3>
                    <p className="text-xs text-[#a3a3cf] font-mono mt-0.5">
                      {round.round_id}
                    </p>
                  </div>

                  {isExhausted ? (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      POOL EXHAUSTED
                    </span>
                  ) : isExpired ? (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      TIMELINE ELAPSED
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#d4f717]/15 text-[#d4f717] border border-[#d4f717]/30">
                      OPEN
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#a3a3cf] line-clamp-2 mb-3">
                  {round.description || "Grant funding for verified contributions."}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#3b3b6d]/40 text-center">
                  <div className="p-1.5 rounded bg-[#181836]/60">
                    <p className="text-[10px] text-[#a3a3cf]">Available Pool</p>
                    <p className="text-xs font-mono font-bold text-[#d4f717]">
                      {formatGen(round.remaining_pool_wei)} GEN
                    </p>
                  </div>

                  <div className="p-1.5 rounded bg-[#181836]/60">
                    <p className="text-[10px] text-[#a3a3cf]">Grant Payout</p>
                    <p className="text-xs font-mono font-semibold text-white">
                      {formatGen(round.grant_amount_wei)} GEN
                    </p>
                  </div>

                  <div className="p-1.5 rounded bg-[#181836]/60">
                    <p className="text-[10px] text-[#a3a3cf]">Required Bond</p>
                    <p className="text-xs font-mono font-semibold text-[#a3a3cf]">
                      {formatGen(round.bond_amount_wei)} GEN
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#a3a3cf] flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-[#d4f717]" />
                      <span>{formatRemainingDuration(round.expires_at)}</span>
                    </span>

                    {isOpen ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSubmit();
                        }}
                        className="px-3 py-1 rounded-lg bg-[#d4f717] hover:bg-[#bfe010] text-[#24244f] text-xs font-bold action-btn"
                      >
                        Submit to this Round
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-3 py-1 rounded-lg bg-[#181836] border border-[#3b3b6d] text-[#a3a3cf] text-xs font-semibold cursor-not-allowed opacity-75"
                      >
                        {isExhausted ? "Pool Exhausted" : "Applications Closed"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
