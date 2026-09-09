/**
 * Database type definitions.
 * These mirror the Postgres schema and are used throughout the app.
 * In production, generate these with `supabase gen types typescript`.
 */

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  settings: Record<string, unknown>;
  api_key: string;
  system_mode: 'normal' | 'in_house';
  coin_to_dollar_rate: number;
  stripe_customer_id: string | null;
  default_scoreboard_theme_id: string | null;
  timezone: string;
  logo_url: string | null;
  tagline: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'team-lead' | 'admin' | 'owner' | 'co-owner' | 'super-admin';
  organization_id: string | null;
  team_id: string | null;
  coins: number;
  available_spins: number;
  total_score: number;
  admin_vault_balance: number;
  avatar_url: string | null;
  birthday: string | null;
  last_login: string | null;
  is_active: boolean;
  has_temporary_password: boolean;
  has_completed_onboarding: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  icon: string | null;
  team_lead_id: string | null;
  team_lead_ids: string[];
  autopilot_enabled: boolean;
  stats: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KpiDefinition {
  id: string;
  organization_id: string;
  kpi_name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KpiUpdate {
  id: string;
  organization_id: string;
  user_id: string;
  kpi_definition_id: string;
  quantity: number;
  source: 'webhook' | 'salesforce' | 'zapier' | 'admin_manual' | 'csv';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Challenge {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  type: 'individual' | 'team';
  visibility: 'public' | 'private';
  kpi_definition_id: string | null;
  target_value: number;
  reward_type: 'coins' | 'spins' | 'item' | 'experience' | 'reward';
  reward_value: number;
  reward_id: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'expired' | 'cancelled';
  escrow_coins: number;
  funded_from_cycle_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Battle {
  id: string;
  organization_id: string;
  title: string | null;
  kpi_definition_id: string | null;
  mode: 'timed' | 'target';
  type: '1v1' | 'team';
  target_value: number | null;
  wager_amount: number;
  prize_pool: number;
  status: 'pending' | 'accepted' | 'live' | 'completed' | 'cancelled' | 'declined';
  challenger_id: string | null;
  opponent_id: string | null;
  challenger_score: number;
  opponent_score: number;
  winner_id: string | null;
  is_admin_created: boolean;
  is_featured: boolean;
  escrow_coins: number;
  funded_from_cycle_id: string | null;
  penalty_id: string | null;
  reward_id: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface BattleRecord {
  id: string;
  user_id: string;
  organization_id: string;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  best_streak: number;
  created_at: string;
  updated_at: string;
}

export interface Reward {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: 'gift-cards' | 'luxury' | 'experiences' | 'tech' | 'travel';
  coin_cost: number;
  cash_value: number | null;
  reward_type: string;
  stock: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  organization_id: string;
  user_id: string;
  reward_id: string;
  status: 'pending' | 'approved' | 'fulfilled' | 'cancelled';
  tango_order_id: string | null;
  tango_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  organization_id: string;
  user_id: string;
  type: 'coin' | 'spin' | 'admin_vault';
  action: 'add' | 'subtract';
  amount: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  organization_id: string;
  kpi_definition_id: string;
  cycle_id: string | null;
  target_value: number;
  payout_model: 'capped' | 'stacked' | 'threshold';
  status: 'active' | 'expired' | 'completed';
  created_by: string | null;
  created_at: string;
}

export interface BudgetCycle {
  id: string;
  organization_id: string;
  starts_at: string;
  ends_at: string;
  total_coins: number;
  status: 'open' | 'swept' | 'expired';
  swept_at: string | null;
  created_at: string;
}

export interface TeamLeadBudget {
  id: string;
  organization_id: string;
  user_id: string;
  cycle_id: string | null;
  allocated_coins: number;
  spent_coins: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityFeedItem {
  id: string;
  organization_id: string;
  user_id: string | null;
  event_type: string;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PowerWheelEvent {
  id: string;
  organization_id: string;
  title: string;
  status: 'draft' | 'countdown' | 'live' | 'ended';
  escrow_coins: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutopilotRun {
  id: string;
  organization_id: string;
  team_id: string;
  trigger: 'daily' | 'reactive' | 'manual';
  decided_by: 'ai' | 'deterministic';
  reasoning: string | null;
  plays_launched: number;
  coins_spent: number;
  created_at: string;
}
