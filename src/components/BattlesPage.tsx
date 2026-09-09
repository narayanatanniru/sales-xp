import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import type { Battle, BattleRecord } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Swords, Star, Clock, Coins, Trophy, Target, Timer } from 'lucide-react';
import { toast } from 'sonner';

export default function BattlesPage() {
  const { user } = useAuth();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [myRecord, setMyRecord] = useState<BattleRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!user?.organization_id) return;
    const channel = supabase
      .channel('battles-live')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'battles',
        filter: `organization_id=eq.${user.organization_id}`,
      }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.organization_id]);

  async function loadData() {
    try {
      const [battleData, recordData] = await Promise.all([
        apiRequest<Battle[]>('/battles'),
        apiRequest<BattleRecord>('/battles/my-record').catch(() => null),
      ]);
      setBattles(battleData);
      setMyRecord(recordData);
    } catch {
      toast.error('Failed to load battles');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(battleId: string) {
    try {
      await apiRequest(`/battles/${battleId}/accept`, { method: 'POST' });
      toast.success('Battle accepted!');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept');
    }
  }

  const liveBattles = battles.filter(b => b.status === 'live');
  const pendingBattles = battles.filter(b => ['pending', 'accepted'].includes(b.status));
  const completedBattles = battles.filter(b => b.status === 'completed');
  const featured = battles.find(b => b.is_featured && b.status === 'live');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" /> The Arena
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            1v1 and team battles — compete on your KPIs.
          </p>
        </div>
        {user?.role === 'user' && (
          <Button>Create Battle</Button>
        )}
      </div>

      {/* My Record */}
      {myRecord && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Wins" value={myRecord.wins} icon={<Trophy className="h-4 w-4 text-emerald-500" />} />
          <StatCard label="Losses" value={myRecord.losses} icon={<Target className="h-4 w-4 text-red-500" />} />
          <StatCard label="Draws" value={myRecord.draws} icon={<Timer className="h-4 w-4 text-amber-500" />} />
          <StatCard label="Best Streak" value={myRecord.best_streak} icon={<Swords className="h-4 w-4 text-primary" />} />
        </div>
      )}

      {/* Featured Main Event */}
      {featured && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-accent fill-accent" />
              <CardTitle className="text-lg">Main Event</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BattleCard battle={featured} userId={user?.id} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live ({liveBattles.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingBattles.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedBattles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-4 mt-4">
          {liveBattles.length === 0 ? (
            <EmptyState />
          ) : (
            liveBattles.map(b => <BattleCard key={b.id} battle={b} userId={user?.id} />)
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingBattles.length === 0 ? (
            <EmptyState message="No pending battles." />
          ) : (
            pendingBattles.map(b => (
              <BattleCard
                key={b.id}
                battle={b}
                userId={user?.id}
                onAccept={b.opponent_id === user?.id ? () => handleAccept(b.id) : undefined}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedBattles.length === 0 ? (
            <EmptyState message="No completed battles yet." />
          ) : (
            completedBattles.map(b => <BattleCard key={b.id} battle={b} userId={user?.id} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BattleCard({
  battle,
  userId,
  onAccept,
}: {
  battle: Battle;
  userId?: string;
  onAccept?: () => void;
}) {
  const isChallenger = battle.challenger_id === userId;
  const isOpponent = battle.opponent_id === userId;
  const isWinner = battle.winner_id === userId;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Challenger */}
            <div className="text-center min-w-[80px]">
              <p className="text-sm font-medium truncate">
                {isChallenger ? 'You' : 'Challenger'}
              </p>
              <p className="text-2xl font-bold">{battle.challenger_score}</p>
            </div>

            <div className="text-center px-4">
              <Swords className="h-5 w-5 text-muted-foreground mx-auto" />
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs capitalize">{battle.mode}</Badge>
                <Badge variant="outline" className="text-xs">
                  <Coins className="h-3 w-3 mr-1" />
                  {battle.prize_pool}
                </Badge>
              </div>
            </div>

            {/* Opponent */}
            <div className="text-center min-w-[80px]">
              <p className="text-sm font-medium truncate">
                {isOpponent ? 'You' : 'Opponent'}
              </p>
              <p className="text-2xl font-bold">{battle.opponent_score}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <BattleStatusBadge status={battle.status} />
            {battle.end_time && battle.status === 'live' && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {getTimeLeft(battle.end_time)}
              </Badge>
            )}
            {isWinner && <Badge variant="success">Won!</Badge>}
            {onAccept && (
              <Button size="sm" onClick={onAccept}>Accept</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BattleStatusBadge({ status }: { status: Battle['status'] }) {
  const variants: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'destructive'> = {
    live: 'success', pending: 'warning', accepted: 'warning',
    completed: 'secondary', cancelled: 'destructive', declined: 'destructive',
  };
  return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message = 'No live battles right now.' }: { message?: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p>{message}</p>
    </div>
  );
}

function getTimeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / (1000 * 60))}m`;
}
