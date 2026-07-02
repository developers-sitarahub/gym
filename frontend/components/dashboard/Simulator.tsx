'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, UserPlus, Check, RefreshCw } from 'lucide-react';

interface SimulatorProps {
  gymId: string;
  gymSlug: string;
}

interface SimulatedMember {
  id: string;
  name: string;
  phone: string;
}

interface ChatMessage {
  id: string;
  type: 'INBOUND' | 'CHATBOT' | 'REMINDER' | 'ACTIVATION' | 'PAYMENT_RECEIVED' | 'PAYMENT_REJECTED';
  message: string;
  createdAt: string;
}

export default function Simulator({ gymId, gymSlug }: SimulatorProps) {
  const [members, setMembers] = useState<SimulatedMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCreatingMember, setIsCreatingMember] = useState<boolean>(false);

  // New member form
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberPhone, setNewMemberPhone] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch members of this gym
  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        if (data.members?.length > 0 && !selectedMemberId) {
          setSelectedMemberId(data.members[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching simulator members:', err);
    }
  };

  // Fetch notifications/messages for selected member
  const fetchMessages = async (memberId: string) => {
    if (!memberId) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members/${memberId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [gymSlug]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchMessages(selectedMemberId);
    }
  }, [selectedMemberId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedMemberId || isLoading) return;

    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Optimistically add message
    const tempId = Math.random().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        type: 'INBOUND',
        message: messageText,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: member.phone,
          message: messageText,
        }),
      });

      if (res.ok) {
        await fetchMessages(selectedMemberId);
      }
    } catch (err) {
      console.error('Error sending simulator message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberPhone.trim()) return;

    const phoneRegex = /^\+?[0-9]+$/;
    if (!phoneRegex.test(newMemberPhone)) {
      alert('WhatsApp Phone Number must contain only numbers (optionally starting with +).');
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName,
          phone: newMemberPhone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchMembers();
        setSelectedMemberId(data.member.id);
        setIsCreatingMember(false);
        setNewMemberName('');
        setNewMemberPhone('');
      }
    } catch (err) {
      console.error('Error creating simulator member:', err);
    }
  };

  const activeMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Simulator Configurations */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md lg:col-span-1">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight text-zinc-100">Simulator Sandbox</h3>
          <button
            onClick={() => fetchMessages(selectedMemberId)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Refresh Chats"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Member Selector */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Select Member to Simulate
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.phone})
              </option>
            ))}
          </select>
        </div>

        {/* Create Member Button */}
        {!isCreatingMember ? (
          <button
            onClick={() => setIsCreatingMember(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cyan-500"
          >
            <UserPlus className="h-4 w-4" /> Create Test Member
          </button>
        ) : (
          <form onSubmit={handleCreateMember} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h4 className="mb-3 text-xs font-bold text-zinc-400 uppercase">New Test Member</h4>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Full Name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="WhatsApp Number (e.g. +919988776655)"
                value={newMemberPhone}
                onChange={(e) => {
                  const val = e.target.value;
                  const cleaned = val.replace(/[^\d+]/g, '');
                  const hasPlus = cleaned.startsWith('+');
                  const digits = cleaned.replace(/\+/g, '');
                  setNewMemberPhone((hasPlus ? '+' : '') + digits);
                }}
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingMember(false)}
                className="flex-1 rounded-lg border border-zinc-800 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 rounded-xl bg-zinc-900/30 p-4 border border-zinc-800/50">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Simulated Chatbot Menu</h4>
          <p className="text-xs text-zinc-500 mb-2 leading-relaxed">You can trigger these inputs directly in the phone chat window:</p>
          <ul className="space-y-1 text-xs text-zinc-400">
            <li>• Reply <code className="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400">1</code>: View Membership Status</li>
            <li>• Reply <code className="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400">2</code>: Show Plans & Initiate Renewal</li>
            <li>• Reply <code className="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400">P1</code>: Select Plan 1 (Generates QR / Link)</li>
            <li>• Reply <code className="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400">PAID txn12345</code>: Confirm manual UPI pay</li>
            <li>• Reply <code className="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400">3</code>: View Gym Plans</li>
            <li>• Reply <code className="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400">4</code>: Get Contact Details</li>
          </ul>
        </div>
      </div>

      {/* Simulated Phone Mockup */}
      <div className="lg:col-span-2">
        <div className="mx-auto max-w-sm rounded-[36px] border-[8px] border-zinc-800 bg-zinc-950 p-3 shadow-2xl shadow-cyan-950/20">
          {/* Phone Header */}
          <div className="relative flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 font-extrabold text-white">
                {activeMember ? activeMember.name.substring(0, 2).toUpperCase() : 'WA'}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-100">{activeMember ? activeMember.name : 'WhatsApp Bot'}</h4>
                <p className="text-[10px] text-emerald-400">online</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <Phone className="h-4 w-4 cursor-pointer hover:text-zinc-100" />
            </div>
          </div>

          {/* Chat Window */}
          <div className="h-96 overflow-y-auto bg-zinc-950 px-4 py-4 space-y-4" style={{ backgroundImage: 'radial-gradient(#1e1b4b 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}>
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="text-3xl">👋</span>
                <p className="mt-2 text-xs font-semibold text-zinc-400">No message history yet</p>
                <p className="mt-1 text-[10px] text-zinc-600">Send "hello" or "1" to wake the chatbot!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isInbound = msg.type === 'INBOUND';
                return (
                  <div key={msg.id} className={`flex ${isInbound ? 'justify-end' : 'justify-start'}`}>
                    <div className={`relative max-w-[85%] rounded-lg px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                      isInbound
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700/50'
                    }`}>
                      {/* Message Content Parser for QR images */}
                      {msg.message.includes('https://api.qrserver.com') ? (
                        <div className="space-y-3">
                          <p className="font-semibold text-zinc-200">📷 Scan to Pay QR Code:</p>
                          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-xl bg-white p-2 border border-zinc-700">
                            <img
                              src={msg.message.match(/https:\/\/api.qrserver.com[^\s]+/)?.[0] || ''}
                              alt="UPI QR Code"
                              className="h-full w-full"
                            />
                          </div>
                          <p className="whitespace-pre-line text-[11px] text-zinc-300">
                            {msg.message.replace(/https:\/\/api.qrserver.com[^\s]+/, '')}
                          </p>
                        </div>
                      ) : msg.message.includes('/payments/mock-gateway') ? (
                        <div className="space-y-3">
                          <p className="whitespace-pre-line">{msg.message.split('👉')[0]}</p>
                          <a
                            href={msg.message.match(/\/payments\/mock-gateway[^\s]+/)?.[0] || ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-600 py-2 text-center text-xs font-bold text-white transition-all hover:bg-cyan-500 cursor-pointer"
                          >
                            💳 Open Razorpay Checkout
                          </a>
                        </div>
                      ) : msg.message.includes('/receipt/') ? (
                        <div className="space-y-3">
                          <p className="whitespace-pre-line">
                            {msg.message.split('👉')[0].split('http')[0]}
                          </p>
                          <a
                            href={msg.message.match(/\/receipt\/[^\s]+/)?.[0] || ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-center text-xs font-bold text-white transition-all hover:bg-emerald-500 cursor-pointer"
                          >
                            📄 View Tax Receipt
                          </a>
                        </div>
                      ) : (
                        <span className="whitespace-pre-line">{msg.message}</span>
                      )}
                      
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${isInbound ? 'text-emerald-200' : 'text-zinc-500'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isInbound && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendMessage} className="mt-2 flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 p-2 rounded-b-2xl">
            <input
              type="text"
              placeholder="Type a WhatsApp message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!selectedMemberId || isLoading}
              className="flex-1 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!selectedMemberId || !inputText.trim() || isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
