'use client';

import React from 'react';
import Link from 'next/link';
import { Dumbbell, Headphones, Phone } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white">
                <Dumbbell className="h-4 w-4" />
              </div>
              <span className="text-base font-extrabold text-white">
                Fit<span className="text-indigo-400">Flow</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              WhatsApp-first gym membership automation. Built for modern fitness businesses.
            </p>
            <div className="flex gap-2 pt-1">
              {['Twitter', 'GitHub', 'Discord'].map((s) => (
                <span
                  key={s}
                  className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-5">
              Product
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#features" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#demo" className="hover:text-white transition-colors">
                  Live Demo
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-5">
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#journey" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-5">
              Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Headphones className="h-3.5 w-3.5 text-slate-600" /> help@fitflow.app
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-600" /> +91 98765 43210
              </li>
              <li className="flex items-center gap-2 text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> All
                systems online
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© {currentYear} FitFlow Inc. All rights reserved.</p>
          <p>Made with ❤️ for gym owners everywhere</p>
        </div>
      </div>
    </footer>
  );
}
