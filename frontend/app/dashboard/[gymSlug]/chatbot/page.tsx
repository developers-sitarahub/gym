'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Bot, Save, AlertCircle, Info, Brain } from 'lucide-react';
import Simulator from '@/components/dashboard/Simulator';

export default function ChatbotPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [gymId, setGymId] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isAiModeEnabled, setIsAiModeEnabled] = useState(false);
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/chatbot`);
      if (res.ok) {
        const data = await res.json();
        setWelcomeMessage(data.chatbotSettings?.welcomeMessage || '');
        setIsAiModeEnabled(data.chatbotSettings?.isAiModeEnabled || false);
        setAiKnowledgeBase(data.chatbotSettings?.aiKnowledgeBase || '');
        setGymId(data.chatbotSettings?.gymId || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [gymSlug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          welcomeMessage,
          isAiModeEnabled,
          aiKnowledgeBase,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await fetchSettings();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Chatbot Configs</h2>
        <p className="text-xs text-zinc-500 mt-1">Configure your default WhatsApp greeting, toggle optional AI mode and customize RAG context.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Settings Form Panel */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md xl:col-span-2 space-y-6">
          <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-400" /> Chatbot Greeting & AI Mode
          </h3>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
              {error}
            </div>
          )}

          {saveSuccess && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
              ✓ Settings saved successfully! Changes are live immediately.
            </div>
          )}

          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-xs text-zinc-500">Loading settings...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6 text-xs">
              {/* Default greeting message template */}
              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">
                  Default Greeting Text Menu
                </label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={6}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
                />
                <p className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Supports <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">{"{{gym_name}}"}</code> to dynamically inject tenant name. Keep numeric choices (1-5) matching bot routes.
                </p>
              </div>

              {/* AI toggle checkbox */}
              <div className="rounded-xl border border-zinc-850 bg-zinc-900/10 p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="block font-bold text-white flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-cyan-400" /> Enable AI Assistant Mode (Gemini RAG)
                  </span>
                  <p className="text-[10px] text-zinc-500 max-w-md leading-relaxed">
                    Uses local context matching and the Gemini API to formulate smart responses to member questions.
                    If the question is out of scope, falls back gracefully to the welcome menu.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isAiModeEnabled}
                  onChange={(e) => setIsAiModeEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-800 bg-zinc-900 text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* RAG Knowledge Box */}
              {isAiModeEnabled && (
                <div className="space-y-2">
                  <label className="block font-semibold text-zinc-400 uppercase tracking-wider">
                    AI Knowledge Base Source Text
                  </label>
                  <textarea
                    value={aiKnowledgeBase}
                    onChange={(e) => setAiKnowledgeBase(e.target.value)}
                    rows={8}
                    placeholder="Enter gym details here...&#10;- Gym timings are Monday to Saturday, 6 AM to 10 PM.&#10;- Personal trainers: Coach Alex (Strength), Coach Sarah (Cardio).&#10;- FAQs: Is parking free? Yes, we have free basement parking.&#10;- Offers: Get 15% off when signing up with a friend!"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                  />
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    📝 Write down details of trainers, amenities, timing, FAQs, and offers. The AI is strictly instructed to only answer based on this context and not hallucinate!
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 py-3 font-bold text-white transition-all hover:bg-cyan-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {isSaving ? 'Saving Configurations...' : 'Save Chatbot Settings'}
              </button>
            </form>
          )}
        </div>

        {/* Info Column */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md h-fit xl:col-span-1 text-xs leading-relaxed space-y-4">
          <h4 className="font-bold text-white uppercase tracking-wider mb-2">How Chatbot State Works</h4>
          <p className="text-zinc-400">
            Incoming WhatsApp messages are routed directly to the chatbot. It resolves the user state and returns matching bubbles:
          </p>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg bg-zinc-900 p-3 border border-zinc-850">
              <span className="block font-bold text-cyan-400">Step 1: Scoped context</span>
              <p className="text-[10px] text-zinc-500 mt-1">
                The bot maps the message source phone to the Gym tenant, verifying isolation.
              </p>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3 border border-zinc-850">
              <span className="block font-bold text-cyan-400">Step 2: Menus routing</span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Numeric matching resolves plan listings (P1, P2), UPI confirmations (PAID ref), and timings.
              </p>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3 border border-zinc-850">
              <span className="block font-bold text-cyan-400">Step 3: Gemini fallback</span>
              <p className="text-[10px] text-zinc-500 mt-1">
                With AI mode ON, complex questions are answered contextually. With AI mode OFF, greeting menu serves as fallback.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Chatbot Simulator - Fully Sandbox Integrated */}
      {gymId && (
        <div className="border-t border-zinc-800 pt-8">
          <div className="mb-6">
            <h3 className="text-xl font-extrabold tracking-tight text-white">Live Simulator Sandbox</h3>
            <p className="text-xs text-zinc-500 mt-1">Test your chatbot updates and dynamic payment flows instantly below!</p>
          </div>
          <Simulator gymId={gymId} gymSlug={gymSlug} />
        </div>
      )}
    </div>
  );
}
