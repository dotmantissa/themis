import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";

const ThemisContext = createContext(null);

export function ThemisProvider({ children }) {
  const { user, authenticated, login, logout, getAccessToken } = usePrivy();

  const [metrics, setMetrics] = useState({
    total_rounds: 1,
    total_claims: 0,
    total_pool_deposited_wei: "500000000000000000",
    total_grants_disbursed_wei: "0",
    total_bonds_staked_wei: "0",
    total_bonds_slashed_wei: "0",
    dispute_bounty_pool_wei: "0",
  });

  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [claims, setClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Sync authenticated Privy email to backend
  useEffect(() => {
    if (authenticated && user?.email?.address) {
      fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email.address,
          privyDid: user.id,
          walletAddress: user.wallet?.address || null,
        }),
      }).catch((err) => console.warn("Failed to sync user session:", err));
    }
  }, [authenticated, user]);

  // Fetch metrics and rounds
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, roundsRes, claimsRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/rounds"),
        fetch("/api/claims"),
      ]);

      if (metricsRes.ok) {
        const m = await metricsRes.json();
        setMetrics(m.onChain || m);
      }

      if (roundsRes.ok) {
        const r = await roundsRes.json();
        setRounds(r);
        if (!selectedRound && r.length > 0) {
          setSelectedRound(r[0]);
        }
      }

      if (claimsRes.ok) {
        const c = await claimsRes.json();
        setClaims(c);
        if (!selectedClaim && c.length > 0) {
          setSelectedClaim(c[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load Themis data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedRound, selectedClaim]);

  useEffect(() => {
    refreshData();
  }, []);

  // Submit grant claim (Abstracted transaction via backend relayer)
  const submitClaim = async ({ claimId, roundId, prUrl, activityUrl, screenshotUrl, notes }) => {
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      const email = user?.email?.address || "contributor@themis.grant";
      let token = null;
      try {
        token = await getAccessToken();
      } catch {
        // Fallback
      }

      const res = await fetch("/api/claims/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-user-email": email,
        },
        body: JSON.stringify({
          claimId,
          roundId,
          prUrl,
          activityUrl,
          screenshotUrl: screenshotUrl || "",
          notes: notes || "",
          claimantEmail: email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setFeedbackMessage({
        type: "success",
        title: "Claim Adjudicated on-chain",
        message: `Consensus verdict reached: ${data.claim?.verdict || "ADJUDICATED"}. Check the inspector dossier.`,
      });

      await refreshData();
      if (data.claim) {
        setSelectedClaim(data.claim);
      }
      return data;
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        title: "Claim Submission Reverted",
        message: err.message,
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // Settle claim (Release funds or slash)
  const settleClaim = async (claimId) => {
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      let token = null;
      try {
        token = await getAccessToken();
      } catch {
        // Ignored
      }

      const res = await fetch(`/api/claims/${claimId}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-user-email": user?.email?.address || "relayer@themis.grant",
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Settlement failed");
      }

      setFeedbackMessage({
        type: "success",
        title: "Settlement Executed",
        message: `Claim status updated to ${data.claim?.status}. Native fund transfers broadcast.`,
      });

      await refreshData();
      if (data.claim) {
        setSelectedClaim(data.claim);
      }
      return data;
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        title: "Settlement Blocked",
        message: err.message,
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // Register appeal
  const appealClaim = async (claimId, reason) => {
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      let token = null;
      try {
        token = await getAccessToken();
      } catch {
        // Ignored
      }

      const res = await fetch(`/api/claims/${claimId}/appeal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-user-email": user?.email?.address || "appellant@themis.grant",
        },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Appeal registration failed");
      }

      setFeedbackMessage({
        type: "success",
        title: "Consensus Appeal Registered",
        message: "Native appeal registered. Payout frozen until validator review.",
      });

      await refreshData();
      if (data.claim) {
        setSelectedClaim(data.claim);
      }
      return data;
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        title: "Appeal Rejected",
        message: err.message,
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // Create new grant round
  const createRound = async ({ roundId, title, description, grantAmountGen, bondAmountGen, poolDepositGen, finalitySeconds }) => {
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      const grantWei = BigInt(Math.round(parseFloat(grantAmountGen) * 1e18)).toString();
      const bondWei = BigInt(Math.round(parseFloat(bondAmountGen) * 1e18)).toString();
      const poolWei = BigInt(Math.round(parseFloat(poolDepositGen) * 1e18)).toString();

      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email?.address || "dao@themis.grant",
        },
        body: JSON.stringify({
          roundId,
          title,
          description,
          grantAmountWei: grantWei,
          bondAmountWei: bondWei,
          poolDepositWei: poolWei,
          finalitySeconds: finalitySeconds || 3600,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create round");
      }

      setFeedbackMessage({
        type: "success",
        title: "Grant Round Funded",
        message: `Round ${roundId} created and funded with ${poolDepositGen} GEN.`,
      });

      await refreshData();
      if (data.round) {
        setSelectedRound(data.round);
      }
      return data;
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        title: "Round Creation Failed",
        message: err.message,
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemisContext.Provider
      value={{
        metrics,
        rounds,
        selectedRound,
        setSelectedRound,
        claims,
        selectedClaim,
        setSelectedClaim,
        loading,
        submitting,
        feedbackMessage,
        setFeedbackMessage,
        refreshData,
        submitClaim,
        settleClaim,
        appealClaim,
        createRound,
        user,
        authenticated,
        login,
        logout,
      }}
    >
      {children}
    </ThemisContext.Provider>
  );
}

export function useThemis() {
  const context = useContext(ThemisContext);
  if (!context) {
    throw new Error("useThemis must be used within a ThemisProvider");
  }
  return context;
}
