import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  email: string;
  full_name: string | null;
  coins: number;
  total_score: number;
  avatar_url: string | null;
}

export default function ScoreboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<LeaderboardEntry[]>('/leaderboard')
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Scoreboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Live rankings across your organization.</p>
      </div>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {top3.map((entry, idx) => {
            const icons = [
              <Trophy key="1" className="h-8 w-8 text-amber-500" />,
              <Medal key="2" className="h-8 w-8 text-gray-400" />,
              <Award key="3" className="h-8 w-8 text-amber-700" />,
            ];
            const initials = entry.full_name
              ? entry.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
              : entry.email[0]?.toUpperCase();
            const isMe = entry.id === user?.id;

            return (
              <Card key={entry.id} className={`text-center ${isMe ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-6 pb-4 space-y-3">
                  <div className="flex justify-center">{icons[idx]}</div>
                  <Avatar className="h-16 w-16 mx-auto">
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{entry.full_name || entry.email}</p>
                    <p className="text-2xl font-bold text-primary">{entry.total_score.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{entry.coins} coins</p>
                  </div>
                  {isMe && <Badge variant="outline">You</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rest of the leaderboard */}
      <div className="space-y-2">
        {rest.map((entry, idx) => {
          const rank = idx + 4;
          const isMe = entry.id === user?.id;
          const initials = entry.full_name
            ? entry.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
            : entry.email[0]?.toUpperCase();
          return (
            <Card key={entry.id} className={isMe ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-lg font-bold text-muted-foreground w-8 text-right">{rank}</span>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{entry.full_name || entry.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{entry.total_score.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{entry.coins} coins</p>
                </div>
                {isMe && <Badge variant="outline">You</Badge>}
              </CardContent>
            </Card>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No scores yet. Start competing!</p>
          </div>
        )}
      </div>
    </div>
  );
}
