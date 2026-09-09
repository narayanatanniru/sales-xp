import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Global app-level state that doesn't belong to auth or org.
 * Navigation, modals, sidebar state, etc.
 */

export type Page =
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

interface AppState {
  currentPage: Page;
  navigate: (page: Page) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page);
    const path = page === 'home' ? '/' : `/${page}`;
    window.history.pushState({ page }, '', path);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Handle browser back/forward
  if (typeof window !== 'undefined') {
    window.onpopstate = (e: PopStateEvent) => {
      const page = e.state?.page as Page | undefined;
      if (page) setCurrentPage(page);
    };
  }

  return (
    <AppContext.Provider value={{ currentPage, navigate, sidebarOpen, setSidebarOpen, toggleSidebar }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
