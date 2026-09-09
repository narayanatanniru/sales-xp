import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '@/lib/api';
import type { Organization } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

interface OrgState {
  organization: Organization | null;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrgState | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrg = useCallback(async () => {
    if (!user?.organization_id) {
      setOrganization(null);
      setLoading(false);
      return;
    }
    try {
      const org = await apiRequest<Organization>('/organization/settings');
      setOrganization(org);
    } catch {
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  // Realtime: listen for org changes
  useEffect(() => {
    if (!user?.organization_id) return;

    const channel = supabase
      .channel('org-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${user.organization_id}`,
        },
        (payload) => {
          setOrganization(payload.new as Organization);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.organization_id]);

  return (
    <OrganizationContext.Provider value={{ organization, loading, refreshOrganization: fetchOrg }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
}
