/**
 * Inbound KPI Webhook — separate edge function.
 *
 * Receives KPI events from external systems (Zapier, CRM, etc.)
 * via POST with header `api_key: <org key>`.
 *
 * Body: { kpi_name, quantity, earnie_user_email, source?, metadata? }
 *
 * This is what Zapier Zaps hit; source defaults to 'zapier'.
 */

import { createClient } from 'jsr:@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = req.headers.get('api_key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing api_key header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up the org by API key
  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('api_key', apiKey)
    .single();

  if (orgErr || !org) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { kpi_name, quantity, earnie_user_email, source, metadata } = body;

  if (!kpi_name || !quantity || !earnie_user_email) {
    return new Response(JSON.stringify({ error: 'Missing required fields: kpi_name, quantity, earnie_user_email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up the user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', earnie_user_email)
    .eq('organization_id', org.id)
    .single();

  if (!user) {
    return new Response(JSON.stringify({ error: `User not found: ${earnie_user_email}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up the KPI definition
  const { data: kpiDef } = await supabaseAdmin
    .from('kpi_definitions')
    .select('id')
    .eq('kpi_name', kpi_name)
    .eq('organization_id', org.id)
    .single();

  if (!kpiDef) {
    return new Response(JSON.stringify({ error: `KPI not found: ${kpi_name}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Insert the KPI update — triggers will handle challenge/battle progress,
  // KPI rewards, goal rewards, and activity feed entries.
  const { data: update, error: insertErr } = await supabaseAdmin
    .from('kpi_updates')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      kpi_definition_id: kpiDef.id,
      quantity: Number(quantity),
      source: source || 'zapier',
      metadata: metadata || {},
    })
    .select()
    .single();

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, kpi_update_id: update.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
});
