import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Role = 'admin' | 'staff';
export type CurrentUser = { id: string; email: string; fullName: string; role: Role };

/**
 * Data Access Layer for authentication. Uses auth.getUser(), which validates
 * the JWT with Supabase Auth — never getSession() alone.
 * Returns null when signed out or when the profile is missing/inactive.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role };
}

/** For pages: redirect to login when not staff/admin. */
export async function requireStaffPage(next = '/staff/scan'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/staff/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdminPage(next = '/admin/dashboard'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/staff/login?next=${encodeURIComponent(next)}`);
  if (user.role !== 'admin') redirect('/staff/scan?denied=1');
  return user;
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Not signed in' : 'Forbidden');
  }
}

/** For Server Actions / Route Handlers: throw instead of redirecting. */
export async function assertStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401);
  return user;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401);
  if (user.role !== 'admin') throw new AuthError(403);
  return user;
}
