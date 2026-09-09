/**
 * Role definitions and permission helpers.
 *
 * Six roles, constrained by users_role_check:
 *   user, team-lead, admin, owner, co-owner, super-admin
 */

export type Role = 'user' | 'team-lead' | 'admin' | 'owner' | 'co-owner' | 'super-admin';

export const ALL_ROLES: Role[] = ['user', 'team-lead', 'admin', 'owner', 'co-owner', 'super-admin'];

/** Roles that can access the Command Center (admin panel) */
export const COMMAND_CENTER_ROLES: Role[] = ['team-lead', 'admin', 'owner', 'co-owner', 'super-admin'];

/** Roles that can spend the org vault, manage budgets, billing */
export const OWNER_LEVEL_ROLES: Role[] = ['owner', 'co-owner', 'super-admin'];
export const BILLING_ROLES = OWNER_LEVEL_ROLES;

/** Roles that can grant owner/co-owner */
export const OWNERSHIP_ADMIN_ROLES: Role[] = ['owner', 'super-admin'];

/** Roles that cannot be acted on by a co-owner */
export const PROTECTED_ROLES: Role[] = ['owner', 'co-owner', 'super-admin'];

/** Leadership roles that browse player pages read-only (spectator mode) */
export const SPECTATOR_ROLES: Role[] = ['team-lead', 'admin', 'owner', 'co-owner'];

export function isCommandCenter(role: Role): boolean {
  return COMMAND_CENTER_ROLES.includes(role);
}

export function isOwnerLevel(role: Role): boolean {
  return OWNER_LEVEL_ROLES.includes(role);
}

export function canActOnUser(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'super-admin') return true;
  if (actorRole === 'owner') return true;
  if (actorRole === 'co-owner' && PROTECTED_ROLES.includes(targetRole)) return false;
  if (COMMAND_CENTER_ROLES.includes(actorRole)) return targetRole === 'user';
  return false;
}

/**
 * Role-aware balance display: which balance a given role sees in the header.
 * - owner/co-owner/admin/super-admin → org vault
 * - team-lead → their envelope
 * - user → personal coins
 */
export function roleBalanceType(role: Role): 'vault' | 'envelope' | 'coins' {
  if (['owner', 'co-owner', 'admin', 'super-admin'].includes(role)) return 'vault';
  if (role === 'team-lead') return 'envelope';
  return 'coins';
}
