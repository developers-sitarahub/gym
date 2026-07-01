'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, MessageCircle, AlertTriangle } from 'lucide-react';

interface ChatTakeoverProps {
  gymId: string;
  gymSlug: string;
}

interface ActiveChatMember {
  id: string;
  name: string;
  phone: string;
  isBotDisabled: boolean;
  notes?: string | null;
}

interface ChatLogMessage {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function ChatTakeover({ gymId, gymSlug }: ChatTakeoverProps) {
  const [activeChats, setActiveChats] = useState<ActiveChatMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<ActiveChatMember | null>(null);
  const [messages, setMessages] = useState<ChatLogMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isBotToggling, setIsBotToggling] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch all active chats
  const fetchActiveChats = async () => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members`);
      if (res.ok) {
        const data = await res.json();
        setActiveChats(data.members || []);
        if (data.members?.length > 0 && !selectedMember) {
          setSelectedMember(data.members[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching active chats:', err);
    }
  };

  const fetchChatMessages = async (memberId: string) => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members/${memberId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    fetchActiveChats();
  }, [gymSlug]);

  useEffect(() => {
    if (selectedMember) {
      fetchChatMessages(selectedMember.id);
      
      // Auto-poll messages every 6 seconds to keep live chat updated!
      const interval = setInterval(() => {
        fetchChatMessages(selectedMember.id);
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [selectedMember]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggleBot = async () => {
    if (!selectedMember || isBotToggling) return;

    setIsBotToggling(true);
    const newBotState = !selectedMember.isBotDisabled;

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members/${selectedMember.id}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBotDisabled: newBotState }),
      });

      if (res.ok) {
        setSelectedMember({
          ...selectedMember,
          isBotDisabled: newBotState,
        });
        // Update list as well
        setActiveChats((prev) =>
          prev.map((c) => (c.id === selectedMember.id ? { ...c, isBotDisabled: newBotState } : c))
        );
      }
    } catch (err) {
      console.error('Error toggling bot mode:', err);
    } finally {
      setIsBotToggling(false);
    }
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedMember) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/live-chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedMember.phone,
          message: messageText,
        }),
      });

      if (res.ok) {
        await fetchChatMessages(selectedMember.id);
      }
    } catch (err) {
      console.error('Error sending staff reply:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-md lg:grid-cols-4">
      {/* Conversations Sidebar */}
      <div className="border-r border-zinc-800 lg:col-span-1">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider">Active Conversations</h3>
        </div>
        <div className="divide-y divide-zinc-900 overflow-y-auto" style={{ maxHeight: '550px' }}>
          {activeChats.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">No active members found</div>
          ) : (
            activeChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedMember(chat)}
                className={`flex cursor-pointer flex-col gap-1 p-4 transition-all hover:bg-zinc-900/60 ${
                  selectedMember?.id === chat.id ? 'bg-zinc-900 border-l-4 border-cyan-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{chat.name}</span>
                  {chat.isBotDisabled ? (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-500/20">
                      Takeover Active
                    </span>
                  ) : (
                    <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-500/20">
                      Bot Active
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">{chat.phone}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Conversation Window */}
      <div className="flex flex-col lg:col-span-3" style={{ height: '600px' }}>
        {selectedMember ? (
          <>
            {/* Takeover Control Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 p-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedMember.name}</h3>
                <p className="text-xs text-zinc-500">{selectedMember.phone}</p>
              </div>

              {/* Bot Override Toggle */}
              <button
                onClick={handleToggleBot}
                disabled={isBotToggling}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                  selectedMember.isBotDisabled
                    ? 'bg-rose-600 border-rose-700 text-white hover:bg-rose-500'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {selectedMember.isBotDisabled ? (
                  <>
                    <User className="h-4 w-4" /> Chatbot Paused (Human mode)
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 text-cyan-400" /> Chatbot Active
                  </>
                )}
              </button>
            </div>

            {/* Warn banner if Bot is active */}
            {!selectedMember.isBotDisabled && (
              <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 border-b border-amber-500/20 text-[11px] text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>The Chatbot is currently active. Any messages typed here will bypass chatbot rules and be sent directly, but bot responses will continue until paused.</span>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950/40">
              {messages.map((msg) => {
                const isStaffSend = msg.type === 'CHATBOT' && msg.title === 'WhatsApp Staff Reply';
                const isSystemBot = msg.type === 'CHATBOT' && !isStaffSend;
                const isMemberIn = msg.type === 'INBOUND';

                return (
                  <div key={msg.id} className={`flex ${isMemberIn ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`relative max-w-[70%] rounded-lg px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                        isMemberIn
                          ? 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-800'
                          : isStaffSend
                          ? 'bg-cyan-600 text-white rounded-tr-none'
                          : 'bg-zinc-800 text-zinc-300 rounded-tr-none border border-zinc-700/30'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-4 text-[9px] font-bold text-zinc-500">
                        <span>
                          {isMemberIn
                            ? 'Member'
                            : isStaffSend
                            ? 'Staff Takeover'
                            : `Chatbot System (${msg.title})`}
                        </span>
                      </div>
                      <span className="whitespace-pre-line">{msg.message}</span>
                      <div className="mt-1 text-right text-[8px] opacity-60">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Message Reply Form */}
            <form onSubmit={handleSendResponse} className="border-t border-zinc-800 bg-zinc-950 p-4 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={selectedMember.isBotDisabled ? "Type a direct reply to member..." : "Type reply (automatically pauses chatbot)..."}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="flex items-center justify-center rounded-xl bg-cyan-600 px-5 text-xs font-bold text-white transition-all hover:bg-cyan-500 disabled:opacity-40"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-500">
            <MessageCircle className="mb-2 h-10 w-10 text-zinc-700" />
            <p className="text-sm font-semibold">Select a conversation to start live-chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
