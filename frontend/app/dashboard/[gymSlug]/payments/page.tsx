'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, Check, X, FileText, AlertCircle, RefreshCw } from 'lucide-react';

interface TransactionData {
  id: string;
  amount: number;
  status: 'PENDING' | 'AWAITING_VERIFICATION' | 'PAID' | 'FAILED' | 'REJECTED' | 'EXPIRED';
  paymentMode: 'MANUAL_UPI' | 'RAZORPAY';
  referenceId: string | null;
  createdAt: string;
  member: {
    name: string;
    phone: string;
  };
  plan: {
    name: string;
    durationDays: number;
  };
  invoice?: {
    invoiceNumber: string;
  } | null;
}

export default function PaymentsPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/payments`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [isRazorpayEnabled, setIsRazorpayEnabled] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/payments/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setUpiId(data.settings.upiId || '');
          setUpiName(data.settings.upiName || '');
          setRazorpayKeyId(data.settings.razorpayKeyId || '');
          setRazorpayKeySecret(data.settings.razorpayKeySecret || '');
          setIsRazorpayEnabled(data.settings.isRazorpayEnabled || false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchSettings();
  }, [gymSlug]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/payments/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId,
          upiName,
          razorpayKeyId,
          razorpayKeySecret,
          isRazorpayEnabled,
        }),
      });
      if (res.ok) {
        alert('Payment settings saved successfully!');
        setShowSettings(false);
        await fetchSettings();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleApprove = async (txnId: string) => {
    if (!confirm('Confirm payment approval? This will activate the membership immediately.')) return;
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnId, action: 'APPROVE' }),
      });
      if (res.ok) {
        await fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionId || !rejectReason.trim()) return;

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: actionId,
          action: 'REJECT',
          reason: rejectReason,
        }),
      });
      if (res.ok) {
        setIsRejecting(false);
        setActionId(null);
        setRejectReason('');
        await fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const awaitingTxns = transactions.filter((t) => t.status === 'AWAITING_VERIFICATION');
  const otherTxns = transactions.filter((t) => t.status !== 'AWAITING_VERIFICATION');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Payments Portal</h2>
          <p className="text-xs text-zinc-500 mt-1">Approve manual UPI references, view invoices, and track payment pipelines.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <CreditCard className="h-4 w-4 text-cyan-400" /> Gateway Settings
          </button>
          <button
            onClick={fetchTransactions}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Grid
          </button>
        </div>
      </div>

      {/* Payment Settings Card */}
      {showSettings && (
        <form onSubmit={handleSaveSettings} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-cyan-400" /> Payment Integration Settings
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Configure your merchant accounts. Razorpay handles credit/debit/netbanking/GPay; UPI ID enables direct scans.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-300">
            {/* Direct UPI */}
            <div className="space-y-4 rounded-xl border border-zinc-900 bg-zinc-900/10 p-4">
              <h4 className="font-bold text-cyan-400 uppercase tracking-widest text-[10px]">Direct UPI configuration</h4>
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-zinc-400 mb-1.5">UPI ID (VPA)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="gymname@okaxis"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-400 mb-1.5">Merchant/Payee Name</label>
                  <input
                    type="text"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    placeholder="Iron Gym & Fitness"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Razorpay Gateway */}
            <div className="space-y-4 rounded-xl border border-zinc-900 bg-zinc-900/10 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-cyan-400 uppercase tracking-widest text-[10px]">Razorpay Payment Gateway</h4>
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-zinc-400">Enabled</label>
                  <input
                    type="checkbox"
                    checked={isRazorpayEnabled}
                    onChange={(e) => setIsRazorpayEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-cyan-600 focus:ring-cyan-500 accent-cyan-500"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-zinc-400 mb-1.5">Razorpay Key ID</label>
                  <input
                    type="text"
                    value={razorpayKeyId}
                    onChange={(e) => setRazorpayKeyId(e.target.value)}
                    placeholder="rzp_test_xxxxxx"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-400 mb-1.5">Razorpay Secret Key</label>
                  <input
                    type="password"
                    value={razorpayKeySecret}
                    onChange={(e) => setRazorpayKeySecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end text-xs">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded-xl border border-zinc-800 hover:bg-zinc-900 px-5 py-2 text-zinc-400 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-6 py-2 text-white font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSavingSettings ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* Manual UPI Approvals Panel */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md">
        <h3 className="mb-4 text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
          Awaiting Verification
          {awaitingTxns.length > 0 && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold text-violet-400 border border-violet-500/30 animate-pulse">
              {awaitingTxns.length} Actions Needed
            </span>
          )}
        </h3>

        {awaitingTxns.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center text-center text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
            <AlertCircle className="h-6 w-6 text-zinc-700 mb-1" />
            <p className="text-xs font-bold">All caught up! No pending UPI payments need approval.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {awaitingTxns.map((txn) => (
              <div key={txn.id} className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="block text-xs font-bold text-white">{txn.member.name}</span>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">{txn.member.phone}</span>
                  </div>
                  <span className="text-base font-extrabold text-cyan-400">₹{txn.amount}</span>
                </div>

                <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-850 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Plan Requested:</span>
                    <span className="font-bold text-zinc-200">{txn.plan.name}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Transaction Reference ID:</span>
                    <span className="font-mono font-bold text-emerald-400 select-all">{txn.referenceId}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Requested At:</span>
                    <span className="font-semibold text-zinc-200">{new Date(txn.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Verification Actions */}
                {actionId === txn.id && isRejecting ? (
                  <form onSubmit={handleRejectSubmit} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Reason for rejection (e.g. Reference ID not received)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      required
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-rose-600 py-1.5 text-[10px] font-bold text-white hover:bg-rose-500"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRejecting(false);
                          setActionId(null);
                        }}
                        className="flex-1 rounded-lg border border-zinc-800 py-1.5 text-[10px] font-bold text-zinc-400 hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(txn.id)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-500"
                    >
                      <Check className="h-4 w-4" /> Approve Payment
                    </button>
                    <button
                      onClick={() => {
                        setActionId(txn.id);
                        setIsRejecting(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-zinc-800 py-2.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/10"
                    >
                      <X className="h-4 w-4" /> Reject Payment
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History / General Pipeline Logs */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider">Transaction Ledger</h3>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-36 items-center justify-center text-xs text-zinc-500">Loading ledger records...</div>
          ) : otherTxns.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-xs text-zinc-500">No other transaction logs recorded</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Plan Description</th>
                  <th className="py-3 px-4">Gateway Reference</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Tax Invoice</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {otherTxns.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div>{t.member.name}</div>
                      <div className="text-[10px] text-zinc-500 font-semibold mt-0.5">{t.member.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-zinc-200">₹{t.amount}</td>
                    <td className="py-3.5 px-4 text-zinc-400 font-medium">{t.plan.name}</td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono select-all">{t.referenceId || '--'}</td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-500 uppercase">{t.paymentMode.replace('_', ' ')}</td>
                    <td className="py-3.5 px-4 text-cyan-400 font-bold select-all">
                      {t.invoice ? (
                        <span className="flex items-center gap-1 hover:underline cursor-pointer">
                          <FileText className="h-3.5 w-3.5 text-cyan-500" /> {t.invoice.invoiceNumber}
                        </span>
                      ) : '--'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block rounded px-2 py-0.5 font-bold uppercase border ${
                        t.status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        t.status === 'REJECTED' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                        t.status === 'PENDING' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' :
                        'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
