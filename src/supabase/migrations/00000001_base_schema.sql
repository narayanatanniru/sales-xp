-- =============================================================================
-- Sales XP — Base Schema
-- =============================================================================
-- Multi-tenant gamified sales performance platform.
-- All tables scoped by organization_id. RLS enabled on every table.
-- Extensions: pgcrypto, uuid-ossp, pg_cron, pg_net, supabase_vault.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TENANCY & PEOPLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan TEXT DEFAULT 'standard',
  settings JSONB DEFAULT '{}',
  api_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  system_mode TEXT NOT NULL DEFAULT 'normal' CHECK (system_mode IN ('normal', 'in_house')),
  coin_to_dollar_rate NUMERIC(10, 4) DEFAULT 0.10,
  stripe_customer_id TEXT,
  default_scoreboard_theme_id UUID,
  timezone TEXT DEFAULT 'America/Detroit',
  logo_url TEXT,
  tagline TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'team-lead', 'admin', 'owner', 'co-owner', 'super-admin')),
  organization_id UUID REFERENCES organizations(id),
  team_id UUID,
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  available_spins INTEGER NOT NULL DEFAULT 0 CHECK (available_spins >= 0),
  total_score INTEGER NOT NULL DEFAULT 0,
  admin_vault_balance INTEGER NOT NULL DEFAULT 0
    CHECK (
      (role = 'owner' AND admin_vault_balance >= 0) OR
      (role != 'owner' AND admin_vault_balance = 0) OR
      (role = 'co-owner' AND admin_vault_balance = 0) OR
      (role = 'admin' AND admin_vault_balance = 0)
    ),
  avatar_url TEXT,
  birthday DATE,
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  has_temporary_password BOOLEAN DEFAULT false,
  has_completed_onboarding BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  icon TEXT,
  team_lead_id UUID REFERENCES users(id),
  team_lead_ids UUID[] DEFAULT '{}',
  autopilot_enabled BOOLEAN DEFAULT false,
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Back-reference for users.team_id
ALTER TABLE users ADD CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS team_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  type TEXT NOT NULL CHECK (type IN ('join', 'leave')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- KPIs & INTEGRATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kpi_name TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, kpi_name)
);

CREATE TABLE IF NOT EXISTS kpi_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  kpi_definition_id UUID NOT NULL REFERENCES kpi_definitions(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  source TEXT DEFAULT 'webhook'
    CHECK (source IN ('webhook', 'salesforce', 'zapier', 'admin_manual', 'csv')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- CHALLENGES (PLAYS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'team')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  kpi_definition_id UUID REFERENCES kpi_definitions(id),
  target_value NUMERIC NOT NULL DEFAULT 1,
  reward_type TEXT DEFAULT 'coins' CHECK (reward_type IN ('coins', 'spins', 'item', 'experience', 'reward')),
  reward_value INTEGER DEFAULT 0,
  reward_id UUID,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'completed', 'expired', 'cancelled')),
  escrow_coins INTEGER DEFAULT 0,
  funded_from_cycle_id UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  progress NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  user_id UUID NOT NULL REFERENCES users(id),
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- BATTLES (ARENA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT,
  kpi_definition_id UUID REFERENCES kpi_definitions(id),
  mode TEXT NOT NULL DEFAULT 'timed' CHECK (mode IN ('timed', 'target')),
  type TEXT NOT NULL DEFAULT '1v1' CHECK (type IN ('1v1', 'team')),
  target_value NUMERIC,
  wager_amount INTEGER DEFAULT 0,
  prize_pool INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'live', 'completed', 'cancelled', 'declined')),
  challenger_id UUID REFERENCES users(id),
  opponent_id UUID REFERENCES users(id),
  challenger_score NUMERIC DEFAULT 0,
  opponent_score NUMERIC DEFAULT 0,
  winner_id UUID REFERENCES users(id),
  is_admin_created BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  escrow_coins INTEGER DEFAULT 0,
  funded_from_cycle_id UUID,
  penalty_id UUID,
  reward_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
) ;

-- Enable REPLICA IDENTITY FULL for realtime winner detection
ALTER TABLE battles REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS battle_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- =============================================================================
-- REWARDS & MONEY
-- =============================================================================

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'tech'
    CHECK (category IN ('gift-cards', 'luxury', 'experiences', 'tech', 'travel')),
  coin_cost INTEGER NOT NULL DEFAULT 0,
  cash_value NUMERIC(10, 2),
  reward_type TEXT DEFAULT 'standard',
  stock INTEGER,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
  tango_order_id TEXT,
  tango_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('coin', 'spin', 'admin_vault')),
  action TEXT NOT NULL CHECK (action IN ('add', 'subtract')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  stripe_payment_method_id TEXT NOT NULL,
  brand TEXT,
  last_four TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coin_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  coins INTEGER NOT NULL,
  amount_usd NUMERIC(10, 2) NOT NULL,
  fee_usd NUMERIC(10, 2) DEFAULT 0,
  fee_bps INTEGER DEFAULT 600,
  total_usd NUMERIC(10, 2) NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS penalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  coin_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- POWER WHEEL
-- =============================================================================

CREATE TABLE IF NOT EXISTS power_wheel_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'countdown', 'live', 'ended')),
  escrow_coins INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS power_wheel_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES power_wheel_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'coins' CHECK (type IN ('coins', 'item', 'experience', 'penalty', 'none')),
  value INTEGER DEFAULT 0,
  weight NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS power_wheel_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES power_wheel_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  has_spun BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS power_wheel_spin_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES power_wheel_events(id),
  user_id UUID NOT NULL REFERENCES users(id),
  segment_id UUID NOT NULL REFERENCES power_wheel_segments(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- CLASSIC SPIN WHEEL
-- =============================================================================

CREATE TABLE IF NOT EXISTS wheel_prizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'coins',
  value INTEGER DEFAULT 0,
  weight NUMERIC DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spin_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  prize_id UUID REFERENCES wheel_prizes(id),
  prize_name TEXT,
  prize_value INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- GOALS & BUDGETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS budget_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  total_coins INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'swept', 'expired')),
  swept_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  cycle_id UUID REFERENCES budget_cycles(id),
  total_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_lead_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  cycle_id UUID REFERENCES budget_cycles(id),
  allocated_coins INTEGER NOT NULL DEFAULT 0,
  spent_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_lead_budget_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES team_lead_budgets(id),
  amount INTEGER NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_lead_budget_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kpi_definition_id UUID NOT NULL REFERENCES kpi_definitions(id),
  cycle_id UUID REFERENCES budget_cycles(id),
  target_value NUMERIC NOT NULL,
  payout_model TEXT DEFAULT 'capped' CHECK (payout_model IN ('capped', 'stacked', 'threshold')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_team_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_rep_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  daily_target NUMERIC,
  weekly_target NUMERIC,
  monthly_target NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- KPI REWARD ENGINE
-- =============================================================================

CREATE TABLE IF NOT EXISTS kpi_reward_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,
  enabled BOOLEAN DEFAULT false,
  auto_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_reward_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kpi_definition_id UUID NOT NULL REFERENCES kpi_definitions(id),
  threshold NUMERIC NOT NULL,
  reward_coins INTEGER NOT NULL,
  reset_window TEXT DEFAULT 'monthly'
    CHECK (reset_window IN ('daily', 'weekly', 'monthly', 'custom')),
  reset_days INTEGER,
  stacked BOOLEAN DEFAULT false,
  pause_mode TEXT DEFAULT 'forward-only',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_reward_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rule_id UUID NOT NULL REFERENCES kpi_reward_rules(id),
  coins INTEGER NOT NULL,
  clawed_back BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_reward_pending_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rule_id UUID NOT NULL REFERENCES kpi_reward_rules(id),
  coins INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- GOAL REWARD ENGINE
-- =============================================================================

CREATE TABLE IF NOT EXISTS goal_reward_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  mode TEXT DEFAULT 'capped' CHECK (mode IN ('capped', 'stacked')),
  daily_amount INTEGER,
  weekly_cap INTEGER,
  monthly_cap INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_reward_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  goal_id UUID NOT NULL REFERENCES goals(id),
  rule_id UUID NOT NULL REFERENCES goal_reward_rules(id),
  coins INTEGER NOT NULL,
  period TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_reward_pending_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  goal_id UUID NOT NULL REFERENCES goals(id),
  rule_id UUID NOT NULL REFERENCES goal_reward_rules(id),
  coins INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- AUTOPILOT & AI
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_lead_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('challenge', 'battle')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS autopilot_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  trigger TEXT NOT NULL CHECK (trigger IN ('daily', 'reactive', 'manual')),
  decided_by TEXT DEFAULT 'ai' CHECK (decided_by IN ('ai', 'deterministic')),
  reasoning TEXT,
  plays_launched INTEGER DEFAULT 0,
  coins_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_analytics_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  scope TEXT,
  narrative TEXT,
  cached_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SOCIAL & DISPLAY
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shoutout_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  gif_url TEXT,
  likes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shoutout_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES shoutout_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scoreboard_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  theme_data JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- INTEGRATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL,
  credentials_encrypted TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  field_mappings JSONB DEFAULT '{}',
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- MARCH MADNESS
-- =============================================================================

CREATE TABLE IF NOT EXISTS bracket_tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  kpi_definition_id UUID REFERENCES kpi_definitions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bracket_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES bracket_tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  seed INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bracket_matchups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES bracket_tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  position INTEGER NOT NULL,
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  player1_score NUMERIC DEFAULT 0,
  player2_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bracket_prediction_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES bracket_tournaments(id),
  user_id UUID NOT NULL REFERENCES users(id),
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_wheel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_wheel_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_wheel_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_wheel_spin_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE wheel_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_lead_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_lead_budget_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_lead_budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_team_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_rep_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_reward_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_reward_pending_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_reward_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_reward_pending_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_lead_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoutout_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoutout_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoreboard_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_prediction_scores ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- REALTIME PUBLICATION
-- =============================================================================
-- Enable realtime for tables the frontend subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE battles;
ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE power_wheel_events;
ALTER PUBLICATION supabase_realtime ADD TABLE power_wheel_spin_results;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE spin_history;
ALTER PUBLICATION supabase_realtime ADD TABLE reward_redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_feed;

-- Set REPLICA IDENTITY FULL on tables needing full row data in realtime
ALTER TABLE challenges REPLICA IDENTITY FULL;
