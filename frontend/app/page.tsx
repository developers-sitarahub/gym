'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  ArrowRight,
  Play,
  ShieldCheck,
  Zap,
  Users,
  MessageCircle,
  CheckCircle2,
  TrendingUp,
  Star,
  Check,
  ChevronDown,
  ArrowUpRight,
  Bot,
  QrCode,
  Bell,
  Settings,
  BarChart3,
  Globe,
  Layers,
  Sparkles,
  Heart,
  Shield,
  Target,
  CreditCard,
} from 'lucide-react';

import ThreeDashboardAnimation from '../components/dashboard/ThreeDashboardAnimation';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import RoiCalculator from '../components/landing/RoiCalculator';
import DemoShowcase from '../components/landing/DemoShowcase';
import TearLoader from '../components/landing/TearLoader';

/* ─────────── Animation helpers ─────────── */
function FadeUp({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(e * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─────────── Gradient Orb ─────────── */
function GlowOrb({ className }: { className: string }) {
  return <div className={`absolute rounded-full pointer-events-none ${className}`} />;
}

/* ── types ── */
interface ChatMessage {
  id: string;
  type: 'INBOUND' | 'CHATBOT';
  message: string;
  time: string;
}

const timeline = [
  {
    year: '2024',
    title: 'The Idea',
    desc:
      'Frustrated by manual member tracking and payment follow-ups at local gyms, the FitFlow concept was born — automate it all via WhatsApp.',
    icon: Sparkles,
    color: 'bg-indigo-600',
  },
  {
    year: '2025',
    title: 'First Bot Goes Live',
    desc:
      'Our WhatsApp chatbot launched with 5 pilot gyms in Mumbai. Within weeks, renewal rates jumped 40%. The product-market fit was undeniable.',
    icon: Bot,
    color: 'bg-violet-600',
  },
  {
    year: '2025',
    title: 'UPI & Razorpay Integration',
    desc:
      'Automated UPI QR code generation and Razorpay webhooks for instant payment verification. Members could now pay and auto-renew without any staff involvement.',
    icon: CreditCard,
    color: 'bg-emerald-600',
  },
  {
    year: '2026',
    title: '500+ Gyms Onboarded',
    desc:
      'FitFlow now powers gym operations across India — from boutique studios to multi-branch chains. Processing lakhs in automated renewals every month.',
    icon: TrendingUp,
    color: 'bg-amber-600',
  },
];

const values = [
  {
    icon: Zap,
    title: 'Zero Friction',
    desc: 'No app downloads, no portals. Everything happens inside WhatsApp — where your members already are.',
  },
  {
    icon: Heart,
    title: 'Built for Gym Owners',
    desc: 'We obsess over the problems real gym owners face. Every feature is designed to save time and recover revenue.',
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    desc: 'End-to-end encryption, Razorpay-grade security, and 99.8% uptime SLA. Your data is always safe.',
  },
  {
    icon: Globe,
    title: 'India-First Design',
    desc: 'UPI payments, INR pricing, WhatsApp-native. Built ground-up for the Indian fitness market.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    desc: 'Our roadmap is shaped by gym owners. Feature requests, feedback, and real-world testing drive every release.',
  },
  {
    icon: Target,
    title: 'Results Obsessed',
    desc: "We measure success by one metric: how much revenue we help you recover. If you don't grow, we don't grow.",
  },
];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE — PREMIUM LIGHT MODE + NOIR ALWAYS ACTIVE
   ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [headlineWordIndex, setHeadlineWordIndex] = useState(0);
  const headlineWords = ['Fully Automated', 'Always Paid', 'Stress-Free'];
  useEffect(() => {
    const cycle = setInterval(() => {
      setHeadlineWordIndex((p) => (p + 1) % headlineWords.length);
    }, 2800);
    return () => clearInterval(cycle);
  }, []);

  const [activeToast, setActiveToast] = useState<{ gym: string; action: string; time: string } | null>(null);
  useEffect(() => {
    const toasts = [
      { gym: 'PowerFit Gym (Mumbai)', action: 'collected ₹3,999 renewal', time: 'Just now' },
      { gym: 'FlexZone Studio (Bangalore)', action: 'automated 14 check-ins', time: '1m ago' },
      { gym: 'IronCore Fitness (Ahmedabad)', action: 'recovered ₹12,999 annual plan', time: '3m ago' },
      { gym: 'Gold Standard Gym (Delhi)', action: 'sent 8 auto-renew alerts', time: '5m ago' },
      { gym: 'Dumbbell Club (Pune)', action: 'collected ₹1,499 Gold membership', time: '8m ago' },
    ];
    const timer = setTimeout(() => {
      setActiveToast(toasts[Math.floor(Math.random() * toasts.length)]);
      const hideTimer = setTimeout(() => {
        setActiveToast(null);
      }, 4000);
      return () => clearTimeout(hideTimer);
    }, 6000);
    const interval = setInterval(() => {
      setActiveToast(toasts[Math.floor(Math.random() * toasts.length)]);
      setTimeout(() => {
        setActiveToast(null);
      }, 4000);
    }, 18000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  /* FAQ state */
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);

  const faqs = [
    {
      q: 'How does the WhatsApp bot work?',
      a:
        'Members text your gym\'s WhatsApp number. FitFlow auto-responds with membership info, renewal links, and UPI payment QR codes — no staff needed.',
    },
    {
      q: 'Do members need to install an app?',
      a: 'Nope! Everything happens inside WhatsApp, which your members already use daily. Zero friction.',
    },
    {
      q: 'How do payments work?',
      a:
        'FitFlow generates dynamic UPI QR codes & Razorpay checkout links per member. Webhooks auto-confirm payment and extend memberships instantly.',
    },
    {
      q: 'What is Human Takeover?',
      a:
        'One click pauses the bot for a specific member so your staff can chat with them directly through FitFlow\'s live inbox.',
    },
    {
      q: 'Can I customize alert schedules?',
      a:
        'Yes — set alerts for 3 days before expiry, day-of, and post-expiry with personalized templates including member name, plan, and payment link.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-900 font-sans overflow-x-hidden relative noir-mode-active">
      {/* Visual Page-Tear Transition Loader */}
      <TearLoader />

      {/* Noir Checkerboard Overlay */}
      <div className="noir-checkerboard" />

      {/* NAVBAR */}
      <Navbar />

      {/* HERO */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
        <GlowOrb className="top-0 right-0 w-[700px] h-[700px] bg-gradient-to-br from-indigo-100/60 to-violet-100/40 blur-3xl -translate-y-1/3 translate-x-1/4" />
        <GlowOrb className="bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-rose-100/30 to-orange-100/20 blur-3xl translate-y-1/4 -translate-x-1/4" />

        <div className="relative max-w-7xl mx-auto px-6 z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <span className="inline-flex items-center gap-2 bg-[#f0f2f5] neu-flat text-indigo-750 text-xs font-bold px-4 py-2 rounded-full border border-white/80 shadow-sm mb-8">
                <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-online" />
                Now Live — WhatsApp Automation for Gyms
                <SparklesIcon />
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tight"
            >
              <span className="text-slate-900">Your Gym,</span>
              <br />
              <span className="relative inline-block h-[1.1em] overflow-hidden align-bottom min-w-[280px] sm:min-w-[420px] md:min-w-[480px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={headlineWordIndex}
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -24, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 right-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent block whitespace-nowrap"
                  >
                    {headlineWords[headlineWordIndex]}
                  </motion.span>
                </AnimatePresence>
                <span className="opacity-0 pointer-events-none select-none block whitespace-nowrap">
                  Fully Automated
                </span>
              </span>
              <br />
              <span className="text-slate-900">via WhatsApp</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-7 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed"
            >
              Members check status, renew plans & pay via UPI — all inside WhatsApp. You manage everything from one
              beautiful dashboard. No more chasing payments.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all"
              >
                Start Free — No Card Required{' '}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#demo"
                className="group inline-flex items-center justify-center gap-2 bg-[#f0f2f5] neu-button text-slate-700 hover:text-indigo-600 font-bold text-sm px-8 py-4 rounded-2xl shadow-sm transition-all"
              >
                <Play className="h-4 w-4 fill-current text-indigo-500" /> Try Live Demo
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-10 flex items-center justify-center gap-6 flex-wrap"
            >
              {[
                { icon: ShieldCheck, label: 'Razorpay Secured', color: 'text-emerald-600' },
                { icon: Zap, label: 'Setup in 10 min', color: 'text-amber-600' },
                { icon: Users, label: '500+ Gym Owners', color: 'text-indigo-600' },
              ].map((b, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-xs font-semibold ${b.color}`}>
                  <b.icon className="h-4 w-4" /> {b.label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero Dashboard Card */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.9, type: 'spring', stiffness: 40 }}
            className="mt-16 max-w-5xl mx-auto relative px-4 sm:px-0"
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute -left-12 top-1/4 hidden lg:flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2.5 shadow-md shadow-indigo-100/50 z-25 text-xs font-bold text-indigo-700 select-none"
            >
              <MessageCircle className="h-4 w-4 text-indigo-500" />
              <span>UPI Payment Link Sent 💬</span>
            </motion.div>
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
              className="absolute -right-12 bottom-1/4 hidden lg:flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5 shadow-md shadow-emerald-100/50 z-25 text-xs font-bold text-emerald-700 select-none"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Payment Verified ₹3,999 ✅</span>
            </motion.div>

            <div className="hero-dashboard-container neu-flat rounded-3xl overflow-hidden relative">
              <div className="dashboard-scanner" />
              <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-3 flex items-center gap-3">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 bg-white rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-400 text-center font-medium animate-pulse">
                  fitflow.app/dashboard
                </div>
              </div>
              <div className="p-5 md:p-8 bg-gradient-to-br from-slate-50/60 to-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: 'Revenue',
                      value: '₹1,84,400',
                      change: '+12%',
                      color: 'text-emerald-600',
                      bg: 'bg-emerald-50',
                      border: 'border-emerald-100',
                      icon: TrendingUp,
                    },
                    {
                      label: 'Active Members',
                      value: '184',
                      change: '92% retained',
                      color: 'text-blue-600',
                      bg: 'bg-blue-50',
                      border: 'border-blue-100',
                      icon: Users,
                    },
                    {
                      label: 'Bot Chats Today',
                      value: '47',
                      change: '12 active now',
                      color: 'text-violet-600',
                      bg: 'bg-violet-50',
                      border: 'border-violet-100',
                      icon: MessageCircle,
                    },
                    {
                      label: 'Auto Renewals',
                      value: '38',
                      change: 'This week',
                      color: 'text-amber-600',
                      bg: 'bg-amber-50',
                      border: 'border-amber-100',
                      icon: Zap,
                    },
                  ].map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0 + i * 0.08 }}
                      className={`bg-white rounded-2xl border ${s.border} p-4 shadow-sm hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {s.label}
                        </span>
                        <div className={`h-8 w-8 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                          <s.icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{s.value}</p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${s.color}`}>{s.change}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                      Revenue — Last 6 Months
                    </p>
                    <div className="h-36 flex items-end justify-center gap-4 px-2">
                      {[35, 50, 42, 68, 82, 100].map((h, i) => (
                        <div key={i} className="flex flex-col items-center justify-end h-full group pb-1">
                          <span className="text-[9px] font-extrabold text-indigo-600 scale-90 group-hover:scale-100 group-hover:-translate-y-0.5 transition-all opacity-0 group-hover:opacity-100 duration-200 mb-0.5 select-none">
                            ₹{Math.round(h * 1.84)}k
                          </span>
                          <motion.div
                            style={{ height: `${h * 0.7}%` }}
                            initial={{ height: 0 }}
                            animate={{ height: `${h * 0.7}%` }}
                            transition={{ delay: 1.2 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="w-8 sm:w-10 rounded-t-lg bg-gradient-to-t from-indigo-600 to-violet-600 shadow-md hover:shadow-indigo-500/30 transition-all duration-200 cursor-pointer"
                          />
                          <span className="text-[10px] font-bold text-slate-400 mt-1.5">
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Check-in Network
                    </p>
                    <div className="flex-1 flex items-center justify-center min-h-[140px]">
                      <ThreeDashboardAnimation />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-[#f0f2f5] border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            {
              v: 85,
              suffix: '%',
              l: 'Faster Renewals',
              icon: Zap,
              color: 'text-indigo-600',
            },
            {
              v: 10,
              suffix: '×',
              l: 'Less App Friction',
              icon: TargetIcon,
              color: 'text-violet-600',
            },
            {
              v: 24,
              suffix: 'L+',
              l: 'Payments Processed',
              icon: TrendingUp,
              color: 'text-emerald-600',
            },
            {
              v: 99,
              suffix: '.8%',
              l: 'Bot Uptime',
              icon: ShieldCheck,
              color: 'text-amber-600',
            },
          ].map((s, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div className="group flex flex-col items-center">
                <div
                  className={`neu-button inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3 group-hover:scale-110 transition-transform ${s.color}`}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="text-3xl md:text-4xl font-extrabold text-slate-900">
                  <AnimatedCounter target={s.v} suffix={s.suffix} />
                </p>
                <p className="text-sm font-medium text-slate-400 mt-1">{s.l}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 md:py-28 bg-[#f0f2f5] relative overflow-hidden">
        <GlowOrb className="top-0 right-0 w-[600px] h-[600px] bg-indigo-50/80 blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="relative max-w-7xl mx-auto px-6 z-10">
          <FadeUp className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <SparklesIcon /> Powerful Features
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Everything your gym needs,{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                in one place
              </span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed">
              From WhatsApp automation to UPI payments — run your entire membership lifecycle effortlessly.
            </p>
          </FadeUp>
          <div className="grid md:grid-cols-6 gap-5">
            <FadeUp className="md:col-span-4">
              <div className="feature-card group h-full bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/10 blur-3xl translate-x-1/3 -translate-y-1/3" />
                <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="relative z-10">
                  <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-6 border border-white/20">
                    <Bot className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">WhatsApp Chatbot</h3>
                  <p className="text-indigo-105 leading-relaxed max-w-md text-[15px] text-slate-100">
                    Members text your gym number, the bot replies instantly — check membership, view plans, initiate
                    renewals, get payment links. Zero staff effort required.
                  </p>
                  <div className="mt-6 flex gap-3 flex-wrap">
                    {['Auto-replies', 'Multi-language', '24/7 active'].map((t) => (
                      <span
                        key={t}
                        className="text-xs font-semibold bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>
            <div className="md:col-span-2 flex flex-col gap-5">
              {[
                {
                  icon: QrCode,
                  color: 'text-emerald-600',
                  title: 'Instant UPI Payments',
                  desc: 'Auto QR codes & Razorpay links. Webhooks verify & extend memberships.',
                },
                {
                  icon: Bell,
                  color: 'text-amber-600',
                  title: 'Smart Renewal Alerts',
                  desc: 'Automated reminders with personalized templates & payment links.',
                },
              ].map((c, i) => (
                <FadeUp key={i} delay={0.1 + i * 0.05}>
                  <div
                    className={`feature-card group neu-flat rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
                  >
                    <div
                      className={`neu-button h-12 w-12 rounded-2xl flex items-center justify-center ${c.color} mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <c.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1.5">{c.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
            {[
              {
                icon: ShieldCheck,
                color: 'text-rose-600',
                title: 'Human Takeover',
                desc: 'Pause bot, chat directly through live inbox.',
              },
              {
                icon: BarChart3,
                color: 'text-blue-600',
                title: 'Revenue Dashboard',
                desc: 'Real-time payments, members & trend analytics.',
              },
              {
                icon: Settings,
                color: 'text-violet-600',
                title: 'Plan & CRM Manager',
                desc: 'Create tiers, manage profiles, configure bot.',
              },
            ].map((f, i) => (
              <FadeUp key={i} delay={0.1 + i * 0.08} className="md:col-span-2">
                <div
                  className={`feature-card group neu-flat rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full`}
                >
                  <div
                    className={`neu-button h-12 w-12 rounded-2xl flex items-center justify-center ${f.color} mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 md:py-28 bg-[#f0f2f5]">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp className="text-center max-w-2xl mx-auto mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Simple Setup
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Go live in <span className="text-violet-600">10 minutes</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed">
              Three steps to fully automate gym memberships.
            </p>
          </FadeUp>
          <div className="space-y-16 md:space-y-0 md:grid md:grid-cols-3 md:gap-10 relative">
            <div className="hidden md:block absolute top-14 left-[18%] right-[18%] h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-emerald-200 rounded-full animate-pulse" />
            {[
              {
                step: '01',
                title: 'Register Your Gym',
                desc: 'Sign up, add gym details, create membership plans, and connect your WhatsApp number.',
                icon: Globe,
                gradient: 'from-indigo-500 to-blue-600',
                shadow: 'shadow-indigo-500/25',
              },
              {
                step: '02',
                title: 'Members Text You',
                desc: 'Members message your WhatsApp. Bot auto-replies with status, plans, and UPI payment links instantly.',
                icon: MessageCircle,
                gradient: 'from-violet-500 to-purple-600',
                shadow: 'shadow-violet-500/25',
              },
              {
                step: '03',
                title: 'Payments Auto-Sync',
                desc: 'UPI/Razorpay webhooks verify payments and extend memberships automatically. You just watch.',
                icon: CheckCircle2,
                gradient: 'from-emerald-500 to-teal-600',
                shadow: 'shadow-emerald-500/25',
              },
            ].map((s, i) => (
              <FadeUp key={i} delay={i * 0.15}>
                <div className="text-center group">
                  <div
                    className={`h-16 w-16 bg-gradient-to-br ${s.gradient} rounded-3xl flex items-center justify-center text-white shadow-xl ${s.shadow} mx-auto mb-6 relative z-10 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300`}
                  >
                    <s.icon className="h-7 w-7" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-350 uppercase tracking-widest">
                    Step {s.step}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-2 mb-3">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE (JOURNEY) */}
      <section id="journey" className="py-24 md:py-28 bg-[#f0f2f5] border-y border-slate-200/80 relative overflow-hidden">
        <GlowOrb className="top-1/2 left-0 w-[400px] h-[400px] bg-violet-100/40 blur-[100px] -translate-x-1/2 -translate-y-1/2" />

        <div className="relative max-w-4xl mx-auto px-6 z-10">
          <FadeUp className="text-center mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <Sparkles className="h-3.5 w-3.5" /> Our Journey
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              From idea to <span className="text-violet-600">500+ gyms</span>
            </h2>
          </FadeUp>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-8 md:left-1/2 -translate-x-px top-0 bottom-0 w-1 bg-black" />

            <div className="space-y-12">
              {timeline.map((item, i) => (
                <FadeUp key={i} delay={i * 0.15}>
                  <div
                    className={`relative flex items-start gap-6 md:gap-12 ${
                      i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-8 md:left-1/2 -translate-x-1/2 z-10">
                      <div
                        className={`h-12 w-12 ${item.color} rounded-2xl flex items-center justify-center text-white border-4 border-black shadow-[3px_3px_0px_#000000]`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Content Card (Brutalist + Neumorphic Neubrutalist Style) */}
                    <div
                      className={`ml-20 md:ml-0 ${
                        i % 2 === 0
                          ? 'md:w-[calc(50%-40px)] md:text-right'
                          : 'md:w-[calc(50%-40px)] md:ml-auto'
                      }`}
                    >
                      <div className="feature-card neu-flat p-6 rounded-2xl text-left border-4 border-black shadow-[6px_6px_0px_#000000] inline-block w-full">
                        <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest">
                          {item.year}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-1 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CORE VALUES */}
      <section id="values" className="py-24 md:py-28 bg-[#f0f2f5] border-b border-slate-200/85">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <Heart className="h-3.5 w-3.5 fill-current text-rose-500" /> What We Stand For
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Our <span className="text-emerald-600">core values</span>
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className="feature-card neu-flat rounded-3xl p-6 transition-all duration-300 h-full flex flex-col">
                  <div
                    className={`neu-button h-12 w-12 rounded-2xl flex items-center justify-center mb-4 text-emerald-600`}
                  >
                    <v.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT DEMO SHOWCASE */}
      <section
        id="demo"
        className="py-24 md:py-28 bg-[#f0f2f5] relative overflow-hidden"
      >
        <GlowOrb className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-100/40 blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-6 z-10">
          <FadeUp className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <Play className="h-3.5 w-3.5 fill-current" /> Product Tour
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              See every feature <span className="text-emerald-600">in action</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed">
              Click through each tab to preview what your dashboard looks like — interactive, animated, and beautiful.
            </p>
          </FadeUp>

          <DemoShowcase />
        </div>
      </section>

      {/* ROI CALCULATOR */}
      <section className="py-24 bg-[#f0f2f5] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(99,102,241,.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative max-w-7xl mx-auto px-6 z-10">
          <FadeUp className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <TrendingUp className="h-3.5 w-3.5" /> ROI Estimator
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              See what you will <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent font-sans">save & earn</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed">
              Calculate how much time you save and how much extra revenue you recover with automated billing.
            </p>
          </FadeUp>
          <RoiCalculator />
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 md:py-28 bg-[#f0f2f5]">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <Star className="h-3.5 w-3.5 fill-current" /> Trusted by Gym Owners
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Real results from <span className="text-amber-600">real gyms</span>
            </h2>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Rajesh Sharma',
                gym: 'PowerFit Gym, Mumbai',
                text:
                  'We went from chasing 40+ expired members monthly to fully automated renewals. Revenue jumped 30% in 2 months.',
                avatar: 'RS',
                bg: 'bg-indigo-100',
                color: 'text-indigo-600',
              },
              {
                name: 'Priya Menon',
                gym: 'FlexZone Studio, Bangalore',
                text:
                  "Members love renewing via WhatsApp. Our staff spends zero time on billing now — it's completely automated.",
                avatar: 'PM',
                bg: 'bg-violet-100',
                color: 'text-violet-600',
              },
              {
                name: 'Amit Patel',
                gym: 'IronCore Fitness, Ahmedabad',
                text:
                  'The human takeover feature is brilliant. Bot handles 95% of queries and we step in only when needed.',
                avatar: 'AP',
                bg: 'bg-emerald-100',
                color: 'text-emerald-600',
              },
            ].map((t, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="testimonial-card neu-flat rounded-3xl p-8 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-[15px] text-slate-600 leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
                  <div className="mt-6 pt-5 border-t border-slate-200/60 flex items-center gap-3">
                    <div
                      className={`h-11 w-11 rounded-full ${t.bg} flex items-center justify-center text-sm font-bold ${t.color}`}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.gym}</p>
                    </div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 md:py-28 bg-[#f0f2f5] relative overflow-hidden">
        <GlowOrb className="bottom-0 left-0 w-[500px] h-[500px] bg-violet-50/80 blur-3xl -translate-x-1/3 translate-y-1/3" />
        <div className="relative max-w-6xl mx-auto px-6 z-10">
          <FadeUp className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <Layers className="h-3.5 w-3.5" /> Pricing Plans
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Plans that <span className="text-indigo-600">grow with you</span>
            </h2>
            <div className="mt-8 flex items-center justify-center gap-3">
              <span
                className={`text-sm font-semibold transition-colors ${!annual ? 'text-slate-900' : 'text-slate-400'}`}
              >
                Monthly
              </span>
              <button
                onClick={() => setAnnual(!annual)}
                className="w-14 h-8 rounded-full neu-inset p-1 flex items-center cursor-pointer border-0 transition-colors"
              >
                <motion.div
                  animate={{ x: annual ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="h-6 w-6 rounded-full bg-indigo-600 shadow-md"
                />
              </button>
              <span
                className={`text-sm font-semibold transition-colors ${annual ? 'text-slate-900' : 'text-slate-400'}`}
              >
                Annual{' '}
                <span className="text-[10px] text-emerald-750 font-bold bg-emerald-50 px-2 py-0.5 rounded-full ml-1 border border-emerald-100">
                  Save 20%
                </span>
              </span>
            </div>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter',
                price: annual ? '₹1,599' : '₹1,999',
                desc: 'Perfect for small gyms.',
                features: [
                  'Up to 150 members',
                  'WhatsApp bot automation',
                  'UPI + Razorpay payments',
                  'Daily expiry alerts',
                  'Email support',
                ],
                cta: 'Start Free Trial',
                highlight: false,
              },
              {
                name: 'Pro',
                price: annual ? '₹3,199' : '₹3,999',
                desc: 'For growing studios.',
                features: [
                  'Up to 500 members',
                  'Human Takeover & Live Chat',
                  'Custom bot templates',
                  'Advanced alert schedules',
                  'Priority support',
                ],
                cta: 'Choose Pro',
                highlight: true,
              },
              {
                name: 'Enterprise',
                price: annual ? '₹6,399' : '₹7,999',
                desc: 'Multi-branch networks.',
                features: [
                  'Unlimited members',
                  'Multi-location support',
                  'Dedicated database',
                  'Custom API webhooks',
                  '24/7 account manager',
                ],
                cta: 'Contact Sales',
                highlight: false,
              },
            ].map((p, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative rounded-3xl h-full flex flex-col ${p.highlight ? 'z-10' : ''}`}>
                  {p.highlight && (
                    <div className="absolute -inset-[2px] bg-gradient-to-b from-indigo-500 via-violet-500 to-purple-500 rounded-[26px]" />
                  )}
                  <div
                    className={`pricing-card relative neu-flat rounded-3xl p-8 flex flex-col flex-1 ${
                      p.highlight
                        ? 'shadow-xl shadow-indigo-500/15'
                        : 'hover:-translate-y-0.5 transition-all'
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-extrabold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                        Most Popular
                      </span>
                    )}
                    <div className="pt-1">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{p.name}</h3>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={p.price}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="text-4xl font-extrabold text-slate-900 mt-2"
                        >
                          {p.price}
                          <span className="text-base text-slate-400 font-medium">/mo</span>
                        </motion.p>
                      </AnimatePresence>
                      <p className="text-sm mt-1 text-slate-500">{p.desc}</p>
                    </div>
                    <ul className="mt-8 space-y-3.5 flex-1">
                      {p.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-3 text-sm">
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              p.highlight ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                          <span className="text-slate-600">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/register"
                      className={`mt-8 w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 block ${
                        p.highlight
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5'
                          : 'bg-slate-200 text-slate-700 hover:bg-indigo-600 hover:text-white'
                      }`}
                    >
                      {p.cta}
                    </Link>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 md:py-28 bg-[#f0f2f5]">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp className="text-center mb-14">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              FAQ
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Common questions
            </h2>
          </FadeUp>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <div className="neu-flat rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left cursor-pointer border-0 bg-transparent"
                  >
                    <span className="text-[15px] font-bold text-slate-800">{f.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ml-4 ${
                        openFaq === i ? 'rotate-180 text-indigo-500' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm text-slate-550 leading-relaxed text-slate-500">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="relative max-w-4xl mx-auto px-6 text-center z-10">
          <FadeUp>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Ready to automate
              <br />
              your gym?
            </h2>
            <p className="mt-5 text-indigo-100 max-w-xl mx-auto text-lg leading-relaxed">
              Join hundreds of gym owners who have eliminated manual billing. Setup takes under 10 minutes.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 bg-white text-indigo-700 font-extrabold text-sm px-10 py-4 rounded-2xl shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all"
              >
                Start Your Free Trial{' '}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white hover:bg-white/10 font-semibold text-sm px-10 py-4 rounded-2xl transition-all"
              >
                Log In to Dashboard <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}

/* ─────────── Helper Icons ─────────── */
function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 text-amber-500"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
