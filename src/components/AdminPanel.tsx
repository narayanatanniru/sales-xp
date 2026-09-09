import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { apiRequest } from '@/lib/api';
import { isOwnerLevel, type Role } from '@/lib/roles';
import { formatUsd, coinsToUsd } from '@/lib/coinPricing';
import type { User, Challenge, Reward } from '@/lib/database.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  LayoutDashboard, Trophy, Swords, Gift, Users, Coins,
  Plus, Settings, TrendingUp, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type AdminTab = 'overview' | 'challenges' | 'battles' | 'rewards' | 'users' | 'vault' | 'kpi-rewards';

export default function AdminPanel() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const role = user?.role as Role;
  const showVault = isOwnerLevel(role);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" /> Command Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your organization's plays, rewards, and people.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="challenges"><Trophy className="h-4 w-4 mr-1" /> Challenges</TabsTrigger>
          <TabsTrigger value="battles"><Swords className="h-4 w-4 mr-1" /> Battles</TabsTrigger>
          <TabsTrigger value="rewards"><Gift className="h-4 w-4 mr-1" /> Rewards</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
          {showVault && (
            <TabsTrigger value="vault"><Coins className="h-4 w-4 mr-1" /> Coin Vault</TabsTrigger>
          )}
          <TabsTrigger value="kpi-rewards"><TrendingUp className="h-4 w-4 mr-1" /> KPI Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="challenges"><ChallengesTab /></TabsContent>
        <TabsContent value="battles"><BattlesTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        {showVault && <TabsContent value="vault"><VaultTab orgRate={organization?.coin_to_dollar_rate ?? 0.10} /></TabsContent>}
        <TabsContent value="kpi-rewards"><KpiRewardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { user } = useAuth();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Vault Balance</CardDescription>
          <CardTitle className="text-3xl">{user?.admin_vault_balance?.toLocaleString() ?? 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">coins available</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Active Challenges</CardDescription>
          <CardTitle className="text-3xl">—</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">running right now</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Active Battles</CardDescription>
          <CardTitle className="text-3xl">—</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">in the arena</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Challenges Admin ──────────────────────────────────────────────────────────

function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Challenge[]>('/challenges')
      .then(setChallenges)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manage Challenges</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Challenge
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No challenges yet. Create your first one!</div>
      ) : (
        <div className="space-y-2">
          {challenges.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Target: {c.target_value} | Reward: {c.reward_value} {c.reward_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="capitalize">{c.status}</Badge>
                  {c.escrow_coins > 0 && (
                    <Badge variant="outline"><Coins className="h-3 w-3 mr-1" />{c.escrow_coins} escrowed</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateChallengeDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {
        setShowCreate(false);
        apiRequest<Challenge[]>('/challenges').then(setChallenges);
      }} />
    </div>
  );
}

function CreateChallengeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('10');
  const [rewardValue, setRewardValue] = useState('50');
  const [rewardType, setRewardType] = useState('coins');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await apiRequest('/admin/create-challenge', {
        method: 'POST',
        body: {
          title,
          target_value: Number(targetValue),
          reward_value: Number(rewardValue),
          reward_type: rewardType,
          type: 'individual',
          visibility: 'public',
        },
      });
      toast.success('Challenge created!');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Challenge</DialogTitle>
          <DialogDescription>Set up a new race for your team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Friday Sprint" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Target</Label>
              <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
            </div>
            <div>
              <Label>Reward</Label>
              <Input type="number" value={rewardValue} onChange={e => setRewardValue(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reward Type</Label>
            <Select value={rewardType} onValueChange={setRewardType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coins">Coins</SelectItem>
                <SelectItem value="spins">Spins</SelectItem>
                <SelectItem value="item">Item</SelectItem>
                <SelectItem value="experience">Experience</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !title}>
            {creating ? 'Creating...' : 'Create & Escrow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Battles Admin ─────────────────────────────────────────────────────────────

function BattlesTab() {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Manage Battles</h2>
        <Button><Plus className="h-4 w-4 mr-1" /> Create Admin Battle</Button>
      </div>
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Battle management panel — approve, reject, feature, and settle battles.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Rewards Admin ─────────────────────────────────────────────────────────────

function RewardsTab() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Reward[]>('/rewards')
      .then(setRewards)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reward Catalog</h2>
        <Button><Plus className="h-4 w-4 mr-1" /> Add Reward</Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          {rewards.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{r.category} | {r.coin_cost} coins</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.stock !== null && <Badge variant="outline">{r.stock} in stock</Badge>}
                  <Badge variant={r.is_active ? 'success' : 'secondary'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {rewards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No rewards yet. Add your first one!</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Users Admin ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    apiRequest<User[]>('/admin/users')
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">People</h2>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4 mr-1" /> Invite User
        </Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{u.role}</Badge>
                  <Badge variant={u.is_active ? 'success' : 'destructive'}>
                    {u.is_active ? 'Active' : 'Suspended'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{u.coins} coins</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InviteUserDialog open={showInvite} onClose={() => setShowInvite(false)} onInvited={() => {
        setShowInvite(false);
        apiRequest<User[]>('/admin/users').then(setUsers);
      }} />
    </div>
  );
}

function InviteUserDialog({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    setInviting(true);
    try {
      await apiRequest('/admin/invite-user', {
        method: 'POST',
        body: { email, full_name: fullName, role },
      });
      toast.success(`Invited ${email}`);
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>They will receive a temporary password by email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" />
          </div>
          <div>
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User (Rep)</SelectItem>
                <SelectItem value="team-lead">Team Lead</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInvite} disabled={inviting || !email}>
            {inviting ? 'Inviting...' : 'Send Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vault Tab ─────────────────────────────────────────────────────────────────

function VaultTab({ orgRate }: { orgRate: number }) {
  const { user } = useAuth();
  const balance = user?.admin_vault_balance ?? 0;

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Org Vault
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-3xl font-bold">{balance.toLocaleString()} coins</p>
              <p className="text-sm text-muted-foreground">{formatUsd(coinsToUsd(balance, orgRate))}</p>
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <Button><Plus className="h-4 w-4 mr-1" /> Buy Coins</Button>
              <Button variant="outline"><Settings className="h-4 w-4 mr-1" /> Payment Methods</Button>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Recent Transactions</p>
            <p className="text-sm text-muted-foreground">Transaction history will appear here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── KPI Rewards Tab ───────────────────────────────────────────────────────────

function KpiRewardsTab() {
  return (
    <div className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> KPI Rewards Engine
          </CardTitle>
          <CardDescription>
            Automatic per-KPI threshold rewards paid from the vault.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-md bg-muted">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Configure reward rules</p>
              <p className="text-sm text-muted-foreground">
                Set up rules per KPI with thresholds, reset windows (daily/weekly/monthly),
                and pause modes. Supports stacked tiers and clawback on score decrement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
