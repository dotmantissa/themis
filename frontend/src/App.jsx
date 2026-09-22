import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { RealtimeTreasuryMetrics } from "./components/RealtimeTreasuryMetrics";
import { BalanceScaleHero } from "./components/BalanceScaleHero";
import { RoundsList } from "./components/RoundsList";
import { ClaimsDocketList } from "./components/ClaimsDocketList";
import { ClaimDossierInspector } from "./components/ClaimDossierInspector";
import { ClaimSubmissionModal } from "./components/ClaimSubmissionModal";
import { CreateRoundModal } from "./components/CreateRoundModal";
import { AppealModal } from "./components/AppealModal";
import { useThemis } from "./context/ThemisContext";
import { CheckCircle2, AlertCircle, X, Cpu } from "lucide-react";

export function App() {
  const { feedbackMessage, setFeedbackMessage, selectedClaim } = useThemis();

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isCreateRoundOpen, setIsCreateRoundOpen] = useState(false);
  const [isAppealOpen, setIsAppealOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#24244f] text-white flex flex-col selection:bg-[#d4f717] selection:text-[#24244f]">
      {/* Top Navigation: Simplified */}
      <Navbar />

      {/* Global Action Feedback Notification */}
      {feedbackMessage && (
        <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div
            className={`p-4 rounded-2xl border shadow-lg flex items-start justify-between gap-3 ${
              feedbackMessage.type === "success"
                ? "bg-[#d4f717]/10 border-[#d4f717]/40 text-white"
                : "bg-rose-500/10 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-[#d4f717] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-sm font-bold text-white">
                  {feedbackMessage.title}
                </h4>
                <p className="text-xs text-[#a3a3cf] mt-0.5">
                  {feedbackMessage.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="p-1 rounded-lg text-[#a3a3cf] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* First Block Under Navbar: Realtime Big Metrics from Studio Network */}
        <RealtimeTreasuryMetrics />

        {/* Structural Device: Dual Chamber Balance Scale */}
        <BalanceScaleHero
          onOpenSubmit={() => setIsSubmitOpen(true)}
          onOpenCreateRound={() => setIsCreateRoundOpen(true)}
        />

        {/* Dashboard Split Pane: Ledger Docket on Left, Deep Evidence Inspector on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Rounds & Claims Ledger */}
          <div className="lg:col-span-5 space-y-6">
            <RoundsList onOpenCreateRound={() => setIsCreateRoundOpen(true)} />
            <ClaimsDocketList onOpenSubmit={() => setIsSubmitOpen(true)} />
          </div>

          {/* Right Column: Deep Forensic Evidence Inspector */}
          <div className="lg:col-span-7">
            <ClaimDossierInspector
              onOpenAppeal={() => setIsAppealOpen(true)}
              onOpenSubmit={() => setIsSubmitOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* Clean Simplified Footer without Banned Text */}
      <footer className="border-t border-[#3b3b6d]/60 bg-[#181836]/90 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#a3a3cf]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#d4f717]" />
            <span>
              Themis Intelligent Contract deployed on GenLayer Studio Chain 61999
            </span>
          </div>

          <span className="text-[11px] font-mono text-[#a3a3cf]">
            Autonomous AI Arbitration & Escrow
          </span>
        </div>
      </footer>

      {/* Interactive Modals */}
      <ClaimSubmissionModal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
      />

      <CreateRoundModal
        isOpen={isCreateRoundOpen}
        onClose={() => setIsCreateRoundOpen(false)}
      />

      <AppealModal
        isOpen={isAppealOpen}
        onClose={() => setIsAppealOpen(false)}
        claim={selectedClaim}
      />
    </div>
  );
}

export default App;
