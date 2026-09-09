import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import type { Reward } from '@/lib/database.types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Gift, Coins, ShoppingBag, CreditCard, Sparkles, Package } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'gift-cards', label: 'Gift Cards', icon: CreditCard },
  { value: 'tech', label: 'Tech', icon: Package },
  { value: 'experiences', label: 'Experiences', icon: Sparkles },
  { value: 'luxury', label: 'Luxury', icon: ShoppingBag },
  { value: 'travel', label: 'Travel', icon: Gift },
];

export default function RewardZonePage() {
  const { user, refreshUser } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    apiRequest<Reward[]>('/rewards')
      .then(setRewards)
      .catch(() => toast.error('Failed to load rewards'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = selectedCategory === 'all'
    ? rewards
    : rewards.filter(r => r.category === selectedCategory);

  async function handleRedeem() {
    if (!confirmReward) return;
    setRedeeming(true);
    try {
      await apiRequest('/reward/redeem', {
        method: 'POST',
        body: { reward_id: confirmReward.id },
      });
      toast.success(`Redeemed "${confirmReward.name}"!`);
      setConfirmReward(null);
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem');
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" /> Reward Zone
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Spend your coins on gift cards, experiences, and more.
        </p>
      </div>

      {/* Balance */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">{user?.coins?.toLocaleString() ?? 0} coins</span>
          </div>
          <span className="text-sm text-muted-foreground">
            available to spend
          </span>
        </CardContent>
      </Card>

      {/* Category filter */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          {CATEGORIES.map(cat => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No rewards available in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(reward => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  canAfford={(user?.coins ?? 0) >= reward.coin_cost}
                  onRedeem={() => setConfirmReward(reward)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm dialog */}
      <Dialog open={!!confirmReward} onOpenChange={() => setConfirmReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem Reward</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem "{confirmReward?.name}" for {confirmReward?.coin_cost} coins?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReward(null)}>Cancel</Button>
            <Button onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? 'Redeeming...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RewardCard({
  reward,
  canAfford,
  onRedeem,
}: {
  reward: Reward;
  canAfford: boolean;
  onRedeem: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      {reward.image_url && (
        <div className="h-40 bg-muted flex items-center justify-center">
          <img src={reward.image_url} alt={reward.name} className="h-full w-full object-cover" />
        </div>
      )}
      {!reward.image_url && (
        <div className="h-40 bg-muted flex items-center justify-center">
          <Gift className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">{reward.name}</h3>
          {reward.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{reward.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Coins className="h-3 w-3" />
            {reward.coin_cost}
          </Badge>
          {reward.stock !== null && (
            <span className="text-xs text-muted-foreground">{reward.stock} left</span>
          )}
        </div>
        <Button
          className="w-full"
          size="sm"
          disabled={!canAfford || (reward.stock !== null && reward.stock <= 0)}
          onClick={onRedeem}
        >
          {!canAfford ? 'Not enough coins' : 'Redeem'}
        </Button>
      </CardContent>
    </Card>
  );
}
