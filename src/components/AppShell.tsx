import { useApp, type Page } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { isCommandCenter, roleBalanceType } from '@/lib/roles';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home, Swords, Trophy, Zap, Gift, Settings, Users, MessageSquare,
  LayoutDashboard, ChevronLeft, ChevronRight, Coins, LogOut, Shield,
} from 'lucide-react';

import HomePage from './HomePage';

/**
 * AppShell — main layout with sidebar navigation and header.
 * Role-aware: reps see player pages, leadership sees Command Center.
 */

interface NavItem {
  page: Page;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { page: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
  { page: 'challenges', label: 'Challenges', icon: <Trophy className="h-5 w-5" /> },
  { page: 'battles', label: 'Arena', icon: <Swords className="h-5 w-5" /> },
  { page: 'scoreboard', label: 'Scoreboard', icon: <Zap className="h-5 w-5" /> },
  { page: 'reward-zone', label: 'Reward Zone', icon: <Gift className="h-5 w-5" /> },
];

const LEADERSHIP_ITEMS: NavItem[] = [
  { page: 'earnie-assistant', label: 'Assistant', icon: <MessageSquare className="h-5 w-5" /> },
  { page: 'admin', label: 'Command Center', icon: <LayoutDashboard className="h-5 w-5" /> },
  { page: 'teams', label: 'Teams', icon: <Users className="h-5 w-5" /> },
];

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { page: 'super-admin', label: 'Super Admin', icon: <Shield className="h-5 w-5" /> },
];

export default function AppShell() {
  const { currentPage, navigate, sidebarOpen, toggleSidebar } = useApp();
  const { user, signOut } = useAuth();

  const role = user?.role ?? 'user';
  const showLeadership = isCommandCenter(role);
  const showSuperAdmin = role === 'super-admin';
  const balanceType = roleBalanceType(role);

  const balanceValue = (() => {
    if (!user) return 0;
    switch (balanceType) {
      case 'vault': return user.admin_vault_balance;
      case 'coins': return user.coins;
      case 'envelope': return 0; // team_lead_budgets fetched separately
    }
  })();

  const balanceLabel = (() => {
    switch (balanceType) {
      case 'vault': return 'Vault';
      case 'envelope': return 'Budget';
      case 'coins': return 'Coins';
    }
  })();

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} border-r border-border bg-card flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          {sidebarOpen && <span className="text-lg font-bold text-primary">Sales XP</span>}
          <Button
            variant="ghost"
            size="icon"
            className={sidebarOpen ? 'ml-auto' : 'mx-auto'}
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          {/* Player pages */}
          <nav className="space-y-1 px-2">
            {NAV_ITEMS.map((item) => (
              <SidebarButton
                key={item.page}
                item={item}
                active={currentPage === item.page}
                collapsed={!sidebarOpen}
                onClick={() => navigate(item.page)}
              />
            ))}
          </nav>

          {/* Leadership pages */}
          {showLeadership && (
            <>
              <Separator className="my-3 mx-2" />
              {sidebarOpen && (
                <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Leadership
                </p>
              )}
              <nav className="space-y-1 px-2">
                {LEADERSHIP_ITEMS.map((item) => (
                  <SidebarButton
                    key={item.page}
                    item={item}
                    active={currentPage === item.page}
                    collapsed={!sidebarOpen}
                    onClick={() => navigate(item.page)}
                  />
                ))}
              </nav>
            </>
          )}

          {/* Super admin */}
          {showSuperAdmin && (
            <>
              <Separator className="my-3 mx-2" />
              <nav className="space-y-1 px-2">
                {SUPER_ADMIN_ITEMS.map((item) => (
                  <SidebarButton
                    key={item.page}
                    item={item}
                    active={currentPage === item.page}
                    collapsed={!sidebarOpen}
                    onClick={() => navigate(item.page)}
                  />
                ))}
              </nav>
            </>
          )}
        </ScrollArea>

        {/* Settings at bottom */}
        <div className="border-t border-border px-2 py-2">
          <SidebarButton
            item={{ page: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> }}
            active={currentPage === 'settings'}
            collapsed={!sidebarOpen}
            onClick={() => navigate('settings')}
          />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <Coins className="h-3.5 w-3.5" />
              {balanceValue.toLocaleString()} {balanceLabel}
            </Badge>
            {user?.available_spins ? (
              <Badge variant="outline" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                {user.available_spins} Spins
              </Badge>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                {user?.full_name || user?.email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{user?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('settings')}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'challenges' && <PlaceholderPage title="Challenges" desc="Race to the target — first to hit it wins the prize." />}
          {currentPage === 'battles' && <PlaceholderPage title="The Arena" desc="1v1 and team battles on your KPIs." />}
          {currentPage === 'scoreboard' && <PlaceholderPage title="Scoreboard" desc="Live rankings across your organization." />}
          {currentPage === 'power-wheel' && <PlaceholderPage title="Power Wheel" desc="Event-based prize wheel." />}
          {currentPage === 'reward-zone' && <PlaceholderPage title="Reward Zone" desc="Spend your coins on gift cards, experiences, and more." />}
          {currentPage === 'settings' && <PlaceholderPage title="Settings" desc="Profile, avatar, security, history." />}
          {currentPage === 'teams' && <PlaceholderPage title="Teams" desc="Team management and requests." />}
          {currentPage === 'earnie-assistant' && <PlaceholderPage title="Sales Assistant" desc="AI-powered assistant for leadership." />}
          {currentPage === 'admin' && <PlaceholderPage title="Command Center" desc="Manage challenges, battles, rewards, and your team." />}
          {currentPage === 'super-admin' && <PlaceholderPage title="Super Admin" desc="Platform management — organizations, system admins." />}
        </main>
      </div>
    </div>
  );
}

function SidebarButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </button>
  );
}

function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-2 max-w-md">{desc}</p>
      </div>
    </div>
  );
}
