import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useTheme } from "../context/ThemeContext";
import { useThemis } from "../context/ThemisContext";
import {
  ShieldCheck,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Mail,
  Coins,
  Scale,
  RefreshCw,
} from "lucide-react";

export function Navbar() {
  const { darkMode, toggleTheme } = useTheme();
  const { user, authenticated, login, logout } = usePrivy();
  const { metrics, refreshData, loading } = useThemis();

  const formatGen = (weiStr) => {
    try {
      const val = parseFloat(BigInt(weiStr || "0").toString()) / 1e18;
      return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
    } catch {
      return "0";
    }
  };

  return (
    <header className="border-b border-[#3b3b6d]/40 bg-[#24244f]/90 dark:bg-[#181836]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4f717] to-[#5a38fd] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#24244f] rounded-[10px] flex items-center justify-center">
                <img
                  src="/themis-logo.svg"
                  alt="Themis Scale"
                  className="w-7 h-7 object-contain"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xl tracking-tight text-white">
                  Themis
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#5a38fd]/25 text-[#d4f717] border border-[#5a38fd]/50">
                  GenLayer studionet
                </span>
              </div>
              <p className="text-xs text-[#a3a3cf]">
                Sybil Resistant Grant Escrow
              </p>
            </div>
          </div>

          {/* Treasury Telemetry Pills */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2d2d5e]/70 border border-[#3b3b6d]/50">
              <Coins className="w-4 h-4 text-[#d4f717]" />
              <div className="text-left">
                <p className="text-[10px] text-[#a3a3cf]">Total Pool Governed</p>
                <p className="text-xs font-mono font-semibold text-white">
                  {formatGen(metrics.total_pool_deposited_wei)} GEN
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2d2d5e]/70 border border-[#3b3b6d]/50">
              <ShieldCheck className="w-4 h-4 text-[#5a38fd]" />
              <div className="text-left">
                <p className="text-[10px] text-[#a3a3cf]">Grants Disbursed</p>
                <p className="text-xs font-mono font-semibold text-white">
                  {formatGen(metrics.total_grants_disbursed_wei)} GEN
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2d2d5e]/70 border border-[#3b3b6d]/50">
              <Scale className="w-4 h-4 text-[#d4f717]" />
              <div className="text-left">
                <p className="text-[10px] text-[#a3a3cf]">Dispute Bounty Pool</p>
                <p className="text-xs font-mono font-semibold text-[#d4f717]">
                  {formatGen(metrics.dispute_bounty_pool_wei)} GEN
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Controls: Refresh, Theme, Email Auth */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={refreshData}
              disabled={loading}
              title="Refresh on-chain state"
              className="p-2 rounded-lg text-[#a3a3cf] hover:text-white hover:bg-[#3b3b6d]/40 action-btn"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-[#d4f717]" : ""}`}
              />
            </button>

            <button
              onClick={toggleTheme}
              title="Toggle color theme"
              className="p-2 rounded-lg text-[#a3a3cf] hover:text-white hover:bg-[#3b3b6d]/40 action-btn"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#d4f717]" />
              ) : (
                <Moon className="w-4 h-4 text-[#5a38fd]" />
              )}
            </button>

            {authenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#3b3b6d]/50">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#5a38fd]/20 border border-[#5a38fd]/40">
                  <Mail className="w-3.5 h-3.5 text-[#d4f717]" />
                  <span className="text-xs font-mono text-white max-w-[140px] truncate">
                    {user?.email?.address || "Authenticated"}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b3b6d]/40 hover:bg-[#3b3b6d]/70 text-xs font-medium text-[#a3a3cf] hover:text-white action-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#5a38fd] to-[#714dff] hover:from-[#4d2ee6] hover:to-[#5a38fd] text-white text-xs font-semibold shadow-md action-btn"
              >
                <LogIn className="w-3.5 h-3.5 text-[#d4f717]" />
                <span>Email Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
