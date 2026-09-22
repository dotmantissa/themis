import React from "react";
import { useThemis } from "../context/ThemisContext";
import { Coins, ShieldCheck, Scale, ExternalLink } from "lucide-react";

export function RealtimeTreasuryMetrics() {
  const { metrics } = useThemis();

  const formatGen = (weiStr) => {
    try {
      const val = parseFloat(BigInt(weiStr || "0").toString()) / 1e18;
      return val.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
    } catch {
      return "0.000";
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#3b3b6d]/70 bg-gradient-to-br from-[#24244f] via-[#1a1a3d] to-[#161633] p-5 sm:p-7 shadow-2xl">
      {/* Top Telemetry Sync Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#3b3b6d]/40">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d4f717] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#d4f717]"></span>
          </span>
          <span className="text-xs font-mono font-semibold tracking-wide text-white uppercase">
            Realtime Escrow Treasury
          </span>
          <span className="text-[11px] font-mono text-[#a3a3cf] hidden sm:inline">
            Studio Chain 61999
          </span>
        </div>

        <a
          href="https://genlayer-explorer.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-mono text-[#d4f717] hover:underline flex items-center gap-1"
        >
          <span>Contract: 0x016A...eE39</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 3 Prominent Metrics Laid Out in a Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
        {/* Metric 1: Total Pool Governed */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#181836]/80 border border-[#3b3b6d]/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#a3a3cf]">
              Total Pool Governed
            </span>
            <div className="p-2 rounded-lg bg-[#5a38fd]/20 text-[#d4f717]">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-tight">
              {formatGen(metrics.total_pool_deposited_wei)}{" "}
              <span className="text-sm sm:text-base font-semibold text-[#a3a3cf]">
                GEN
              </span>
            </div>
            <p className="text-[11px] text-[#a3a3cf] mt-1.5">
              Active round deposits committed by DAOs
            </p>
          </div>
        </div>

        {/* Metric 2: Grants Disbursed */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#181836]/80 border border-[#3b3b6d]/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#a3a3cf]">
              Grants Disbursed
            </span>
            <div className="p-2 rounded-lg bg-[#5a38fd]/20 text-[#5a38fd]">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-tight">
              {formatGen(metrics.total_grants_disbursed_wei)}{" "}
              <span className="text-sm sm:text-base font-semibold text-[#a3a3cf]">
                GEN
              </span>
            </div>
            <p className="text-[11px] text-[#a3a3cf] mt-1.5">
              Settled payouts released to verified builders
            </p>
          </div>
        </div>

        {/* Metric 3: Dispute Bounty Pool */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#181836]/80 border border-[#3b3b6d]/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#a3a3cf]">
              Dispute Bounty Pool
            </span>
            <div className="p-2 rounded-lg bg-[#d4f717]/20 text-[#d4f717]">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-[#d4f717] tracking-tight">
              {formatGen(metrics.dispute_bounty_pool_wei)}{" "}
              <span className="text-sm sm:text-base font-semibold text-[#d4f717]/70">
                GEN
              </span>
            </div>
            <p className="text-[11px] text-[#a3a3cf] mt-1.5">
              Slashed sybil bonds reserved for arbiters
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
