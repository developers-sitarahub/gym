"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Edit2, RefreshCcw, Info, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

interface DisplayNameManagerProps {
  gymSlug: string;
  config: any;
  onRefresh: (force?: boolean) => Promise<void>;
}

export default function DisplayNameManager({ gymSlug, config, onRefresh }: DisplayNameManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (config.connected) {
      loadHistory();
    }
  }, [config.connected, gymSlug]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/display-name/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Automatic Polling: If there is an active request that is pending or registering, poll every 5 seconds.
  useEffect(() => {
    const hasPendingStatus = history.some(h => h.isActive && ["PENDING_REVIEW", "APPROVED", "REGISTERING"].includes(h.status));
    if (config.connected && hasPendingStatus) {
      const interval = setInterval(() => {
        loadHistory();
        onRefresh(); // Also refresh parent config
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [config.connected, history, gymSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/display-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update display name");
      }

      toast.success("Display name change requested successfully");
      setIsEditing(false);
      setNewName("");
      onRefresh(); // reload config to get the pending state
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to update display name");
    } finally {
      setSubmitting(false);
    }
  }

  const renderStatusBadge = (status: string, error?: string) => {
    switch (status) {
      case "PENDING_REVIEW":
        return <span className="text-amber-400 flex items-center gap-1 text-xs"><Clock className="w-3 h-3" /> Pending Review</span>;
      case "APPROVED":
        return <span className="text-emerald-400 flex items-center gap-1 text-xs"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case "DECLINED":
        return (
          <div className="flex flex-col">
            <span className="text-rose-400 flex items-center gap-1 text-xs"><XCircle className="w-3 h-3" /> Declined</span>
            {error && <span className="text-rose-400/70 text-[10px] mt-0.5">{error}</span>}
          </div>
        );
      case "REGISTERING":
        return <span className="text-cyan-400 flex items-center gap-1 text-xs"><RefreshCcw className="w-3 h-3 animate-spin" /> Registering Line</span>;
      case "REGISTERED":
        return <span className="text-emerald-400 flex items-center gap-1 text-xs"><CheckCircle className="w-3 h-3" /> Active</span>;
      case "REGISTRATION_FAILED":
        return (
          <div className="flex flex-col">
            <span className="text-rose-400 flex items-center gap-1 text-xs"><AlertCircle className="w-3 h-3" /> Reg. Failed</span>
            {error && <span className="text-rose-400/70 text-[10px] mt-0.5">{error}</span>}
          </div>
        );
      default:
        return <span className="text-zinc-500 text-xs">{status}</span>;
    }
  };

  const hasActiveRequest = history.some(h => h.isActive);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRequestsCount = history.filter(h => new Date(h.requestedAt) >= thirtyDaysAgo).length;

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      await onRefresh(true);
      await loadHistory();
      toast.success("Checked with Meta successfully");
    } catch (err) {
      toast.error("Failed to check status");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-8 backdrop-blur-2xl space-y-8 transition-all hover:border-zinc-700/60 hover:shadow-2xl hover:bg-zinc-900/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-6 gap-4">
        <h3 className="text-base font-extrabold text-white flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-xl">
            <Info className="w-5 h-5 text-cyan-400" />
          </div>
          Display Name Management
        </h3>
        <div className="flex items-center gap-3">
          {hasActiveRequest && (
            <button
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="rounded-full border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 transition-all flex items-center gap-2 disabled:opacity-50"
              title="Check for Meta updates"
            >
              <RefreshCcw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Checking..." : "Check Status"}
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              disabled={hasActiveRequest || recentRequestsCount >= 10}
              className="rounded-full bg-zinc-800 hover:bg-zinc-700 px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Edit2 className="w-3 h-3" /> Change Name
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
        <div className="space-y-6">
          <div className="group/item">
            <span className="text-zinc-500 font-bold block mb-1.5 uppercase tracking-wider text-[10px]">
              Current Display Name
            </span>
            <span className="font-extrabold text-white text-base">
              {config.whatsappVerifiedName || "—"}
            </span>
            {config.whatsappNameStatus && (
              <div className="mt-2">
                {renderStatusBadge(config.whatsappNameStatus, config.registrationError)}
              </div>
            )}
          </div>
        </div>

        {config.pendingDisplayName && (
          <div className="space-y-6">
            <div className="group/item">
              <span className="text-zinc-500 font-bold block mb-1.5 uppercase tracking-wider text-[10px]">
                Pending Display Name
              </span>
              <span className="font-extrabold text-cyan-400 text-base">
                {config.pendingDisplayName}
              </span>
              {config.pendingNameStatus && (
                <div className="mt-2">
                  {renderStatusBadge(config.pendingNameStatus, config.registrationError)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-2">New Display Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. FitFlow Gym"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-all"
            />
            <p className="text-[10px] text-zinc-500 mt-2">Note: You can change the display name up to 10 times per 30 days.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50"
            >
              {submitting ? "Requesting..." : "Submit Name Change"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl px-5 py-2.5 text-xs font-bold text-zinc-400 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-800/80">
          <h4 className="text-sm font-bold text-white mb-4">Request History</h4>
          <div className="space-y-3">
            {history.map((req) => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{req.newName}</span>
                    {req.oldName && <span className="text-zinc-500 text-xs">(from {req.oldName})</span>}
                  </div>
                  <span className="text-zinc-500 text-[10px] block mt-1">
                    Requested: {new Date(req.requestedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 sm:mt-0">
                  {renderStatusBadge(req.status, req.rejectionReason)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
