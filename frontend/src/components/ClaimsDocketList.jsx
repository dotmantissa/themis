import React, { useState } from "react";
import { useThemis } from "../context/ThemisContext";
import {
  FileCode,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";

export function ClaimsDocketList({ onSelectClaim }) {
  const { claims, selectedClaim, setSelectedClaim } = useThemis();
  const [filter, setFilter] = useState("ALL");

  const filteredClaims = claims.filter((claim) => {
    if (filter === "APPROVED") return claim.verdict === "APPROVED";
    if (filter === "FRAUD") return claim.verdict === "REJECTED_SYBIL_FRAUD";
    if (filter === "UNMERGED") return claim.verdict === "REJECTED_PR_NOT_MERGED";
    if (filter === "APPEALED") return claim.is_appealed || claim.status === "APPEALED";
    return true;
  });

  const getVerdictBadge = (verdict, isAppealed) => {
    if (isAppealed) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Clock className="w-3 h-3" />
          APPEALED
        </span>
      );
    }
    if (verdict === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#d4f717]/20 text-[#d4f717] border border-[#d4f717]/40">
          <ShieldCheck className="w-3 h-3" />
          APPROVED
        </span>
      );
    }
    if (verdict === "REJECTED_SYBIL_FRAUD") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
          <ShieldAlert className="w-3 h-3" />
          SLASHED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
        <AlertTriangle className="w-3 h-3" />
        UNMERGED
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header and filter pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <span>Evidence Docket Ribbon</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#5a38fd]/30 text-[#d4f717]">
              {claims.length}
            </span>
          </h2>
          <p className="text-xs text-[#a3a3cf]">
            Live ledger of claimant dossiers adjudicated by GenLayer validators
          </p>
        </div>

        {/* Filter buttons without banned fragment format */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "ALL", label: "All" },
            { key: "APPROVED", label: "Approved" },
            { key: "FRAUD", label: "Fraud Slashed" },
            { key: "UNMERGED", label: "Unmerged" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium action-btn whitespace-nowrap ${
                filter === tab.key
                  ? "bg-[#5a38fd] text-white shadow-sm"
                  : "bg-[#24244f]/60 text-[#a3a3cf] hover:text-white hover:bg-[#2d2d5e]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredClaims.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#1d1d42]/60 border border-[#3b3b6d]/40">
          <p className="text-sm text-[#a3a3cf]">
            No claims found under this filter. Submit a completed GitHub pull request to see the live two-tier verdict in action.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredClaims.map((claim) => {
            const isSelected = selectedClaim?.claim_id === claim.claim_id;
            return (
              <div
                key={claim.claim_id}
                onClick={() => {
                  setSelectedClaim(claim);
                  if (onSelectClaim) onSelectClaim(claim);
                }}
                className={`p-3.5 rounded-xl cursor-pointer border transition-all duration-150 action-btn flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-[#2d2d5e] border-[#5a38fd] shadow-md shadow-[#5a38fd]/20"
                    : "bg-[#1d1d42]/70 hover:bg-[#252554] border-[#3b3b6d]/50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#24244f] border border-[#3b3b6d]/60 flex items-center justify-center shrink-0">
                    <FileCode className="w-4 h-4 text-[#d4f717]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white truncate">
                        {claim.claim_id}
                      </span>
                      {getVerdictBadge(claim.verdict, claim.is_appealed)}
                    </div>
                    <p className="text-[11px] text-[#a3a3cf] truncate mt-0.5">
                      Round: {claim.round_id} &bull; Sybil Risk:{" "}
                      <span className="font-mono text-[#d4f717]">
                        {claim.tier2_sybil_score ?? 0}/100
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-semibold text-white hidden sm:inline">
                    {claim.tier1_pr_merged ? "PR Merged" : "PR Pending"}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 ${
                      isSelected ? "text-[#d4f717]" : "text-[#a3a3cf]"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
