import React, { useState, useEffect } from "react";
import { useThemis } from "../context/ThemisContext";
import {
  ShieldCheck,
  ShieldAlert,
  GitMerge,
  Cpu,
  Clock,
  ExternalLink,
  Coins,
  AlertOctagon,
  Scale,
  Gavel,
  FileCheck2,
  CheckCircle2,
  XCircle,
  Activity,
  Image as ImageIcon,
  Trophy,
  Sparkles,
  UserCheck,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";

export function ClaimDossierInspector({ claim, onAppealClick }) {
  const { settleClaim, submitting } = useThemis();
  const [settling, setSettling] = useState(false);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!claim) {
    return (
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center p-8 rounded-2xl border border-[#3b3b6d]/40 bg-[#1d1d42]/60 text-center space-y-3">
        <Scale className="w-12 h-12 text-[#5a38fd]/60 stroke-1" />
        <h3 className="text-base font-display font-bold text-white">
          No Claim Dossier Selected
        </h3>
        <p className="text-xs text-[#a3a3cf] max-w-sm">
          Select any claim from the evidence docket or submit a new milestone pull request to scrutinize validator consensus telemetry.
        </p>
      </div>
    );
  }

  const formatGen = (weiStr) => {
    try {
      const val = parseFloat(BigInt(weiStr || "0").toString()) / 1e18;
      return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
    } catch {
      return "0";
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    try {
      await settleClaim(claim.claim_id);
    } catch (err) {
      console.error(err);
    } finally {
      setSettling(false);
    }
  };

  const isApproved = claim.verdict === "APPROVED";
  const isRunnerUp = claim.verdict === "HONEST_RUNNER_UP";
  const isFraud = claim.verdict === "REJECTED_SYBIL_FRAUD";
  const isSettled = claim.status === "SETTLED" || claim.status === "SLASHED" || claim.status === "REFUNDED";
  const isAppealed = claim.is_appealed || claim.status === "APPEALED";

  const finalityExpiresAt = claim.finality_expires_at
    ? typeof claim.finality_expires_at === "number"
      ? claim.finality_expires_at
      : Math.floor(new Date(claim.finality_expires_at).getTime() / 1000)
    : 0;
  const secondsRemaining = Math.max(0, finalityExpiresAt - nowTs);
  const isFinal = secondsRemaining === 0;

  const formatCountdown = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs < 10 ? "0" : ""}${remSecs}s`;
  };

  return (
    <div className="rounded-2xl border border-[#3b3b6d]/60 bg-gradient-to-br from-[#1d1d42] to-[#181836] p-6 space-y-6 shadow-xl">
      {/* Dossier Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#3b3b6d]/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-bold text-white">
              Claim Dossier
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#24244f] border border-[#3b3b6d] text-[#d4f717]">
              {claim.claim_id}
            </span>
          </div>
          <p className="text-xs text-[#a3a3cf] mt-1 font-mono">
            Submitter: <span className="text-white">{claim.claimant || "0x..."}</span>
          </p>
        </div>

        {/* Verdict Badge */}
        <div className="flex items-center gap-2">
          {isApproved && (
            <span className="px-3 py-1 rounded-xl bg-[#d4f717]/20 text-[#d4f717] border border-[#d4f717]/40 text-xs font-mono font-bold flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              WINNER {claim.rank ? `(#${claim.rank})` : ""}
            </span>
          )}
          {isRunnerUp && (
            <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-mono font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              HONEST RUNNER-UP {claim.rank ? `(#${claim.rank})` : ""}
            </span>
          )}
          {isFraud && (
            <span className="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-mono font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              REJECTED FRAUD
            </span>
          )}
          {!isApproved && !isRunnerUp && !isFraud && (
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5" />
              ADJUDICATED
            </span>
          )}
        </div>
      </div>

      {/* User-Bound Custody & Verified Provenance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* User-Bound Custody Card */}
        <div className="p-3.5 rounded-xl bg-[#24244f]/80 border border-[#3b3b6d]/60 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#d4f717]" />
              User-Bound Custody
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#d4f717]/10 text-[#d4f717] border border-[#d4f717]/30 font-semibold">
              DIRECT PAYOUT
            </span>
          </div>
          <p className="text-[11px] text-[#a3a3cf] font-mono truncate">
            Builder Wallet: <span className="text-white font-bold">{claim.claimant || claim.claimant_address || "0x..."}</span>
          </p>
          <p className="text-[10px] text-[#a3a3cf]">
            Smart contract routes 100% of payout directly to the builder. Relayer holds zero custody.
          </p>
        </div>

        {/* Verified Contribution Provenance Card */}
        <div className="p-3.5 rounded-xl bg-[#24244f]/80 border border-[#3b3b6d]/60 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5a38fd]" />
              Contribution Provenance
            </span>
            {claim.author_matched === false ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                AUTHOR MISMATCH
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                VERIFIED PROVENANCE
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <span className="text-[#a3a3cf]">Target Repo: </span>
              <span className="text-white">{claim.target_repo || "dotmantissa/themis"}</span>
            </div>
            <div>
              <span className="text-[#a3a3cf]">PR Author: </span>
              <span className="text-[#d4f717]">{claim.pr_author || claim.builder_github || "verified"}</span>
            </div>
          </div>
          {claim.canonical_evidence && (
            <p className="text-[10px] text-[#a3a3cf] font-mono truncate">
              Single-Use Proof: <span className="text-[#d4f717]">{claim.canonical_evidence}</span>
            </p>
          )}
        </div>
      </div>

      {/* Two-Tier Consensus Architecture Breakdown */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono text-[#d4f717] uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-[#d4f717]" />
          Two-Tier Consensus Adjudication Matrix
        </h3>

        {/* Tier 1 Card: Static Git Merge Proof */}
        <div className="p-4 rounded-xl bg-[#24244f]/80 border border-[#3b3b6d]/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#5a38fd]/20 border border-[#5a38fd]/40">
                <GitMerge className="w-4 h-4 text-[#d4f717]" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Tier 1: Canonical PR Merge Proof</p>
                <p className="text-[11px] text-[#a3a3cf]">
                  Primitive: gl.nondet.web.get with gl.eq_principle.strict_eq
                </p>
              </div>
            </div>

            {claim.tier1_pr_merged ? (
              <span className="flex items-center gap-1 text-xs font-mono font-bold text-[#d4f717]">
                <CheckCircle2 className="w-4 h-4" />
                PR MERGED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-mono font-bold text-rose-400">
                <XCircle className="w-4 h-4" />
                PR NOT MERGED
              </span>
            )}
          </div>

          <p className="text-xs text-[#a3a3cf] leading-relaxed">
            Strict equality boolean check on static git metadata. No probabilistic LLM variability involved. Validators verify that code commits are merged into the target repository.
          </p>

          <div className="flex items-center gap-2 pt-1 text-xs font-mono">
            <span className="text-[#a3a3cf]">PR Link:</span>
            <a
              href={claim.pr_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#d4f717] hover:underline flex items-center gap-1 truncate max-w-xs"
            >
              <span className="truncate">{claim.pr_url}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        {/* Tier 2 Card: Dynamic Sybil Cluster & Activity Proof */}
        <div className="p-4 rounded-xl bg-[#24244f]/80 border border-[#3b3b6d]/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#5a38fd]/20 border border-[#5a38fd]/40">
                <Activity className="w-4 h-4 text-[#5a38fd]" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Tier 2: Sybil Cluster Activity Proof</p>
                <p className="text-[11px] text-[#a3a3cf]">
                  Primitive: gl.nondet.web.render with gl.eq_principle.prompt_non_comparative
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                  claim.tier2_sybil_score >= 60
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : claim.tier2_sybil_score >= 35
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-[#d4f717]/20 text-[#d4f717] border border-[#d4f717]/30"
                }`}
              >
                Risk Score: {claim.tier2_sybil_score ?? 0}/100
              </span>
            </div>
          </div>

          <p className="text-xs text-[#a3a3cf] leading-relaxed">
            Full DOM rendering with JavaScript execution. Independent validators derive transaction and commit topology against the explicit sybil defense rubric via gl.vm.run_nondet_unsafe without colluding.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-[#181836]/70 border border-[#3b3b6d]/40">
              <p className="text-[10px] text-[#a3a3cf]">Cluster Risk Tier</p>
              <p className="font-bold text-white">{claim.tier2_sybil_tier || "ORGANIC"}</p>
            </div>

            <div className="p-2 rounded-lg bg-[#181836]/70 border border-[#3b3b6d]/40">
              <p className="text-[10px] text-[#a3a3cf]">Activity Source</p>
              <a
                href={claim.activity_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#d4f717] hover:underline flex items-center gap-1 truncate"
              >
                <span className="truncate">View Graph</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          {claim.screenshot_url && (
            <div className="pt-2 border-t border-[#3b3b6d]/40 flex items-center gap-2 text-xs">
              <ImageIcon className="w-3.5 h-3.5 text-[#d4f717]" />
              <span className="text-[#a3a3cf]">Supplementary multimodal proof:</span>
              <a
                href={claim.screenshot_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#d4f717] hover:underline truncate"
              >
                {claim.screenshot_url}
              </a>
            </div>
          )}
        </div>

        {/* Idea Strength & Execution Quality Card */}
        <div className="p-4 rounded-xl bg-[#24244f]/80 border border-[#3b3b6d]/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#d4f717]/20 border border-[#d4f717]/40">
                <Sparkles className="w-4 h-4 text-[#d4f717]" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Idea & Execution Strength</p>
                <p className="text-[11px] text-[#a3a3cf]">
                  Validators evaluate technical complexity, utility, and execution polish
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#d4f717]/20 text-[#d4f717] border border-[#d4f717]/30">
                Strength: {claim.strength_score ?? 0}/100
              </span>
            </div>
          </div>

          <div className="w-full bg-[#181836] rounded-full h-2 overflow-hidden border border-[#3b3b6d]/40">
            <div
              className="bg-gradient-to-r from-[#5a38fd] to-[#d4f717] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, claim.strength_score ?? 0))}%` }}
            />
          </div>

          {claim.strength_assessment && (
            <p className="text-xs text-[#a3a3cf] leading-relaxed italic bg-[#181836]/60 p-2.5 rounded-lg border border-[#3b3b6d]/40">
              "{claim.strength_assessment}"
            </p>
          )}

          {Number(claim.rank) > 0 && (
            <div className="flex items-center gap-2 pt-1 text-xs font-mono">
              <span className="text-[#a3a3cf]">Round Allocation Standing:</span>
              <span className="px-2 py-0.5 rounded bg-[#5a38fd]/30 text-[#d4f717] font-bold border border-[#5a38fd]/50">
                Rank #{claim.rank}
              </span>
            </div>
          )}
        </div>

        {/* Validator Consensus Reasoning Box */}
        {claim.verdict_reasoning && (
          <div className="p-3.5 rounded-xl bg-[#181836]/90 border border-[#3b3b6d]/50 space-y-1">
            <p className="text-[11px] font-mono text-[#a3a3cf] flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-[#d4f717]" />
              Consensus Finding Reasoning
            </p>
            <p className="text-xs text-white/90 leading-relaxed font-sans italic">
              "{claim.verdict_reasoning}"
            </p>
          </div>
        )}
      </div>

      {/* Settlement & Fund Flow Accounting */}
      <div className="pt-4 border-t border-[#3b3b6d]/40 space-y-3">
        <h3 className="text-xs font-mono text-[#a3a3cf] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-white font-bold">
            <Coins className="w-3.5 h-3.5 text-[#d4f717]" />
            Custody Settlement & Fund Flow
          </span>
          <span className="text-[11px] font-mono text-[#d4f717]">
            Status: {claim.status}
          </span>
        </h3>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-xl bg-[#24244f]/90 border border-[#3b3b6d]/50">
            <p className="text-[10px] text-[#a3a3cf]">Claimant Payout</p>
            <p className="text-sm font-mono font-bold text-white">
              {isApproved
                ? `${formatGen(BigInt(claim.grant_wei || "0") + BigInt(claim.bond_wei || "0"))} GEN`
                : isRunnerUp
                ? `${formatGen(claim.bond_wei)} GEN (Refund)`
                : isFraud
                ? "0 GEN"
                : `${formatGen(claim.bond_wei)} GEN (Refund)`}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#24244f]/90 border border-[#3b3b6d]/50">
            <p className="text-[10px] text-[#a3a3cf]">Bounty Pool Slash</p>
            <p className="text-sm font-mono font-bold text-[#d4f717]">
              {isFraud ? `${formatGen(claim.bond_wei)} GEN` : "0 GEN"}
            </p>
          </div>
        </div>

        {/* Native Protocol Finality & Settlement Protection Notice */}
        {isAppealed ? (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 leading-relaxed">
              <strong className="text-rose-100 font-bold">Settlement Frozen (Active Appeal): </strong> 
              This claim is under active consensus appeal. Escrow releases and bond disbursements are strictly locked by the GenLayer smart contract until the appeal is adjudicated.
            </div>
          </div>
        ) : !isFinal ? (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 leading-relaxed">
              <strong className="text-amber-100 font-bold">Appeal Window Active ({formatCountdown(secondsRemaining)} remaining): </strong> 
              GenLayer protocol enforces a mandatory dispute window before state finalization. Settlement is locked until this window expires to protect peer review and dispute rights.
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-200 leading-relaxed">
              <strong className="text-emerald-100 font-bold">Protocol Finality Reached: </strong> 
              Dispute window has elapsed with no active appeals. Claim is finalized and eligible for direct-to-claimant on-chain settlement.
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          {!isSettled && (
            <button
              onClick={handleSettle}
              disabled={settling || submitting || isAppealed || !isFinal}
              className={`w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs shadow-md action-btn flex items-center justify-center gap-2 ${
                isAppealed
                  ? "bg-slate-700/60 text-slate-400 cursor-not-allowed border border-slate-600/50"
                  : !isFinal
                  ? "bg-amber-950/40 text-amber-300/80 cursor-not-allowed border border-amber-500/30"
                  : "bg-gradient-to-r from-[#d4f717] to-[#bfe010] text-[#24244f] hover:shadow-[#d4f717]/20"
              }`}
            >
              {isAppealed ? (
                <>
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>Settlement Frozen (Active Appeal)</span>
                </>
              ) : !isFinal ? (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Settlement Locked ({formatCountdown(secondsRemaining)})</span>
                </>
              ) : (
                <>
                  <Gavel className="w-4 h-4" />
                  <span>{settling ? "Settling on-chain..." : "Settle Payout & Bond"}</span>
                </>
              )}
            </button>
          )}

          {!isSettled && !isAppealed && (
            <button
              onClick={() => onAppealClick(claim)}
              disabled={submitting}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#2d2d5e] hover:bg-[#3b3b6d] text-white border border-[#3b3b6d] font-semibold text-xs action-btn flex items-center justify-center gap-1.5"
            >
              <Scale className="w-4 h-4 text-[#d4f717]" />
              <span>Register Protocol Appeal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
