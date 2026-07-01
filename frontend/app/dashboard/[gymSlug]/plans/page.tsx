'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, Trash2, Plus, Clock, Activity } from 'lucide-react';

interface MembershipInfo {
  id: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  member: {
    id: string;
    name: string;
    phone: string;
  };
}

interface PlanData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  memberships?: MembershipInfo[];
}

export default function PlansPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationDays, setDurationDays] = useState('30');

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [gymSlug]);

  const resetForm = () => {
    setIsAdding(false);
    setEditingPlan(null);
    setName('');
    setDescription('');
    setPrice('');
    setDurationDays('30');
    setError('');
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleSelectPlan = (p: PlanData) => {
    setEditingPlan(p);
    setIsAdding(false);
    setName(p.name);
    setDescription(p.description || '');
    setPrice(p.price.toString());
    setDurationDays(p.durationDays.toString());
    setError('');
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          price: parseFloat(price),
          durationDays: parseInt(durationDays),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        resetForm();
        await fetchPlans();
      } else {
        setError(data.error || 'Failed to create plan.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setError('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          price: parseFloat(price),
          durationDays: parseInt(durationDays),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        resetForm();
        await fetchPlans();
      } else {
        setError(data.error || 'Failed to update plan.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    }
  };

  const handleDeletePlan = async (e: React.MouseEvent, planId: string) => {
    e.stopPropagation(); // Prevent card selection on delete click
    if (!confirm('Are you sure you want to delete this membership plan? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans/${planId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (editingPlan?.id === planId) {
          resetForm();
        }
        await fetchPlans();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100 sm:text-3xl">Membership Plans</h2>
          <p className="text-xs text-zinc-500 mt-1">Configure durations, pricing models, and benefits for your gym members.</p>
        </div>
        <button
          onClick={startAdding}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" /> Create New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Plans Grid */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-xs text-zinc-500 bg-zinc-950/40 rounded-2xl border border-zinc-800">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-zinc-500 bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800">
              <CreditCard className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm font-semibold">No subscription plans found</p>
              <button
                onClick={startAdding}
                className="mt-2 text-xs font-bold text-cyan-400 hover:underline"
              >
                Create your first plan now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {plans.map((p) => {
                const isSelected = editingPlan?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPlan(p)}
                    className={`group relative overflow-hidden rounded-2xl border p-6 backdrop-blur-md transition-all cursor-pointer hover:bg-zinc-900/40 active:scale-[0.98] ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">{p.name}</h3>
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                          <Clock className="h-3 w-3 text-cyan-400" /> {p.durationDays} Days Duration
                        </div>
                      </div>
                      
                      {/* Delete Plan */}
                      <button
                        onClick={(e) => handleDeletePlan(e, p.id)}
                        className="rounded-lg p-1.5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
                        title="Delete Plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mb-4">
                      <span className="text-2xl font-extrabold text-zinc-100">₹{p.price}</span>
                      <span className="text-[10px] text-zinc-500 ml-1 font-medium">net price</span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed min-h-[40px]">
                      {p.description || 'Gives full access to all generic weights, cardio zones & trainers.'}
                    </p>

                    {p.memberships && p.memberships.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-800/80">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 text-left">Subscribers ({p.memberships.length})</h4>
                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {p.memberships.map((sub) => (
                            <div key={sub.id} className="flex justify-between items-center text-[11px] bg-zinc-900/40 rounded-lg p-2 border border-zinc-800/50">
                              <div>
                                <span className="font-bold text-zinc-200">{sub.member.name}</span>
                                <span className="text-zinc-500 ml-1 font-mono text-[9px]">({sub.member.phone})</span>
                              </div>
                              <div className="text-right text-[9px]">
                                <div className="text-zinc-400 font-medium">
                                  {new Date(sub.startDate).toLocaleDateString('en-IN')} - {new Date(sub.endDate).toLocaleDateString('en-IN')}
                                </div>
                                <span className={`inline-block mt-0.5 px-1 py-0.2 rounded font-semibold tracking-wider text-[8px] uppercase ${
                                  sub.status === 'ACTIVE' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}>
                                  {sub.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add/Edit Plan Card */}
        {isAdding || editingPlan ? (
          <div className={`rounded-2xl border bg-zinc-950/70 p-6 shadow-2xl transition-all h-fit lg:col-span-1 ${
            editingPlan ? 'border-cyan-500 shadow-cyan-950/10' : 'border-zinc-800 shadow-cyan-950/10'
          }`}>
            <h3 className="text-base font-bold text-zinc-100 mb-4">
              {editingPlan ? 'Edit Membership Plan' : 'Create Membership Plan'}
            </h3>
            
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={editingPlan ? handleUpdatePlan : handleAddPlan} className="space-y-4 text-xs">
              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. 6 Months Premium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Price (₹ INR)</label>
                  <input
                    type="number"
                    placeholder="2999"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Duration (Days)</label>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="30">30 Days (Monthly)</option>
                    <option value="90">90 Days (Quarterly)</option>
                    <option value="180">180 Days (Half-Yearly)</option>
                    <option value="365">365 Days (Annual)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Plan Description</label>
                <textarea
                  placeholder="List gym perks, timing access or trainer allowances..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500"
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 rounded-xl border border-zinc-800 py-3 font-bold text-zinc-400 hover:bg-zinc-850"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 flex flex-col items-center justify-center text-center text-zinc-500 lg:col-span-1 h-64">
            <Activity className="h-10 w-10 text-zinc-700 mb-2" />
            <h4 className="text-sm font-bold text-zinc-100 font-sans">Custom Plans Builder</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-[200px] leading-relaxed">
              Define customized durations and distinct pricing plans for your members.
            </p>
            <button
              onClick={startAdding}
              className="mt-4 rounded-xl border border-zinc-850 px-4 py-2 text-xs font-semibold text-cyan-400 hover:bg-zinc-900 hover:text-zinc-100 transition-all"
            >
              Build New Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
