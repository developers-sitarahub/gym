'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Users,
  MessageCircle,
  Zap,
  Phone,
  CreditCard,
  Bot,
  Globe,
  Bell,
  UserCheck,
  Monitor,
  Smartphone,
  Check,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────
   ANIMATED DEMO COMPONENTS — Optimized for Viewports
   ───────────────────────────────────────────────────── */

interface DemoProps {
  isMobile: boolean;
}

function DashboardDemo({ isMobile }: DemoProps) {
  const stats = [
    {
      label: 'Revenue',
      value: '₹1,84,400',
      change: '+12%',
      color: 'text-emerald-600',
      icon: TrendingUp,
      bg: 'bg-emerald-50',
    },
    {
      label: 'Members',
      value: '184',
      change: '92%',
      color: 'text-blue-600',
      icon: Users,
      bg: 'bg-blue-50',
    },
    {
      label: 'Bot Chats',
      value: '47',
      change: '12 now',
      color: 'text-violet-600',
      icon: MessageCircle,
      bg: 'bg-violet-50',
    },
    {
      label: 'Renewals',
      value: '38',
      change: 'This week',
      color: 'text-amber-600',
      icon: Zap,
      bg: 'bg-amber-50',
    },
  ];

  // Limit display on mobile to keep vertical space clean
  const visibleStats = isMobile ? stats.slice(0, 2) : stats;

  return (
    <div className="p-5 space-y-4 bg-gradient-to-br from-slate-50/60 to-white h-full">
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {visibleStats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                {s.label}
              </span>
              <div className={`h-6 w-6 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>
                <s.icon className="h-3 w-3" />
              </div>
            </div>
            <p className="text-base font-extrabold text-slate-900">{s.value}</p>
            <p className={`text-[9px] font-semibold ${s.color}`}>{s.change}</p>
          </motion.div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Revenue — Last 6 Months
        </p>
        <div className={`flex items-end justify-center gap-3 px-2 ${isMobile ? 'h-32' : 'h-24'}`}>
          {[35, 50, 42, 68, 82, 100].map((h, i) => {
            if (isMobile && i < 2) return null; // show fewer bars on mobile
            return (
              <div key={i} className="flex flex-col items-center justify-end h-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h * 0.8}%` }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="w-6 rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-500 shadow-md"
                />
                <span className="text-[8px] font-bold text-slate-400 mt-1">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MembersDemo({ isMobile }: DemoProps) {
  const members = [
    {
      name: 'Alex Mercer',
      plan: 'Platinum',
      status: 'Active',
      days: '25 days',
      avatar: 'AM',
      statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      name: 'Priya Sharma',
      plan: 'Gold',
      status: 'Expiring',
      days: '3 days',
      avatar: 'PS',
      statusColor: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      name: 'Raj Patel',
      plan: 'VIP Club',
      status: 'Active',
      days: '180 days',
      avatar: 'RP',
      statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      name: 'Sneha Iyer',
      plan: 'Gold',
      status: 'Expired',
      days: '0 days',
      avatar: 'SI',
      statusColor: 'bg-rose-50 text-rose-600 border-rose-100',
    },
    {
      name: 'Vikram Singh',
      plan: 'Platinum',
      status: 'Active',
      days: '45 days',
      avatar: 'VS',
      statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
  ];

  const visibleMembers = isMobile ? members.slice(0, 4) : members;

  return (
    <div className="p-5 space-y-2 bg-gradient-to-br from-slate-50/60 to-white h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 rounded-lg px-3 py-1.5 text-[10px] text-slate-400 border border-slate-200">
            🔍 Search...
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-indigo-600">
            184 total
          </div>
        </div>
      </div>
      {visibleMembers.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.1 }}
          className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-3 hover:shadow-md transition-shadow"
        >
          <div
            className={`h-8 w-8 rounded-lg ${m.statusColor} border flex items-center justify-center text-[10px] font-bold`}
          >
            {m.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{m.name}</p>
            <p className="text-[9px] text-slate-400">{m.plan}</p>
          </div>
          <div className="text-right">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${m.statusColor}`}>
              {m.status}
            </span>
            <p className="text-[8px] text-slate-400 mt-0.5">{m.days} left</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WhatsAppBotDemo({ isMobile }: DemoProps) {
  const [visibleMsgs, setVisibleMsgs] = useState(0);
  const msgs = [
    {
      type: 'bot',
      text: 'Welcome to FitFlow Gym! 🏋️\n\n1️⃣ My Membership\n2️⃣ Renew Plan\n3️⃣ View Plans',
    },
    { type: 'user', text: '1' },
    {
      type: 'bot',
      text: '👤 Alex Mercer\n📅 Expiring Soon — 5 days\n🏷️ Platinum Plus (3M)\n\nReply 2 to renew!',
    },
    { type: 'user', text: '2' },
    {
      type: 'bot',
      text: '💳 Payment Link Generated!\nAmount: ₹3,999\n\nScan UPI QR or tap the link ↗',
    },
  ];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    msgs.forEach((_, i) => {
      timers.push(
        setTimeout(() => setVisibleMsgs(i + 1), 600 + i * 900)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!isMobile) {
    // Desktop View: Render as a gorgeous split WhatsApp Web mockup
    return (
      <div className="flex h-full bg-[#efeae2]" style={{ minHeight: 280 }}>
        {/* Chats Sidebar */}
        <div className="w-[30%] border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-700">Chats</span>
            <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 border-b border-slate-100 bg-emerald-50/50 flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px] font-bold">🤖</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-[9px] font-bold text-slate-800 truncate">FitFlow Gym Bot</p>
                  <span className="text-[7px] text-slate-400">online</span>
                </div>
                <p className="text-[8px] text-emerald-600 truncate">FitFlow Active</p>
              </div>
            </div>
            {/* Mock Chat Items for Visual Depth */}
            <div className="p-2 border-b border-slate-100 flex items-center gap-2 opacity-50">
              <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-[8px] font-bold">PS</div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-slate-800 truncate">Priya Sharma</p>
                <p className="text-[8px] text-slate-400 truncate">active 2m ago</p>
              </div>
            </div>
            <div className="p-2 border-b border-slate-100 flex items-center gap-2 opacity-50">
              <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-[8px] font-bold">RP</div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-slate-800 truncate">Raj Patel</p>
                <p className="text-[8px] text-slate-400 truncate">active 5m ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Feed Pane */}
        <div className="flex-1 flex flex-col bg-[#efeae2]">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px] font-bold">🤖</div>
            <div>
              <p className="text-[10px] font-bold text-slate-800">FitFlow Gym Bot</p>
              <p className="text-[8px] text-emerald-600">online</p>
            </div>
          </div>
          <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
            {msgs.slice(0, visibleMsgs).map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-[10px] leading-relaxed whitespace-pre-line shadow-sm ${
                    m.type === 'user'
                      ? 'bg-[#DCF8C6] text-slate-800 rounded-tr-sm'
                      : 'bg-white text-slate-800 rounded-tl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
            {visibleMsgs < msgs.length && visibleMsgs > 0 && (
              <div className="flex justify-start">
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 flex gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:.3s]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mobile view chassis content
  return (
    <div className="flex flex-col h-full bg-[#ECE5DD]">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-3 flex items-center gap-2 text-white">
        <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">
          FF
        </div>
        <div>
          <p className="text-[10px] font-bold">FitFlow Gym</p>
          <p className="text-[8px] text-emerald-200">online</p>
        </div>
        <Phone className="h-3 w-3 text-white/55 ml-auto" />
      </div>
      <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto bg-[#ECE5DD]" style={{ minHeight: 380 }}>
        {msgs.slice(0, visibleMsgs).map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-[10px] leading-relaxed whitespace-pre-line shadow-sm ${
                m.type === 'user'
                  ? 'bg-[#DCF8C6] text-slate-800 rounded-tr-sm'
                  : 'bg-white text-slate-800 rounded-tl-sm'
              }`}
            >
              {m.text}
            </div>
          </motion.div>
        ))}
        {visibleMsgs < msgs.length && visibleMsgs > 0 && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 flex gap-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:.3s]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InboxDemo({ isMobile }: DemoProps) {
  const threads = [
    {
      name: 'Priya Sharma',
      msg: 'I want to renew my plan...',
      time: '2m',
      unread: 2,
      avatar: 'PS',
      status: 'human',
    },
    { name: 'Raj Patel', msg: 'Thanks! Payment done ✅', time: '5m', unread: 0, avatar: 'RP', status: 'bot' },
    { name: 'Sneha Iyer', msg: 'What plans are available?', time: '12m', unread: 1, avatar: 'SI', status: 'bot' },
    { name: 'Vikram Singh', msg: 'Can I freeze membership?', time: '1h', unread: 0, avatar: 'VS', status: 'human' },
  ];

  if (isMobile) {
    // Mobile View: Render only the active chat interface (just like loading a chat thread)
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-600">
              PS
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-800">Priya Sharma</p>
              <p className="text-[8px] text-amber-600 flex items-center gap-1">
                <UserCheck className="h-2 w-2" />
                Human Takeover
              </p>
            </div>
          </div>
          <span className="text-[8px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
            LIVE
          </span>
        </div>
        <div className="flex-1 p-3 space-y-2 bg-slate-50/40 h-[380px]">
          <div className="flex justify-start">
            <div className="bg-white rounded-xl rounded-tl-sm px-2.5 py-1.5 text-[9px] text-slate-700 max-w-[80%] shadow-sm border border-slate-100">
              I want to renew my Gold plan
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-end"
          >
            <div className="bg-indigo-600 rounded-xl rounded-tr-sm px-2.5 py-1.5 text-[9px] text-white max-w-[80%] shadow-sm">
              Sure! I&apos;ll send you the renewal link right away 🔗
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Desktop Split-Pane View
  return (
    <div className="flex h-full" style={{ minHeight: 280 }}>
      <div className="w-[45%] border-r border-slate-100 bg-white">
        <div className="p-2.5 border-b border-slate-100">
          <div className="bg-slate-50 rounded-lg px-3 py-1.5 text-[9px] text-slate-400 border border-slate-100">
            🔍 Search inbox...
          </div>
        </div>
        {threads.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className={`flex items-center gap-2 p-2.5 border-b border-slate-50 cursor-pointer hover:bg-indigo-50/40 transition-colors ${
              i === 0 ? 'bg-indigo-50/60 border-l-2 border-l-indigo-500' : ''
            }`}
          >
            <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 flex-shrink-0">
              {t.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-800 truncate">{t.name}</p>
                <span className="text-[8px] text-slate-400">{t.time}</span>
              </div>
              <p className="text-[8px] text-slate-400 truncate">{t.msg}</p>
            </div>
            {t.unread > 0 && (
              <span className="h-4 w-4 rounded-full bg-indigo-600 text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0">
                {t.unread}
              </span>
            )}
          </motion.div>
        ))}
      </div>
      <div className="flex-1 flex flex-col bg-slate-50/30">
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-600">
              PS
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-800">Priya Sharma</p>
              <p className="text-[8px] text-amber-600 flex items-center gap-1">
                <UserCheck className="h-2.5 w-2.5" />
                Human Takeover
              </p>
            </div>
          </div>
          <span className="text-[8px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">
            LIVE
          </span>
        </div>
        <div className="flex-1 p-3 space-y-2">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-start"
          >
            <div className="bg-white rounded-xl rounded-tl-sm px-2.5 py-1.5 text-[9px] text-slate-700 max-w-[80%] shadow-sm border border-slate-100">
              I want to renew my Gold plan
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex justify-end"
          >
            <div className="bg-indigo-600 rounded-xl rounded-tr-sm px-2.5 py-1.5 text-[9px] text-white max-w-[80%] shadow-sm">
              Sure! I&apos;ll send you the renewal link right away 🔗
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PaymentsDemo({ isMobile }: DemoProps) {
  const payments = [
    {
      member: 'Alex Mercer',
      amount: '₹3,999',
      plan: 'Platinum',
      method: 'UPI',
      status: 'Verified',
      statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      member: 'Priya Sharma',
      amount: '₹1,499',
      plan: 'Gold',
      method: 'Razorpay',
      status: 'Pending',
      statusColor: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      member: 'Raj Patel',
      amount: '₹12,999',
      plan: 'VIP Club',
      method: 'UPI',
      status: 'Verified',
      statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
  ];

  return (
    <div className="p-5 space-y-3 bg-gradient-to-br from-slate-50/60 to-white h-full overflow-y-auto">
      <div className="grid grid-cols-3 gap-2 mb-1">
        {[
          { label: 'Collected', value: '₹23,995', color: 'text-emerald-600' },
          { label: 'This Month', value: '₹1.8L', color: 'text-indigo-600' },
          { label: 'Pending', value: '₹1,499', color: 'text-amber-600' },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-slate-100 p-2 text-center shadow-xs"
          >
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">
              {s.label}
            </span>
            <p className={`text-xs font-extrabold ${s.color} mt-0.5`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {payments.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 px-2 py-2 shadow-xs"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-slate-800 truncate">{p.member}</p>
              <p className="text-[7px] text-slate-400 truncate">
                {p.plan} · {p.method}
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-800">{p.amount}</span>
            <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full border ${p.statusColor}`}>
              {p.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SettingsDemo({ isMobile }: DemoProps) {
  const [toggles, setToggles] = useState([true, true, false, true]);
  const items = [
    { label: 'Auto-reply enabled', desc: 'Bot replies instantly', icon: Bot },
    { label: 'UPI QR Codes', desc: 'Auto QR billing', icon: CreditCard },
    { label: 'Multi-lingual', desc: 'Hindi & regional support', icon: Globe },
    { label: 'Expiry Alerts', desc: '3-day auto reminders', icon: Bell },
  ];

  const visibleItems = isMobile ? items.slice(0, 3) : items;

  return (
    <div className="p-5 space-y-3 bg-gradient-to-br from-slate-50/60 to-white h-full overflow-y-auto">
      <div className="space-y-2">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
          Bot Configuration
        </p>
        {visibleItems.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-2.5 shadow-sm"
          >
            <div className="h-6 w-6 rounded-lg bg-indigo-55 flex items-center justify-center text-indigo-600 bg-indigo-50">
              <s.icon className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-slate-800 truncate">{s.label}</p>
              <p className="text-[7px] text-slate-400 truncate">{s.desc}</p>
            </div>
            <button
              onClick={() => {
                const n = [...toggles];
                n[i] = !n[i];
                setToggles(n);
              }}
              className={`w-7 h-4 rounded-full flex items-center px-0.5 transition-colors cursor-pointer border-0 ${
                toggles[i] ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <motion.div
                animate={{ x: toggles[i] ? 12 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="h-3 w-3 rounded-full bg-white shadow-sm"
              />
            </button>
          </motion.div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-100 p-2.5 shadow-sm">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          WhatsApp status
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono font-bold text-slate-800 bg-slate-50 rounded px-1.5 py-0.5 border border-slate-100">
            +91 98765 43210
          </span>
          <span className="text-[7px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
            Connected ✓
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Demo Showcase Container ─────────── */
const demoTabs = [
  { id: 'dashboard', label: 'Dashboard', emoji: '📊', url: 'fitflow.app/dashboard', component: DashboardDemo },
  { id: 'members', label: 'Members', emoji: '👥', url: 'fitflow.app/members', component: MembersDemo },
  { id: 'whatsapp', label: 'WhatsApp Bot', emoji: '🤖', url: 'fitflow.app/chatbot', component: WhatsAppBotDemo },
  { id: 'inbox', label: 'Live Inbox', emoji: '💬', url: 'fitflow.app/inbox', component: InboxDemo },
  { id: 'payments', label: 'Payments', emoji: '💳', url: 'fitflow.app/payments', component: PaymentsDemo },
  { id: 'settings', label: 'Settings', emoji: '⚙️', url: 'fitflow.app/settings', component: SettingsDemo },
];

export default function DemoShowcase() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileView, setIsMobileView] = useState(false);

  const activeDemo = demoTabs.find((t) => t.id === activeTab)!;
  const ActiveComponent = activeDemo.component;

  return (
    <div className="space-y-8">
      {/* Neumorphic Navigation Tabs */}
      <div className="flex flex-wrap justify-center gap-3">
        {demoTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`demo-tab neu-button ${
                isActive ? 'neu-button-active demo-tab-active font-extrabold' : ''
              }`}
            >
              <span className="text-base">{tab.emoji}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Simulator Container */}
      <div className="demo-preview-card neu-flat max-w-4xl mx-auto overflow-hidden">
        
        {/* Browser Top Bar with Neumorphic Viewport Switcher */}
        <div className="demo-browser-chrome flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="demo-browser-dot bg-rose-400" />
            <div className="demo-browser-dot bg-amber-400" />
            <div className="demo-browser-dot bg-emerald-400" />
          </div>
          
          <div className="demo-browser-url max-w-md hidden md:block">
            <AnimatePresence mode="wait">
              <motion.span
                key={activeTab}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
              >
                {isMobileView ? `m.${activeDemo.url}` : activeDemo.url}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Neumorphic Viewport Switcher with Sliding Background Pill */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner relative select-none w-44">
            <div 
              className="absolute inset-y-1 bg-white rounded-lg shadow-xs border border-slate-200/50 transition-all duration-300"
              style={{
                left: isMobileView ? 'calc(50% + 2px)' : '4px',
                right: isMobileView ? '4px' : 'calc(50% + 2px)',
              }}
            />
            <button
              onClick={() => setIsMobileView(false)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold transition-colors border-0 bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                !isMobileView
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Desktop Browser Frame"
            >
              <Monitor className="h-3 w-3" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setIsMobileView(true)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold transition-colors border-0 bg-transparent cursor-pointer ${
                isMobileView
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="iPhone Device Frame"
            >
              <Smartphone className="h-3 w-3" />
              <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* PREVIEW FRAME */}
        <div className="p-6 bg-slate-50/50 flex justify-center items-center relative min-h-[360px]">
          
          <AnimatePresence mode="wait">
            {!isMobileView ? (
              /* DESKTOP VIEWPORT FRAME */
              <motion.div
                key="desktop"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md"
              >
                <div className="dashboard-scanner" />
                <ActiveComponent isMobile={false} />
              </motion.div>
            ) : (
              /* MOBILE VIEWPORT FRAME (iPhone 15 Pro Chassis with Thin Premium Bezel) */
              <motion.div
                key="mobile"
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="relative w-[280px] sm:w-[310px] bg-slate-950 rounded-[44px] p-2.5 border border-slate-800 shadow-2xl overflow-hidden select-none"
              >
                {/* Thin Bezel Screen Border */}
                <div className="absolute inset-0 border-[6px] border-slate-950 rounded-[44px] pointer-events-none z-45" />

                {/* Notch / Dynamic Island */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-30 flex items-center justify-between px-2.5">
                  <span className="h-1 w-1 rounded-full bg-slate-900" />
                  <span className="h-0.5 w-6 bg-slate-900/50 rounded-full" />
                </div>
                
                {/* Screen Content Wrapper */}
                <div className="bg-white rounded-[36px] overflow-hidden border border-slate-950 relative h-[420px] flex flex-col">
                  {/* Status Bar */}
                  <div className="bg-white text-slate-800 text-[8px] font-bold px-5 pt-3.5 pb-1 flex justify-between select-none">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1.5 bg-slate-800 rounded-xs" />
                      <span className="h-1 w-1 bg-slate-800 rounded-xs" />
                    </div>
                  </div>

                  <div className="flex-1 relative overflow-y-auto">
                    <div className="dashboard-scanner" />
                    <ActiveComponent isMobile={true} />
                  </div>
                  
                  {/* Home Indicator Bar */}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-slate-400 rounded-full z-30" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
