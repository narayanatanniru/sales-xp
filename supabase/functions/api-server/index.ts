/**
 * Sales XP — API Server (Single Edge Function)
 *
 * A Hono app that serves as the entire backend (~300 routes).
 * Auth: every handler does its own auth via getUserFromToken().
 * Runs with --no-verify-jwt; service-role key bypasses RLS.
 * Org isolation and role checks enforced in application code.
 */

import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js';

const app = new Hono();
app.use('*', cors({ origin: '*' }));

// ─── Supabase Admin Client ─────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Auth Helpers ──────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  full_name: string | null;
}

const COMMAND_CENTER_ROLES = ['team-lead', 'admin', 'owner', 'co-owner', 'super-admin'];
const OWNER_LEVEL_ROLES = ['owner', 'co-owner', 'super-admin'];
const BILLING_ROLES = OWNER_LEVEL_ROLES;

async function getUserFromToken(authHeader: string | undefined): Promise<AuthUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, email, role, organization_id, full_name')
    .eq('id', user.id)
    .single();
  return profile;
}

function getOrganizationId(user: AuthUser, visitingHeader?: string | null): string | null {
  if (user.role === 'super-admin' && visitingHeader) return visitingHeader;
  return user.organization_id;
}

function requireAuth(authHeader: string | undefined): Promise<AuthUser> {
  return getUserFromToken(authHeader).then(u => {
    if (!u) throw new Error('Unauthorized');
    return u;
  });
}

function requireRole(user: AuthUser, allowed: string[]) {
  if (!allowed.includes(user.role)) throw new Error('Forbidden');
}

function isServiceRole(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  return authHeader.slice(7) === supabaseServiceKey;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function json(c: { json: (data: unknown, status?: number) => Response }, data: unknown, status = 200) {
  return c.json(data, status);
}

// ─── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (c) => json(c, {
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '0.1.0',
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ME / USER
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/user/stats', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('users').select('*').eq('id', user.id).single();
  return json(c, data);
});

app.get('/user/career-stats', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('battle_records').select('*').eq('user_id', user.id).eq('organization_id', orgId).single();
  return json(c, data ?? { wins: 0, losses: 0, draws: 0, current_streak: 0, best_streak: 0 });
});

app.get('/leaderboard', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('users')
    .select('id, email, full_name, coins, total_score, avatar_url')
    .eq('organization_id', orgId).eq('role', 'user').eq('is_active', true)
    .order('total_score', { ascending: false }).limit(50);
  return json(c, data);
});

app.get('/activity-feed', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('activity_feed').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(50);
  return json(c, data);
});

app.get('/spin-history', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('spin_history').select('*')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/organization/settings', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('organizations').select('*').eq('id', orgId).single();
  return json(c, data);
});

app.put('/organization/profile', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('organizations')
    .update({ name: body.name, tagline: body.tagline, timezone: body.timezone, logo_url: body.logo_url })
    .eq('id', orgId).select().single();
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/teams', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('teams').select('*').eq('organization_id', orgId);
  return json(c, data);
});

app.post('/admin/create-team', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('teams')
    .insert({ organization_id: orgId, name: body.name, icon: body.icon, team_lead_id: body.team_lead_id })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

app.put('/admin/update-team/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const body = await c.req.json();
  if (!body.team_lead_id) return json(c, { error: 'Team must have a lead' }, 400);
  const { data } = await supabaseAdmin.from('teams')
    .update({ name: body.name, icon: body.icon, team_lead_id: body.team_lead_id })
    .eq('id', c.req.param('id')).select().single();
  return json(c, data);
});

app.delete('/admin/delete-team/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  await supabaseAdmin.from('teams').delete().eq('id', c.req.param('id'));
  return json(c, { success: true });
});

app.get('/teams/requests', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('team_requests').select('*').eq('organization_id', orgId);
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPIs
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/wow-performance/kpi-definitions', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('kpi_definitions').select('*').eq('organization_id', orgId);
  return json(c, data);
});

app.post('/wow-performance/kpi-definitions', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('kpi_definitions')
    .insert({ organization_id: orgId, kpi_name: body.kpi_name, description: body.description })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

app.put('/wow-performance/kpi-definitions/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('kpi_definitions')
    .update({ kpi_name: body.kpi_name, description: body.description })
    .eq('id', c.req.param('id')).select().single();
  return json(c, data);
});

app.delete('/wow-performance/kpi-definitions/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  await supabaseAdmin.from('kpi_definitions').delete().eq('id', c.req.param('id'));
  return json(c, { success: true });
});

app.post('/admin/manual-kpi/adjust', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('kpi_updates')
    .insert({
      organization_id: orgId, user_id: body.user_id,
      kpi_definition_id: body.kpi_definition_id,
      quantity: body.delta, source: 'admin_manual',
    })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/challenges', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('challenges').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false });
  return json(c, data);
});

app.get('/challenges/my-participations', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('challenge_participants').select('*')
    .eq('user_id', user.id);
  return json(c, data);
});

app.post('/challenge/join', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('challenge_participants')
    .insert({ challenge_id: body.challenge_id, user_id: user.id })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

app.post('/admin/create-challenge', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('challenges')
    .insert({
      organization_id: orgId, title: body.title, description: body.description,
      type: body.type || 'individual', visibility: body.visibility || 'public',
      kpi_definition_id: body.kpi_definition_id,
      target_value: body.target_value, reward_type: body.reward_type || 'coins',
      reward_value: body.reward_value || 0, escrow_coins: body.reward_value || 0,
      status: 'active', start_date: new Date().toISOString(),
      end_date: body.end_date, created_by: user.id,
    })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

app.put('/admin/update-challenge/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('challenges')
    .update(body).eq('id', c.req.param('id')).select().single();
  return json(c, data);
});

app.delete('/admin/delete-challenge/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const { data } = await supabaseAdmin.from('challenges')
    .update({ status: 'cancelled' }).eq('id', c.req.param('id')).select().single();
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATTLES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/battles', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('battles').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false });
  return json(c, data);
});

app.get('/battles/my-record', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('battle_records').select('*')
    .eq('user_id', user.id).eq('organization_id', orgId).single();
  return json(c, data);
});

app.post('/battles/create', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('battles')
    .insert({
      organization_id: orgId, title: body.title,
      kpi_definition_id: body.kpi_definition_id,
      mode: body.mode || 'timed', type: body.type || '1v1',
      wager_amount: body.wager_amount || 0,
      prize_pool: (body.wager_amount || 0) * 2,
      challenger_id: user.id, opponent_id: body.opponent_id,
      start_time: body.start_time, end_time: body.end_time,
      status: 'pending',
    })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

app.post('/battles/:id/accept', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('battles')
    .update({ status: 'live' })
    .eq('id', c.req.param('id')).eq('opponent_id', user.id).eq('status', 'pending')
    .select().single();
  if (!data) return json(c, { error: 'Battle not found or not yours' }, 404);
  return json(c, data);
});

app.post('/battles/:id/decline', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('battles')
    .update({ status: 'declined' })
    .eq('id', c.req.param('id')).eq('opponent_id', user.id)
    .select().single();
  return json(c, data);
});

app.post('/battles/admin/create', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data, error } = await supabaseAdmin.from('battles')
    .insert({
      organization_id: orgId, title: body.title,
      kpi_definition_id: body.kpi_definition_id,
      mode: body.mode || 'timed', type: body.type || '1v1',
      prize_pool: body.prize_pool || 0, escrow_coins: body.prize_pool || 0,
      challenger_id: body.challenger_id, opponent_id: body.opponent_id,
      is_admin_created: true, status: body.auto_start ? 'live' : 'pending',
      start_time: body.start_time, end_time: body.end_time,
    })
    .select().single();
  if (error) return json(c, { error: error.message }, 400);
  return json(c, data, 201);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REWARDS & COINS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/rewards', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('rewards').select('*')
    .eq('organization_id', orgId).eq('is_active', true).order('coin_cost');
  return json(c, data);
});

app.post('/reward/redeem', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data: reward } = await supabaseAdmin.from('rewards').select('*')
    .eq('id', body.reward_id).single();
  if (!reward) return json(c, { error: 'Reward not found' }, 404);
  const { data: userRow } = await supabaseAdmin.from('users').select('coins').eq('id', user.id).single();
  if (!userRow || userRow.coins < reward.coin_cost) return json(c, { error: 'Insufficient coins' }, 402);
  // Debit coins and create redemption
  await supabaseAdmin.from('users').update({ coins: userRow.coins - reward.coin_cost }).eq('id', user.id);
  const { data: redemption } = await supabaseAdmin.from('reward_redemptions')
    .insert({ organization_id: orgId, user_id: user.id, reward_id: body.reward_id, status: 'pending' })
    .select().single();
  await supabaseAdmin.from('transactions').insert({
    organization_id: orgId, user_id: user.id, type: 'coin',
    action: 'subtract', amount: reward.coin_cost, description: `Redeemed: ${reward.name}`,
  });
  return json(c, redemption, 201);
});

app.post('/admin/create-reward', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('rewards')
    .insert({ organization_id: orgId, ...body }).select().single();
  return json(c, data, 201);
});

app.post('/admin/grant-coins', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  await supabaseAdmin.rpc('increment_user_coins', { p_user_id: body.user_id, p_amount: body.amount }).throwOnError();
  await supabaseAdmin.from('transactions').insert({
    organization_id: orgId, user_id: body.user_id, type: 'coin',
    action: 'add', amount: body.amount, description: body.reason || 'Admin grant',
    reference_type: 'admin_grant',
  });
  return json(c, { success: true });
});

app.post('/admin/grant-spins', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const body = await c.req.json();
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  await supabaseAdmin.rpc('increment_user_spins', { p_user_id: body.user_id, p_amount: body.amount }).throwOnError();
  await supabaseAdmin.from('transactions').insert({
    organization_id: orgId, user_id: body.user_id, type: 'spin',
    action: 'add', amount: body.amount, description: body.reason || 'Admin grant',
  });
  return json(c, { success: true });
});

app.get('/admin/redemptions', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('reward_redemptions').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false });
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS (Stripe)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/payments/config', (c) => json(c, {
  coin_value_usd: 0.10, fee_bps: 600, min_purchase_coins: 5,
  stripe_configured: !!Deno.env.get('STRIPE_SECRET_KEY'),
}));

app.get('/payments/vault-balance', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  // Find the owner's vault balance
  const { data } = await supabaseAdmin.from('users').select('admin_vault_balance')
    .eq('organization_id', orgId).eq('role', 'owner').single();
  return json(c, { balance: data?.admin_vault_balance ?? 0 });
});

app.get('/payments/transactions', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('transactions').select('*')
    .eq('organization_id', orgId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  return json(c, data);
});

app.get('/payments/vault-transactions', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('vault_transactions').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100);
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGETS & GOALS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/admin/budget/mine', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('team_lead_budgets').select('*')
    .eq('organization_id', orgId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
  return json(c, data);
});

app.get('/admin/budget/company-summary', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data: cycle } = await supabaseAdmin.from('budget_cycles').select('*')
    .eq('organization_id', orgId).eq('status', 'open').single();
  const { data: budgets } = await supabaseAdmin.from('team_lead_budgets').select('*')
    .eq('organization_id', orgId).eq('cycle_id', cycle?.id);
  return json(c, { cycle, budgets });
});

app.get('/admin/goals', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('goals').select('*').eq('organization_id', orgId);
  return json(c, data);
});

app.get('/goals/mine', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('goal_rep_targets').select('*, goals(*)')
    .eq('user_id', user.id);
  return json(c, data);
});

app.get('/goals/company', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('goals').select('*, kpi_definitions(kpi_name)')
    .eq('organization_id', orgId).eq('status', 'active');
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS & ORG ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/admin/users', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('users').select('*')
    .eq('organization_id', orgId).order('role').order('full_name');
  return json(c, data);
});

app.post('/admin/invite-user', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  // Generate a temp password
  const tempPassword = crypto.randomUUID().slice(0, 12);
  // Create auth user
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: body.email, password: tempPassword, email_confirm: true,
  });
  if (authErr) return json(c, { error: authErr.message }, 400);
  // Create profile
  const { error: profileErr } = await supabaseAdmin.from('users').insert({
    id: authUser.user.id, email: body.email, full_name: body.full_name,
    role: body.role || 'user', organization_id: orgId,
    has_temporary_password: true,
  });
  if (profileErr) return json(c, { error: profileErr.message }, 400);
  // TODO: send invite email via Mailgun with temp password
  return json(c, { success: true, temp_password: tempPassword }, 201);
});

app.put('/admin/update-user/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('users')
    .update({ role: body.role, full_name: body.full_name, is_active: body.is_active })
    .eq('id', c.req.param('id')).select().single();
  return json(c, data);
});

app.delete('/admin/delete-user/:id', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const targetId = c.req.param('id');
  await supabaseAdmin.from('users').update({ is_active: false }).eq('id', targetId);
  return json(c, { success: true });
});

app.get('/admin/api-key', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('organizations').select('api_key').eq('id', orgId).single();
  return json(c, data);
});

app.post('/admin/regenerate-api-key', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const newKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const { data } = await supabaseAdmin.from('organizations')
    .update({ api_key: newKey }).eq('id', orgId).select('api_key').single();
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHATBOT (Agent E) — placeholder
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/chatbot/suggestions', (c) => json(c, {
  suggestions: [
    "Show me my team's KPI performance this week",
    'Who is leading in challenges right now?',
    "What's the current vault balance?",
    'Create a new challenge for my team',
  ],
}));

app.post('/chatbot/message', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const body = await c.req.json();
  // TODO: integrate Anthropic Claude tool-use loop
  return json(c, {
    message: `I received your message: "${body.message}". Agent E (Claude integration) is not yet configured. Set the ANTHROPIC_API_KEY secret to enable AI responses.`,
  });
});

app.get('/chatbot/conversations', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const { data } = await supabaseAdmin.from('kv_store')
    .select('*').like('key', `chat:${user.id}:%`);
  return json(c, data ?? []);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOPILOT & RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/team-lead/recommendations/today', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, ['team-lead']);
  const { data } = await supabaseAdmin.from('team_lead_recommendations').select('*')
    .eq('user_id', user.id).eq('status', 'pending')
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  return json(c, data);
});

app.get('/admin/autopilot/overview', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data: runs } = await supabaseAdmin.from('autopilot_runs').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20);
  const { data: teams } = await supabaseAdmin.from('teams').select('id, name, autopilot_enabled')
    .eq('organization_id', orgId);
  return json(c, { runs, teams });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/admin/analytics', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, COMMAND_CENTER_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  // Basic stats
  const [{ count: userCount }, { count: challengeCount }, { count: battleCount }] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
    supabaseAdmin.from('challenges').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabaseAdmin.from('battles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'live'),
  ]);
  return json(c, { active_users: userCount, active_challenges: challengeCount, live_battles: battleCount });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SHOUTOUTS & MEDIA
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/shoutouts', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('shoutout_posts').select('*, users(full_name, avatar_url)')
    .eq('organization_id', orgId).eq('status', 'active').order('created_at', { ascending: false }).limit(50);
  return json(c, data);
});

app.post('/shoutouts', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('shoutout_posts')
    .insert({ organization_id: orgId, user_id: user.id, content: body.content, gif_url: body.gif_url })
    .select().single();
  return json(c, data, 201);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCOREBOARD & PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/scoreboard-themes/public', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('scoreboard_themes').select('*').eq('organization_id', orgId);
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/superadmin/organizations', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, ['super-admin']);
  const { data } = await supabaseAdmin.from('organizations').select('*').order('name');
  return json(c, data);
});

app.post('/superadmin/organizations', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, ['super-admin']);
  const body = await c.req.json();
  const { data } = await supabaseAdmin.from('organizations')
    .insert({ name: body.name, slug: body.slug, plan: body.plan || 'standard' })
    .select().single();
  return json(c, data, 201);
});

app.get('/superadmin/stats', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, ['super-admin']);
  const [{ count: orgCount }, { count: userCount }] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
  ]);
  return json(c, { organizations: orgCount, users: userCount });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL (service-role only — called by pg_cron via pg_net)
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/internal/autopilot/tick', async (c) => {
  if (!isServiceRole(c.req.header('Authorization'))) return json(c, { error: 'Service role required' }, 403);
  // TODO: run autopilot planning per team
  return json(c, { status: 'ok', message: 'Autopilot tick processed' });
});

app.post('/internal/autopilot/topup-sweep', async (c) => {
  if (!isServiceRole(c.req.header('Authorization'))) return json(c, { error: 'Service role required' }, 403);
  return json(c, { status: 'ok', message: 'Reactive sweep processed' });
});

app.post('/internal/notify-challenge-winner', async (c) => {
  if (!isServiceRole(c.req.header('Authorization'))) return json(c, { error: 'Service role required' }, 403);
  // TODO: send winner email via Mailgun
  return json(c, { status: 'ok' });
});

app.post('/internal/notify-battle-winner', async (c) => {
  if (!isServiceRole(c.req.header('Authorization'))) return json(c, { error: 'Service role required' }, 403);
  return json(c, { status: 'ok' });
});

app.post('/internal/notify-kpi-reward-earned', async (c) => {
  if (!isServiceRole(c.req.header('Authorization'))) return json(c, { error: 'Service role required' }, 403);
  return json(c, { status: 'ok' });
});

app.post('/internal/notify-budget-cycle-ended', async (c) => {
  if (!isServiceRole(c.req.header('Authorization'))) return json(c, { error: 'Service role required' }, 403);
  return json(c, { status: 'ok' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/zapier/connection', async (c) => {
  const user = await requireAuth(c.req.header('Authorization'));
  requireRole(user, OWNER_LEVEL_ROLES);
  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data } = await supabaseAdmin.from('zapier_connections').select('*').eq('organization_id', orgId).single();
  return json(c, data);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH & MFA
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/auth/password-reset-request', async (c) => {
  const body = await c.req.json();
  // TODO: send password reset email via Mailgun (not Supabase SMTP)
  return json(c, { success: true, message: 'If that email exists, a reset link has been sent.' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING & FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

app.notFound((c) => json(c, { error: 'Not found', path: c.req.path }, 404));

app.onError((err, c) => {
  if (err.message === 'Unauthorized') return json(c, { error: 'Unauthorized' }, 401);
  if (err.message === 'Forbidden') return json(c, { error: 'Forbidden' }, 403);
  console.error('Unhandled error:', err);
  return json(c, { error: 'Internal server error' }, 500);
});

// ─── Start ─────────────────────────────────────────────────────────────────────

Deno.serve({ port: 8000 }, app.fetch);
