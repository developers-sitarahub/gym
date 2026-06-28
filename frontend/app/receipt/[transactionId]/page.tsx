'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, Download, AlertCircle, RefreshCw, CheckCircle2, MapPin, Calendar, CreditCard, Receipt } from 'lucide-react';

interface ReceiptData {
  id: string;
  amount: number;
  status: 'PENDING' | 'AWAITING_VERIFICATION' | 'PAID' | 'FAILED' | 'REJECTED' | 'EXPIRED';
  paymentMode: 'MANUAL_UPI' | 'RAZORPAY';
  referenceId: string | null;
  createdAt: string;
  member: {
    name: string;
    phone: string;
    email: string | null;
  };
  plan: {
    name: string;
    durationDays: number;
  };
  gym: {
    name: string;
    slug: string;
    address: string | null;
  };
  invoice: {
    invoiceNumber: string;
    createdAt: string;
  } | null;
}

export default function ReceiptPage() {
  const { transactionId } = useParams() as { transactionId: string };
  const [data, setData] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReceipt = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/receipt/${transactionId}`);
      if (res.ok) {
        const payload = await res.json();
        setData(payload.transaction);
      } else {
        const errPayload = await res.json();
        setError(errPayload.error || 'Failed to retrieve receipt details.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred while loading your receipt.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      fetchReceipt();
    }
  }, [transactionId]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-4">
        <RefreshCw className="h-8 w-8 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm font-semibold">Generating your tax receipt...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <div className="mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 p-3 w-fit text-rose-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Receipt Not Found</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {error || "We couldn't locate a transaction or tax invoice matching this receipt ID."}
          </p>
          <button
            onClick={fetchReceipt}
            className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 text-xs transition-all"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const createdDate = new Date(data.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 text-zinc-100 font-sans">
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-border {
            border: 1px solid #e4e4e7 !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .print-text-dark {
            color: #18181b !important;
          }
          .print-text-muted {
            color: #71717a !important;
          }
          .print-bg-light {
            background-color: #f4f4f5 !important;
          }
        }
      `}</style>

      {/* Main receipt card container */}
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden print-border">
        {/* Decorative Status Bar */}
        <div className={`h-2.5 w-full ${data.status === 'PAID' ? 'bg-emerald-500' : 'bg-amber-500'} no-print`} />

        {/* Invoice Body */}
        <div className="p-6 sm:p-10 space-y-8">
          {/* Header Block */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 border-b border-zinc-800/80 pb-6 print-border">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider print-bg-light print-text-dark">
                <Receipt className="h-3 w-3" /> Tax Invoice
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white print-text-dark">{data.gym.name}</h2>
              {data.gym.address && (
                <p className="text-[11px] text-zinc-500 flex items-center gap-1 leading-relaxed print-text-muted">
                  <MapPin className="h-3 w-3 text-zinc-600" /> {data.gym.address}
                </p>
              )}
            </div>
            
            <div className="sm:text-right space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold print-text-muted">Receipt Number</div>
              <div className="text-base font-extrabold text-white font-mono select-all print-text-dark">
                {data.invoice?.invoiceNumber || `REC-${data.id.slice(-6).toUpperCase()}`}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-2 print-text-muted">Billing Date</div>
              <div className="text-xs font-semibold text-zinc-300 print-text-dark">{createdDate}</div>
            </div>
          </div>

          {/* Payment Stamp Status & Dynamic Success Box */}
          <div className="rounded-2xl bg-zinc-950/40 border border-zinc-800 p-5 flex flex-col sm:flex-row justify-between items-center gap-4 print-bg-light print-border">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2.5 ${data.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold print-text-muted">Payment Status</span>
                <span className={`text-sm font-black uppercase tracking-wide ${data.status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.status === 'PAID' ? 'Verified & Paid' : data.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold print-text-muted">Amount Received</span>
              <span className="text-2xl font-black text-white font-mono print-text-dark">₹{data.amount}</span>
            </div>
          </div>

          {/* Member Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-1.5 print-border print-text-dark">Billed To</h3>
              <div className="text-xs space-y-1.5 leading-relaxed text-zinc-300 print-text-dark font-medium">
                <p className="font-bold text-sm text-white print-text-dark">{data.member.name}</p>
                <p>Phone: {data.member.phone}</p>
                {data.member.email && <p>Email: {data.member.email}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-1.5 print-border print-text-dark">Transaction Log</h3>
              <div className="text-xs space-y-1.5 leading-relaxed text-zinc-300 print-text-dark font-medium">
                <p>Payment Mode: <strong className="text-zinc-100 print-text-dark">{data.paymentMode.replace('_', ' ')}</strong></p>
                {data.referenceId && (
                  <p className="flex items-center gap-1.5">
                    Reference ID: <strong className="text-emerald-400 font-mono select-all print-text-dark">{data.referenceId}</strong>
                  </p>
                )}
                <p className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" /> Logged on: {new Date(data.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Plan Invoice Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-1.5 print-border print-text-dark">Billed Subscriptions</h3>
            <div className="overflow-hidden rounded-xl border border-zinc-850 print-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950/60 font-bold text-zinc-400 print-bg-light print-text-dark border-b border-zinc-850">
                    <th className="py-3 px-4">Membership Item</th>
                    <th className="py-3 px-4 text-center">Duration</th>
                    <th className="py-3 px-4 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 print-text-dark">
                  <tr className="text-zinc-300 print-text-dark">
                    <td className="py-4 px-4 font-bold text-white print-text-dark">
                      {data.plan.name} Membership
                      <span className="block text-[10px] text-zinc-500 font-medium mt-0.5 print-text-muted">
                        Gym Access Subscription
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-zinc-400 print-text-dark">
                      {data.plan.durationDays} Days
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-white print-text-dark">
                      ₹{data.amount}
                    </td>
                  </tr>
                  <tr className="bg-zinc-950/20 font-bold text-white print-text-dark">
                    <td colSpan={2} className="py-3.5 px-4 text-right text-zinc-400 print-text-dark uppercase tracking-wide">Total Amount</td>
                    <td className="py-3.5 px-4 text-right text-base text-cyan-400 print-text-dark font-extrabold">₹{data.amount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Trust Seal */}
          <div className="rounded-xl bg-cyan-950/10 border border-cyan-500/20 p-4 flex gap-3 text-xs leading-relaxed text-zinc-400 print-bg-light print-border print-text-dark">
            <ShieldCheck className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
            <p>
              This is a digitally generated tax receipt verified by <strong>FitFlow SaaS</strong>. No physical signature is required. For any disputes or queries, please contact gym management referencing receipt ID.
            </p>
          </div>
        </div>

        {/* print footer */}
        <div className="bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex flex-col sm:flex-row sm:justify-between items-center gap-4 no-print">
          <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
            🔒 Verified Secure. Powered by FitFlow.
          </span>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 py-2.5 text-xs transition-all cursor-pointer shadow-lg shadow-cyan-950/20"
            >
              <Download className="h-4 w-4" /> Save Receipt PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
