/**
 * Sales XP — API Server (Single Edge Function)
 *
 * A Hono app that serves as the entire backend.
 * All routes are under this one function; sub-modules are imported for
 * domain-specific handlers (payments, tango, zapier, auth-mfa, email, etc.).
 *
 * Auth: every handler does its own auth via getUserFromToken().
 * The function runs with --no-verify-jwt; service-role key is used for
 * DB access, so RLS is bypassed. Org isolation and role checks are
 * enforced in application code.
 *
 * Deploy: supabase functions deploy api-server --no-verify-jwt
 * Local:  deno run --allow-all --node-modules-dir=auto --env-file=.env.edge index.ts
 */

import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient } from 'jsr:@supabase/supabase-js';

const app = new Hono();

// --- Middleware ---
app.use('*', cors({ origin: '*' }));

// Supabase service-role client (bypasses RLS)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Auth helpers ---

interface AuthUser {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
}

async function getUserFromToken(authHeader: string | undefined): Promise<AuthUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, email, role, organization_id')
    .eq('id', user.id)
    .single();

  return profile;
}

function getOrganizationId(user: AuthUser, visitingOrgHeader?: string | null): string | null {
  if (user.role === 'super-admin' && visitingOrgHeader) {
    return visitingOrgHeader;
  }
  return user.organization_id;
}

// --- Routes ---

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
  });
});

// --- Me / User ---
app.get('/user/stats', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('coins, available_spins, total_score')
    .eq('id', user.id)
    .eq('organization_id', orgId)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Leaderboard ---
app.get('/leaderboard', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, coins, total_score, avatar_url')
    .eq('organization_id', orgId)
    .eq('role', 'user')
    .eq('is_active', true)
    .order('total_score', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Activity Feed ---
app.get('/activity-feed', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('activity_feed')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Organization ---
app.get('/organization/settings', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Teams ---
app.get('/teams', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('organization_id', orgId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Challenges ---
app.get('/challenges', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('challenges')
    .select('*')
    .eq('organization_id', orgId)
    .in('status', ['active', 'scheduled'])
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Battles ---
app.get('/battles', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('battles')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Rewards ---
app.get('/rewards', async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = getOrganizationId(user, c.req.header('X-Visiting-Organization-Id'));
  const { data, error } = await supabaseAdmin
    .from('rewards')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('coin_cost', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// --- Payments placeholder ---
app.get('/payments/config', (c) => {
  return c.json({
    coin_value_usd: 0.10,
    fee_bps: 600,
    min_purchase_coins: 5,
    stripe_configured: !!Deno.env.get('STRIPE_SECRET_KEY'),
  });
});

// --- Chatbot (Agent E) placeholder ---
app.get('/chatbot/suggestions', (c) => {
  return c.json({
    suggestions: [
      'Show me my team\'s KPI performance this week',
      'Who is leading in challenges right now?',
      'What\'s the current vault balance?',
      'Create a new challenge for my team',
    ],
  });
});

// --- Internal routes (service-role only, called by pg_cron via pg_net) ---
app.post('/internal/autopilot/tick', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth?.includes(supabaseServiceKey)) {
    return c.json({ error: 'Service role required' }, 403);
  }
  // Autopilot daily planning — placeholder
  return c.json({ status: 'ok', message: 'Autopilot tick processed' });
});

// --- Fallback ---
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// --- Start server ---
Deno.serve({ port: 8000 }, app.fetch);
