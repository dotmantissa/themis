import React from "react";
import { useThemis } from "../context/ThemisContext";
import {
  Scale,
  ShieldCheck,
  Flame,
  GitMerge,
  Layers,
  Sparkles,
  ArrowDownCircle,
} from "lucide-react";

export function BalanceScaleHero({ onOpenSubmit, onOpenCreateRound }) {
  const { metrics, rounds, claims } = useThemis();

  const formatGen = (weiStr) => {
    try {
      const val = parseFloat(BigInt(weiStr || "0").toString()) / 1e18;
      return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
    } catch {
      return "0";
    }
  };

  const poolGen = parseFloat(formatGen(metrics.total_pool_deposited_wei));
  const slashedGen = parseFloat(formatGen(metrics.dispute_bounty_pool_wei));

  // Determine tilt angle based on ratio (max tilt 10 degrees)
  let tiltDegrees = 0;
  if (poolGen > 0 || slashedGen > 0) {
    const total = poolGen + slashedGen;
    const diff = poolGen - slashedGen;
    tiltDegrees = Math.max(-10, Math.min(10, (diff / (total || 1)) * 8));
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#3b3b6d]/60 bg-gradient-to-br from-[#24244f] via-[#1d1d42] to-[#181836] p-6 lg:p-8 shadow-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Mission, Rationale, and Action Buttons */}
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4f717]/15 border border-[#d4f717]/30 text-xs font-mono text-[#d4f717]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GenLayer Optimistic Democracy</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white leading-tight">
            Fair grant escrows without bot farms or fake identities.
          </h1>

          <p className="text-sm sm:text-base text-[#a3a3cf] leading-relaxed">
            DAOs deposit real GEN into audited round pools. Honest builders post a refundable bond with proof of merged pull requests. GenLayer independent validators fetch your git record and inspect your activity graphs to filter out sybil clusters. Honest work pays out instantly; sybil farmers get their bonds slashed.
          </p>

          {/* Core Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenSubmit}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4f717] to-[#bfe010] text-[#24244f] font-bold text-sm shadow-lg hover:shadow-[#d4f717]/20 action-btn flex items-center gap-2"
            >
              <GitMerge className="w-4 h-4 text-[#24244f]" />
              <span>Submit Grant Claim</span>
            </button>

            <button
              onClick={onOpenCreateRound}
              className="px-5 py-2.5 rounded-xl bg-[#2d2d5e]/90 hover:bg-[#3b3b6d] text-white font-semibold text-sm border border-[#3b3b6d] action-btn flex items-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#d4f717]" />
              <span>Create DAO Round</span>
            </button>
          </div>

          {/* Feature Highlights Ribbon */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#3b3b6d]/40">
            <div>
              <p className="text-[11px] text-[#a3a3cf]">Static PR Verification</p>
              <p className="text-xs font-mono font-medium text-white">gl.nondet.web.get</p>
            </div>
            <div>
              <p className="text-[11px] text-[#a3a3cf]">DOM Activity Render</p>
              <p className="text-xs font-mono font-medium text-white">gl.nondet.web.render</p>
            </div>
            <div>
              <p className="text-[11px] text-[#a3a3cf]">Sybil Fraud Principle</p>
              <p className="text-xs font-mono font-medium text-[#d4f717]">gl.eq_principle.prompt_non_comparative</p>
            </div>
          </div>
        </div>

        {/* Right Column: Themis Dual-Chamber Balance Scale */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-[#181836]/60 border border-[#3b3b6d]/40">
          <div className="w-full flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-mono text-[#a3a3cf] flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#d4f717]" />
              Live Custody Scale
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#5a38fd]/20 text-[#d4f717]">
              EVM Ghost Custody
            </span>
          </div>

          {/* Interactive SVG Scale Visualization */}
          <div className="relative w-full max-w-[280px] h-[190px] flex items-center justify-center">
            <svg viewBox="0 0 240 180" className="w-full h-full">
              {/* Stand / Pillar */}
              <line x1="120" y1="30" x2="120" y2="155" stroke="#3b3b6d" strokeWidth="4" strokeLinecap="round" />
              <line x1="120" y1="30" x2="120" y2="155" stroke="#5a38fd" strokeWidth="2" strokeLinecap="round" />
              <path d="M75 160 L165 160" stroke="#d4f717" strokeWidth="4" strokeLinecap="round" />

              {/* Fulcrum Bearing */}
              <circle cx="120" cy="32" r="7" fill="#24244f" stroke="#d4f717" strokeWidth="2.5" />
              <circle cx="120" cy="32" r="2.5" fill="#d4f717" />

              {/* Balance Beam (Animated Tilt) */}
              <g
                style={{
                  transformOrigin: "120px 32px",
                  transform: `rotate(${tiltDegrees}deg)`,
                  transition: "transform 0.4s ease",
                }}
              >
                {/* Horizontal Beam */}
                <line x1="30" y1="32" x2="210" y2="32" stroke="#5a38fd" strokeWidth="4" strokeLinecap="round" />
                <circle cx="30" cy="32" r="4" fill="#d4f717" />
                <circle cx="210" cy="32" r="4" fill="#d4f717" />

                {/* Left Pan: DAO Treasury Liquidity */}
                <line x1="30" y1="32" x2="12" y2="85" stroke="#a3a3cf" strokeWidth="1.2" strokeDasharray="2 2" />
                <line x1="30" y1="32" x2="48" y2="85" stroke="#a3a3cf" strokeWidth="1.2" strokeDasharray="2 2" />
                <path d="M10 85 Q30 102 50 85 Z" fill="#24244f" stroke="#d4f717" strokeWidth="2" />
                <circle cx="30" cy="80" r="5" fill="#d4f717" />

                {/* Right Pan: Slashed Dispute Bounty Pool */}
                <line x1="210" y1="32" x2="192" y2="85" stroke="#a3a3cf" strokeWidth="1.2" strokeDasharray="2 2" />
                <line x1="210" y1="32" x2="228" y2="85" stroke="#a3a3cf" strokeWidth="1.2" strokeDasharray="2 2" />
                <path d="M190 85 Q210 102 230 85 Z" fill="#24244f" stroke="#5a38fd" strokeWidth="2" />
                <circle cx="210" cy="80" r="4" fill="#ff4d4d" />
              </g>
            </svg>
          </div>

          {/* Pan Labels */}
          <div className="w-full grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-[#3b3b6d]/40 text-center">
            <div className="p-2 rounded-lg bg-[#24244f]/80 border border-[#3b3b6d]/50">
              <p className="text-[10px] text-[#a3a3cf] flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#d4f717]" />
                DAO Pool
              </p>
              <p className="text-xs font-mono font-bold text-white">
                {formatGen(metrics.total_pool_deposited_wei)} GEN
              </p>
            </div>

            <div className="p-2 rounded-lg bg-[#24244f]/80 border border-[#3b3b6d]/50">
              <p className="text-[10px] text-[#a3a3cf] flex items-center justify-center gap-1">
                <Flame className="w-3 h-3 text-[#ff4d4d]" />
                Slashed Bounty
              </p>
              <p className="text-xs font-mono font-bold text-[#d4f717]">
                {formatGen(metrics.dispute_bounty_pool_wei)} GEN
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
