import React from 'react';
import { redirect } from 'next/navigation';
import { fetchBackend } from '@/lib/api-client';
import DashboardShell from '@/components/dashboard/DashboardShell';

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymSlug: string }>;
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
  const params = await props.params;
  const { children } = props;

  // Retrieve current user and gym details from Express Backend
  const res = await fetchBackend('/api/auth/me');
  if (!res.ok) {
    redirect('/login');
  }

  const { user: activeUser } = await res.json();
  const gym = activeUser.gym;

  // Enforce tenant scoping and access check
  const decodedGymSlug = decodeURIComponent(params.gymSlug).toLowerCase();
  if (!gym || (activeUser.role !== 'SUPERADMIN' && gym.slug.toLowerCase() !== decodedGymSlug)) {
    redirect('/login');
  }

  return (
    <DashboardShell gym={gym} activeUser={activeUser} gymSlug={params.gymSlug}>
      {children}
    </DashboardShell>
  );
}
