import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import type { Challenge, ChallengeParticipant } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Clock, Users, Coins, Zap, Target } from 'lucide-react';
import { toast } from 'sonner';

interface ChallengeWithParticipation extends Challenge {
  participant_count?: number;
  my_participation?: ChallengeParticipant | null;
}

export default function ChallengesPage() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeWithParticipation[]>([]);
  const [myParticipations, setMyParticipations] = useState<ChallengeParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  // Realtime: challenge updates
  useEffect(() => {
    if (!user?.organization_id) return;

    const channel = supabase
      .channel('challenges-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'challenges',
        filter: `organization_id=eq.${user.organization_id}`,
      }, () => { loadData(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'challenge_participants',
      }, () => { loadData(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.organization_id]);

  async function loadData() {
    try {
      const [challengeData, participationData] = await Promise.all([
        apiRequest<ChallengeWithParticipation[]>('/challenges'),
        apiRequest<ChallengeParticipant[]>('/challenges/my-participations').catch(() => []),
      ]);
      setChallenges(challengeData);
      setMyParticipations(participationData);
    } catch {
      toast.error('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(challengeId: string) {
    try {
      await apiRequest('/challenge/join', { method: 'POST', body: { challenge_id: challengeId } });
      toast.success('Joined challenge!');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    }
  }

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const scheduledChallenges = challenges.filter(c => c.status === 'scheduled');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const myChallengeIds = new Set(myParticipations.map(p => p.challenge_id));

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
            <Trophy className="h-6 w-6 text-primary" /> Challenges
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Race to the target — first to hit it wins the prize.
          </p>
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeChallenges.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({scheduledChallenges.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedChallenges.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          {activeChallenges.length === 0 ? (
            <EmptyState message="No active challenges right now." />
          ) : (
            activeChallenges.map(c => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                isJoined={myChallengeIds.has(c.id)}
                participation={myParticipations.find(p => p.challenge_id === c.id)}
                onJoin={() => handleJoin(c.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4 mt-4">
          {scheduledChallenges.length === 0 ? (
            <EmptyState message="No upcoming challenges." />
          ) : (
            scheduledChallenges.map(c => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                isJoined={myChallengeIds.has(c.id)}
                onJoin={() => handleJoin(c.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedChallenges.length === 0 ? (
            <EmptyState message="No completed challenges yet." />
          ) : (
            completedChallenges.map(c => (
              <ChallengeCard key={c.id} challenge={c} isJoined={myChallengeIds.has(c.id)} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChallengeCard({
  challenge,
  isJoined,
  participation,
  onJoin,
}: {
  challenge: ChallengeWithParticipation;
  isJoined: boolean;
  participation?: ChallengeParticipant | null;
  onJoin?: () => void;
}) {
  const progressPct = participation
    ? Math.min(100, (participation.progress / challenge.target_value) * 100)
    : 0;

  const rewardIcon = challenge.reward_type === 'coins'
    ? <Coins className="h-4 w-4" />
    : <Zap className="h-4 w-4" />;

  const timeLeft = challenge.end_date
    ? getTimeLeft(challenge.end_date)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{challenge.title}</CardTitle>
            {challenge.description && (
              <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={challenge.status} />
            <Badge variant="outline" className="capitalize">
              {challenge.type === 'team' ? <Users className="h-3 w-3 mr-1" /> : null}
              {challenge.type}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="h-4 w-4" />
            Target: {challenge.target_value}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-primary">
            {rewardIcon}
            {challenge.reward_value} {challenge.reward_type}
          </span>
          {timeLeft && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {timeLeft}
            </span>
          )}
        </div>

        {/* Progress bar for joined challenges */}
        {isJoined && participation && challenge.status === 'active' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Your progress</span>
              <span>{participation.progress} / {challenge.target_value}</span>
            </div>
            <Progress value={progressPct} />
          </div>
        )}

        {/* Join button */}
        {!isJoined && challenge.status === 'active' && onJoin && (
          <Button onClick={onJoin} size="sm">
            Join Challenge
          </Button>
        )}
        {isJoined && !participation?.completed && challenge.status === 'active' && (
          <Badge variant="success">Joined</Badge>
        )}
        {participation?.completed && (
          <Badge variant="success">Completed!</Badge>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Challenge['status'] }) {
  const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
    active: 'success',
    scheduled: 'warning',
    completed: 'secondary',
    expired: 'destructive',
    cancelled: 'destructive',
  };
  return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p>{message}</p>
    </div>
  );
}

function getTimeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h left`;
  return `${Math.floor(diff / (1000 * 60))}m left`;
}
