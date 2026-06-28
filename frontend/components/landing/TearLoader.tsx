'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell } from 'lucide-react';

export default function TearLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasPlayed = sessionStorage.getItem('fitflow_tear_loader_played');
      if (hasPlayed) {
        setLoading(false);
        return;
      }
    }

    // Prevent scrolling during active load
    document.body.style.overflow = 'hidden';

    let exitTimeout: NodeJS.Timeout;

    const handlePageLoadComplete = () => {
      // Small buffer delay to appreciate the smooth entry animation
      exitTimeout = setTimeout(() => {
        setLoading(false);
        document.body.style.overflow = '';
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('fitflow_tear_loader_played', 'true');
        }
      }, 1200);
    };

    // Fallback load release
    const fallbackTimer = setTimeout(handlePageLoadComplete, 3500);

    if (document.readyState === 'complete') {
      handlePageLoadComplete();
    } else {
      window.addEventListener('load', handlePageLoadComplete);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('load', handlePageLoadComplete);
      clearTimeout(fallbackTimer);
      if (exitTimeout) clearTimeout(exitTimeout);
    };
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            clipPath: 'circle(0% at 50% 50%)',
            transition: { duration: 0.95, ease: [0.76, 0, 0.24, 1] }
          }}
          className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center overflow-hidden"
          style={{ clipPath: 'circle(100% at 50% 50%)' }}
        >
          {/* Radial ambient glow in center */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_60%)] pointer-events-none" />

          {/* Core loader branding card */}
          <div className="relative flex flex-col items-center gap-6 z-10">
            
            {/* Double ring rotating status spinner */}
            <div className="relative flex items-center justify-center w-28 h-28">
              {/* Outer ring - Indigo/Pink */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-t-indigo-500 border-r-pink-500 border-b-transparent border-l-transparent"
              />
              {/* Inner ring - Cyan/Emerald */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                className="absolute inset-2.5 rounded-full border border-t-transparent border-r-transparent border-b-emerald-400 border-l-cyan-400 opacity-70"
              />
              
              {/* Inner Central Pulsing Dumbbell Container */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.04, 1],
                  boxShadow: [
                    '0 0 15px rgba(99,102,241,0.2)',
                    '0 0 25px rgba(99,102,241,0.45)',
                    '0 0 15px rgba(99,102,241,0.2)'
                  ]
                }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white border border-indigo-400/25 shadow-lg shadow-black/80"
              >
                <Dumbbell className="h-8 w-8 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
              </motion.div>
            </div>

            {/* Typography brand labels */}
            <div className="flex flex-col items-center text-center">
              <motion.h1 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="text-3xl font-black tracking-tight text-white flex items-center gap-1 select-none"
              >
                <span>Fit</span>
                <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Flow</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-400 mt-2 select-none"
              >
                Your Ultimate Gym SaaS
              </motion.p>
            </div>
            
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
