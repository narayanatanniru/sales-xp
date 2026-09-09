import { supabase } from './supabase';

/**
 * Central API client for the Sales XP edge function backend.
 *
 * All requests go through apiRequest(), which:
 * - Adds Authorization: Bearer <session JWT> (falls back to anon key)
 * - Adds X-Visiting-Organization-Id for super-admin view-as
 * - Targets the single edge function: /functions/v1/api-server
 */

const FUNCTION_NAME = 'api-server';

function getBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return `${url}/functions/v1/${FUNCTION_NAME}`;
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {} } = options;
  const baseUrl = getBaseUrl();

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Super-admin visiting another org
  const visitingOrgId = localStorage.getItem('superAdminVisitingOrg');
  if (visitingOrgId) {
    headers['X-Visiting-Organization-Id'] = visitingOrgId;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, errorData.message || response.statusText, errorData);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// --- Health ---
export const getHealth = () => apiRequest('/health');

// --- Auth & MFA ---
export const requestPasswordReset = (email: string) =>
  apiRequest('/auth/password-reset-request', { method: 'POST', body: { email } });

// --- Me / Org ---
export const getUserStats = () => apiRequest('/user/stats');
export const getCareerStats = () => apiRequest('/user/career-stats');
export const getLeaderboard = () => apiRequest('/leaderboard');
export const getActivityFeed = () => apiRequest('/activity-feed');
export const getOrgSettings = () => apiRequest('/organization/settings');

// --- Teams ---
export const getTeams = () => apiRequest('/teams');

// --- Challenges ---
export const getChallenges = () => apiRequest('/challenges');
export const joinChallenge = (challengeId: string) =>
  apiRequest('/challenge/join', { method: 'POST', body: { challenge_id: challengeId } });

// --- Battles ---
export const getBattles = () => apiRequest('/battles');

// --- Rewards ---
export const getRewards = () => apiRequest('/rewards');
export const redeemReward = (rewardId: string) =>
  apiRequest('/reward/redeem', { method: 'POST', body: { reward_id: rewardId } });

// --- Admin ---
export const getAdminUsers = () => apiRequest('/admin/users');
export const getVaultBalance = () => apiRequest('/payments/vault-balance');

// --- Chatbot (Agent E) ---
export const getChatbotSuggestions = () => apiRequest('/chatbot/suggestions');
export const getChatbotConversations = () => apiRequest('/chatbot/conversations');
