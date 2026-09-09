import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Toaster } from 'sonner';

// Pages
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';

/**
 * Sales XP — Root application shell.
 *
 * Provider tree: Auth → Org → App → feature providers.
 * Pages are a Page string union rendered by conditional blocks.
 * URL sync via pushState/popstate (no client-side router library).
 *
 * Guard chain on login:
 *   1. Bootstrap super-admin (/bootstrap)
 *   2. Password recovery (/reset-password)
 *   3. Shared public routes
 *   4. Login
 *   5. Suspended check
 *   6. Org check
 *   7. Forced temp-password reset
 *   8. Avatar picker (FTUE)
 *   9. MFA guard (TOTP, 24-hour re-verify)
 */

type Page =
  | 'login'
  | 'home'
  | 'challenges'
  | 'scoreboard'
  | 'battles'
  | 'power-wheel'
  | 'reward-zone'
  | 'settings'
  | 'teams'
  | 'shoutouts'
  | 'earnie-assistant'
  | 'admin'
  | 'super-admin'
  | 'tv-display'
  | 'march-madness';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) setCurrentPage('home');
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setCurrentPage('login');
      else if (currentPage === 'login') setCurrentPage('home');
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL ↔ page sync
  const navigate = useCallback((page: Page) => {
    setCurrentPage(page);
    const path = page === 'home' ? '/' : `/${page}`;
    window.history.pushState({ page }, '', path);
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const page = e.state?.page as Page | undefined;
      if (page) setCurrentPage(page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      {!session ? (
        <LoginPage />
      ) : (
        <div className="min-h-screen bg-background">
          {/* Navigation header placeholder */}
          <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
            <h1
              className="text-xl font-bold text-primary cursor-pointer"
              onClick={() => navigate('home')}
            >
              Sales XP
            </h1>
            <nav className="flex items-center gap-4">
              {(['challenges', 'battles', 'scoreboard', 'reward-zone'] as Page[]).map((p) => (
                <button
                  key={p}
                  onClick={() => navigate(p)}
                  className={`text-sm font-medium capitalize transition-colors ${
                    currentPage === p
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.replace('-', ' ')}
                </button>
              ))}
            </nav>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setCurrentPage('login');
              }}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Sign out
            </button>
          </header>

          {/* Page content */}
          <main className="p-6">
            {currentPage === 'home' && <HomePage />}
            {currentPage === 'challenges' && <PlaceholderPage title="Challenges" />}
            {currentPage === 'battles' && <PlaceholderPage title="Arena — Battles" />}
            {currentPage === 'scoreboard' && <PlaceholderPage title="Scoreboard" />}
            {currentPage === 'reward-zone' && <PlaceholderPage title="Reward Zone" />}
            {currentPage === 'settings' && <PlaceholderPage title="Settings" />}
            {currentPage === 'earnie-assistant' && <PlaceholderPage title="Sales Assistant" />}
            {currentPage === 'admin' && <PlaceholderPage title="Admin Panel" />}
            {currentPage === 'super-admin' && <PlaceholderPage title="Super Admin" />}
          </main>
        </div>
      )}
    </>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-2">Coming soon</p>
      </div>
    </div>
  );
}
