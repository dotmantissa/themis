import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useThemis } from "../context/ThemisContext";
import { LogIn, LogOut, Mail, Wallet, Coins } from "lucide-react";

export function Navbar() {
  const { user, authenticated, login, logout } = usePrivy();
  const { walletBalance, userWalletAddress } = useThemis();

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const formatBalance = (bal) => {
    try {
      const num = parseFloat(bal || "0");
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      });
    } catch {
      return "0.00";
    }
  };

  return (
    <header className="border-b border-[#3b3b6d]/40 bg-[#24244f]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Simplified Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d4f717] to-[#5a38fd] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#24244f] rounded-[10px] flex items-center justify-center">
                <img
                  src="/themis-logo.svg"
                  alt="Themis Scale"
                  className="w-6 h-6 object-contain"
                />
              </div>
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tight text-white">
              Themis
            </span>
          </div>

          {/* Right Action Controls: Email Auth and Embedded Wallet Balance */}
          <div className="flex items-center gap-3">
            {authenticated ? (
              <div className="flex items-center gap-2.5">
                {/* Embedded Wallet & Balance Chip */}
                {userWalletAddress && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#181836] border border-[#3b3b6d]/60 text-xs font-mono">
                    <div className="flex items-center gap-1 text-[#d4f717]">
                      <Coins className="w-3.5 h-3.5" />
                      <span className="font-bold">{formatBalance(walletBalance)} GEN</span>
                    </div>
                    <span className="text-[#3b3b6d]">|</span>
                    <span className="text-[#a3a3cf] hidden md:inline" title={userWalletAddress}>
                      {formatAddress(userWalletAddress)}
                    </span>
                  </div>
                )}

                {/* Email Chip */}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#5a38fd]/15 border border-[#5a38fd]/30 text-xs text-white">
                  <Mail className="w-3.5 h-3.5 text-[#d4f717]" />
                  <span className="max-w-[150px] truncate">
                    {user?.email?.address || "Authenticated"}
                  </span>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2d2d5e] hover:bg-[#3b3b6d] text-xs font-semibold text-[#a3a3cf] hover:text-white action-btn border border-[#3b3b6d]/50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#5a38fd] to-[#714dff] hover:from-[#4d2ee6] hover:to-[#5a38fd] text-white text-xs font-bold shadow-md action-btn"
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
