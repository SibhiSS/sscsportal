/**
 * Panel roles, mirrored from the database (public.admins.role, see
 * supabase/migrations/20261006000200_role_tiers.sql). The database enforces
 * every rule here through RLS; these helpers only decide what the UI shows.
 */
export type Role = 'super_admin' | 'board' | 'lead' | 'collaborator' | 'member';

/** Roles a super admin can hand out in Settings, most powerful first. */
export const PANEL_ROLES = ['super_admin', 'board', 'lead', 'collaborator'] as const;
export type PanelRole = typeof PANEL_ROLES[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super admin',
  board: 'Board',
  lead: 'Lead',
  collaborator: 'Collaborator',
  member: 'Member',
};

export const ROLE_HINT: Record<PanelRole, string> = {
  super_admin: 'Everything, including Settings, Venues, Website, Team and Broadcasts.',
  board: 'The club panel plus venue availability.',
  lead: 'The club panel, without venue availability.',
  collaborator: 'From another club: venue availability only, nothing about SSCS.',
};

export const isRole = (r: unknown): r is Role =>
  r === 'super_admin' || r === 'board' || r === 'lead' || r === 'collaborator' || r === 'member';

/** Super admins, board and leads: the full club panel. */
export const isCoreTeam = (r?: Role) => r === 'super_admin' || r === 'board' || r === 'lead';

/** Anyone who may open /admin at all. */
export const canOpenPanel = (r?: Role) => isCoreTeam(r) || r === 'collaborator';

/** Venue free/busy status: super admins, board and collaborators. Not leads. */
export const canSeeVenueStatus = (r?: Role) => r === 'super_admin' || r === 'board' || r === 'collaborator';
