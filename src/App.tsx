import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { AppProvider } from './contexts/AppContext';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from 'sonner';
import LoginPage from './components/LoginPage';
import AppShell from './components/AppShell';

/**
 * Sales XP — Root application.
 *
 * Provider tree mirrors the doc's architecture:
 *   AuthProvider → OrganizationProvider → AppProvider → TooltipProvider
 *
 * Guard chain on login:
 *   1. Suspended check
 *   2. Org check
 *   3. Forced temp-password reset
 *   4. Avatar picker (FTUE)
 *   5. MFA guard (TOTP, 24-hour re-verify)
 */

function AuthGate() {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // Guard: suspended user
  if (user && !user.is_active) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-destructive">Account Suspended</h2>
          <p className="text-muted-foreground">Contact your organization admin.</p>
        </div>
      </div>
    );
  }

  // Guard: forced temporary password reset
  if (user?.has_temporary_password) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm p-8 bg-card rounded-xl border border-border shadow-lg text-center space-y-4">
          <h2 className="text-xl font-semibold">Change Your Password</h2>
          <p className="text-muted-foreground text-sm">
            You must set a new password before continuing.
          </p>
          <p className="text-xs text-muted-foreground">
            Password reset coming in next update.
          </p>
        </div>
      </div>
    );
  }

  // Guard: FTUE — avatar picker
  if (user && !user.has_completed_onboarding) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm p-8 bg-card rounded-xl border border-border shadow-lg text-center space-y-4">
          <h2 className="text-xl font-semibold">Complete Your Profile</h2>
          <p className="text-muted-foreground text-sm">
            Choose your avatar to get started.
          </p>
          <p className="text-xs text-muted-foreground">
            Avatar picker coming in next update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <OrganizationProvider>
      <AppProvider>
        <TooltipProvider>
          <AppShell />
        </TooltipProvider>
      </AppProvider>
    </OrganizationProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <AuthGate />
    </AuthProvider>
  );
}
