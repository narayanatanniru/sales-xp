/**
 * Branch-aware Supabase project resolver.
 *
 * At build time, determines which Supabase project (prod vs dev) the frontend
 * should target based on the current git branch:
 *   - main → production
 *   - anything else → development
 *
 * Override with VITE_SUPABASE_ENV=prod|dev in .env.local.
 *
 * IMPORTANT: A Vercel production build that resolves to non-prod will throw
 * and fail the build as a safety measure.
 */

import { execSync } from 'child_process';

// These are PUBLIC keys only — safe to commit.
// Replace with your own Supabase project values once provisioned.
const PROJECTS = {
  prod: {
    ref: 'decopeaekuaxidabejwe',
    url: 'https://decopeaekuaxidabejwe.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlY29wZWFla3VheGlkYWJlandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NzIzNTIsImV4cCI6MjEwNDU0ODM1Mn0.qV5Z7OFkJZI4dWiQZcgFrwD3-STn5PufyRqOYFyM8rM',
  },
  dev: {
    ref: 'decopeaekuaxidabejwe',
    url: 'https://decopeaekuaxidabejwe.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlY29wZWFla3VheGlkYWJlandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NzIzNTIsImV4cCI6MjEwNDU0ODM1Mn0.qV5Z7OFkJZI4dWiQZcgFrwD3-STn5PufyRqOYFyM8rM',
  },
};

export function resolveSupabaseTarget() {
  // Explicit override from environment
  const envOverride = process.env.VITE_SUPABASE_ENV;
  if (envOverride === 'prod' || envOverride === 'dev') {
    const project = PROJECTS[envOverride];
    return { env: envOverride, ...project };
  }

  // Detect git branch
  let branch = 'unknown';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    // Not a git repo or git not available — default to dev
  }

  const env = branch === 'main' ? 'prod' : 'dev';

  // Safety: Vercel production builds must not point at dev
  if (process.env.VERCEL_ENV === 'production' && env !== 'prod') {
    throw new Error(
      `FATAL: Vercel production build resolved to "${env}" (branch="${branch}"). ` +
      `Production builds must target the prod Supabase project. ` +
      `Set VITE_SUPABASE_ENV=prod or deploy from the main branch.`
    );
  }

  const project = PROJECTS[env];
  return { env, ...project };
}
