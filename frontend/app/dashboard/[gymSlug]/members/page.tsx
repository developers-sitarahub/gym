'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Search,
  UserPlus,
  Eye,
  Edit2,
  Trash2,
} from 'lucide-react';

interface MemberData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  dob: string | null;
  emergencyContact: string | null;
  notes: string | null;
  isBotDisabled: boolean;
  memberships: Array<{
    id: string;
    planId: string;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    plan: {
      id: string;
      name: string;
      price: number;
      durationDays: number;
    };
  }>;
}

export default function MembersPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [members, setMembers] = useState<MemberData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingMember, setViewingMember] = useState<MemberData | null>(null);
  const [editingMember, setEditingMember] = useState<MemberData | null>(null);

  useEffect(() => {
    if (!isAdding && !viewingMember && !editingMember) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAdding(false);
        setViewingMember(null);
        setEditingMember(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding, viewingMember, editingMember]);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');

  // Plans & Subscription Fields
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const getTodayString = () => {
    const local = new Date();
    return local.toISOString().split('T')[0];
  };

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchPlans();
  }, [gymSlug]);

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    if (!planId) {
      setEndDate('');
      return;
    }
    const selectedPlan = plans.find(p => p.id === planId);
    if (selectedPlan) {
      const start = startDate ? new Date(startDate) : new Date();
      const end = new Date(start.getTime() + selectedPlan.durationDays * 24 * 60 * 60 * 1000);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  useEffect(() => {
    if (selectedPlanId && startDate) {
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
        const start = new Date(startDate);
        const end = new Date(start.getTime() + selectedPlan.durationDays * 24 * 60 * 60 * 1000);
        setEndDate(end.toISOString().split('T')[0]);
      }
    }
  }, [startDate, selectedPlanId, plans]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const phoneRegex = /^\+?[0-9]+$/;
    if (!phoneRegex.test(phone)) {
      setError('WhatsApp Phone Number must contain only numbers (optionally starting with +).');
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          dob: dob || undefined,
          emergencyContact,
          notes,
          planId: selectedPlanId || undefined,
          startDate: selectedPlanId ? startDate : undefined,
          endDate: selectedPlanId ? endDate : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAdding(false);
        // Clear fields
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setDob('');
        setEmergencyContact('');
        setNotes('');
        setSelectedPlanId('');
        setStartDate('');
        setEndDate('');
        
        await fetchMembers();
      } else {
        setError(data.error || 'Failed to add member.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    }
  };

  const openAddModal = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setDob('');
    setEmergencyContact('');
    setNotes('');
    setSelectedPlanId('');
    setStartDate(getTodayString());
    setEndDate('');
    setError('');
    setIsAdding(true);
  };

  const openEditModal = (member: MemberData) => {
    setEditingMember(member);
    setName(member.name || '');
    setPhone(member.phone || '');
    setEmail(member.email || '');
    setAddress(member.address || '');
    setDob(member.dob ? new Date(member.dob).toISOString().split('T')[0] : '');
    setEmergencyContact(member.emergencyContact || '');
    setNotes(member.notes || '');

    // Populate plan details
    const activeSub = member.memberships?.find(s => s.status === 'ACTIVE') || member.memberships?.[0];
    if (activeSub) {
      setSelectedPlanId(activeSub.planId || activeSub.plan.id);
      setStartDate(activeSub.startDate ? new Date(activeSub.startDate).toISOString().split('T')[0] : getTodayString());
      setEndDate(activeSub.endDate ? new Date(activeSub.endDate).toISOString().split('T')[0] : '');
    } else {
      setSelectedPlanId('');
      setStartDate(getTodayString());
      setEndDate('');
    }

    setError('');
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setError('');

    const phoneRegex = /^\+?[0-9]+$/;
    if (!phoneRegex.test(phone)) {
      setError('WhatsApp Phone Number must contain only numbers (optionally starting with +).');
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          dob: dob || undefined,
          emergencyContact,
          notes,
          planId: selectedPlanId || null,
          startDate: selectedPlanId ? startDate : null,
          endDate: selectedPlanId ? endDate : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setEditingMember(null);
        // Clear fields
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setDob('');
        setEmergencyContact('');
        setNotes('');
        setSelectedPlanId('');
        setStartDate('');
        setEndDate('');
        
        await fetchMembers();
      } else {
        setError(data.error || 'Failed to update member.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to delete this member? This will remove all their records permanently.')) return;
    setError('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await fetchMembers();
      } else {
        alert(data.error || 'Failed to delete member.');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    }
  };

  // Filter members
  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery) ||
      (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100 sm:text-3xl">Members Directory</h2>
          <p className="text-xs text-zinc-500 mt-1">Manage member profiles, contact logs, and subscriptions.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-cyan-500"
        >
          <UserPlus className="h-4 w-4" /> Add New Member
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Members List Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 py-2.5 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center text-xs text-zinc-500">Loading member records...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-zinc-500">No member records match search criteria</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Phone / WhatsApp</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Date of Birth</th>
                    <th className="py-3 px-4">Emergency Contact</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Medical Notes / Goals</th>
                    <th className="py-3 px-4">Plan Status</th>
                    <th className="py-3 px-4">Expiry</th>
                    <th className="py-3 px-4">Bot Rule</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredMembers.map((m) => {
                    const activeSub = m.memberships.find((s) => s.status === 'ACTIVE');
                    return (
                      <tr key={m.id} className="hover:bg-zinc-900/30 transition-all">
                        <td className="py-3.5 px-4 font-bold text-zinc-100">{m.name}</td>
                        <td className="py-3.5 px-4 text-zinc-300 font-mono">{m.phone}</td>
                        <td className="py-3.5 px-4 text-zinc-300">{m.email || '--'}</td>
                        <td className="py-3.5 px-4 text-zinc-300">
                          {m.dob ? new Date(m.dob).toLocaleDateString('en-IN') : '--'}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300">{m.emergencyContact || '--'}</td>
                        <td className="py-3.5 px-4 text-zinc-300 max-w-[150px] truncate" title={m.address || ''}>
                          {m.address || '--'}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 max-w-[200px] truncate" title={m.notes || ''}>
                          {m.notes || '--'}
                        </td>
                        <td className="py-3.5 px-4">
                          {activeSub ? (
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400 border border-emerald-500/20">
                              {activeSub.plan.name}
                            </span>
                          ) : (
                            <span className="rounded bg-zinc-800 px-2 py-0.5 font-semibold text-zinc-400 border border-zinc-700">
                              No active plan
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-semibold">
                          {activeSub ? new Date(activeSub.endDate).toLocaleDateString('en-IN') : '--'}
                        </td>
                        <td className="py-3.5 px-4">
                          {m.isBotDisabled ? (
                            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-500/20">
                              Takeover Active
                            </span>
                          ) : (
                            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-500/20">
                              Bot Normal
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setViewingMember(m)}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(m)}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400 transition-all"
                              title="Edit Profile"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(m.id)}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-rose-500 transition-all"
                              title="Delete Member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {isAdding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={() => setIsAdding(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-cyan-800 bg-zinc-950 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Add Member Profile</h3>
            
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4 text-xs">
              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">WhatsApp Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/[^\d+]/g, '');
                    const hasPlus = cleaned.startsWith('+');
                    const digits = cleaned.replace(/\+/g, '');
                    setPhone((hasPlus ? '+' : '') + digits);
                  }}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="john@doe.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="Relation & Phone"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Address (Optional)</label>
                <input
                  type="text"
                  placeholder="Street and Area details"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Medical Notes / Goals</label>
                <textarea
                  placeholder="e.g. Weight loss goals, back pain history..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Membership Plan Section */}
              <div className="border-t border-zinc-800/80 pt-4 mt-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Membership Plan</h4>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Select Plan</label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">No Active Plan</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ₹{p.price} ({p.durationDays} Days)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPlanId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 rounded-xl border border-zinc-800 py-3 font-bold text-zinc-400 hover:bg-zinc-850"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={() => setViewingMember(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-100">Member Profile Details</h3>
              <button
                onClick={() => setViewingMember(null)}
                className="text-zinc-400 hover:text-zinc-100 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-300">
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Full Name:</span>
                <span className="col-span-2 text-zinc-100 font-bold">{viewingMember.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">WhatsApp:</span>
                <span className="col-span-2 text-zinc-100 font-mono">{viewingMember.phone}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Email:</span>
                <span className="col-span-2 text-zinc-100">{viewingMember.email || '--'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Date of Birth:</span>
                <span className="col-span-2 text-zinc-100">
                  {viewingMember.dob ? new Date(viewingMember.dob).toLocaleDateString('en-IN') : '--'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Emergency Contact:</span>
                <span className="col-span-2 text-zinc-100">{viewingMember.emergencyContact || '--'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Address:</span>
                <span className="col-span-2 text-zinc-100">{viewingMember.address || '--'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Medical Notes:</span>
                <span className="col-span-2 text-zinc-100 whitespace-pre-wrap">{viewingMember.notes || '--'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider">Bot Control:</span>
                <span className="col-span-2">
                  {viewingMember.isBotDisabled ? (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                      Takeover Active (Bot Paused)
                    </span>
                  ) : (
                    <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                      Bot Active
                    </span>
                  )}
                </span>
              </div>
            </div>
            
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingMember(null)}
                className="w-full rounded-xl bg-zinc-900 py-3 font-bold text-zinc-300 hover:bg-zinc-800 transition-all border border-zinc-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={() => setEditingMember(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-cyan-800 bg-zinc-950 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Edit Member Profile</h3>
            
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleEditMember} className="space-y-4 text-xs">
              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">WhatsApp Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/[^\d+]/g, '');
                    const hasPlus = cleaned.startsWith('+');
                    const digits = cleaned.replace(/\+/g, '');
                    setPhone((hasPlus ? '+' : '') + digits);
                  }}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="john@doe.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="Relation & Phone"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Address (Optional)</label>
                <input
                  type="text"
                  placeholder="Street and Area details"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Medical Notes / Goals</label>
                <textarea
                  placeholder="e.g. Weight loss goals, back pain history..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Membership Plan Section */}
              <div className="border-t border-zinc-800/80 pt-4 mt-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Membership Plan</h4>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Select Plan</label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">No Active Plan</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ₹{p.price} ({p.durationDays} Days)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPlanId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500 transition-all"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 rounded-xl border border-zinc-800 py-3 font-bold text-zinc-400 hover:bg-zinc-850 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
