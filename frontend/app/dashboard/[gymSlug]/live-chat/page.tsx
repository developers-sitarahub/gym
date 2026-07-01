'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ChatTakeover from '@/components/dashboard/ChatTakeover';

export default function LiveChatPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [gymId, setGymId] = useState('');

  useEffect(() => {
    const fetchGymInfo = async () => {
      try {
        const res = await fetch(`/api/dashboard/${gymSlug}/chatbot`);
        if (res.ok) {
          const data = await res.json();
          setGymId(data.chatbotSettings?.gymId || '');
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchGymInfo();
  }, [gymSlug]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Live takeover console</h2>
        <p className="text-xs text-zinc-500 mt-1">Intervene in active chatbot conversations, pause bot responses, and chat directly with members.</p>
      </div>

      {/* Takeover Shell */}
      {gymId ? (
        <ChatTakeover gymId={gymId} gymSlug={gymSlug} />
      ) : (
        <div className="flex h-64 items-center justify-center text-xs text-zinc-500 bg-zinc-950/40 rounded-2xl border border-zinc-800">
          Loading live takeover console...
        </div>
      )}
    </div>
  );
}
