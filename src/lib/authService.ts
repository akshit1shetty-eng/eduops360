export type UserRole = string;

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
  permissions?: string[];
}

export interface Session {
  access_token?: string;
  expires_at?: number;
  user: {
    id: string;
    email: string;
  };
}

export interface Role {
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
}

export const HARDCODED_SYSTEM_ROLES: Role[] = [
  {
    name: 'super admin',
    description: 'Super Administrator with full access to all panels and dashboards',
    permissions: [
      'page_home', 'page_learners', 'page_program_dash',
      'page_live_sessions', 'page_immersion', 'page_dissertation',
      'page_academic_perf', 'page_admin', 'action_edit_users', 'action_edit_budgets', 'uni_all'
    ],
    is_system: true,
  },
  {
    name: 'admin',
    description: 'Administrator with full access except Admin Panel and user editing',
    permissions: [
      'page_home', 'page_learners', 'page_program_dash',
      'page_live_sessions', 'page_immersion', 'page_dissertation',
      'page_academic_perf', 'action_edit_budgets', 'uni_all'
    ],
    is_system: true,
  },
  {
    name: 'ggu viewer',
    description: 'Golden Gate University Viewer (Restricted to Golden Gate University details only)',
    permissions: ['page_home', 'page_learners', 'uni_ggu'],
    is_system: true,
  },
  {
    name: 'psb viewer',
    description: 'Paris School of Business Viewer (Restricted to Paris School of Business details only)',
    permissions: ['page_home', 'page_learners', 'uni_psb'],
    is_system: true,
  },
  {
    name: 'edgewood viewer',
    description: 'Edgewood University Viewer (Restricted to Edgewood University details only)',
    permissions: ['page_home', 'page_learners', 'uni_edgewood'],
    is_system: true,
  },
  {
    name: 'esgci viewer',
    description: 'ESGCI Viewer (Restricted to ESGCI details only)',
    permissions: ['page_home', 'page_learners', 'uni_esgci'],
    is_system: true,
  },
];

export function getPermissionsForRole(roleName: string): string[] {
  const norm = (roleName || '').toLowerCase().trim();
  const found = HARDCODED_SYSTEM_ROLES.find(r => r.name.toLowerCase() === norm);
  if (found) return found.permissions;
  if (norm.includes('ggu')) return ['page_home', 'page_learners', 'uni_ggu'];
  if (norm.includes('psb')) return ['page_home', 'page_learners', 'uni_psb'];
  if (norm.includes('edgewood')) return ['page_home', 'page_learners', 'uni_edgewood'];
  if (norm.includes('esgci')) return ['page_home', 'page_learners', 'uni_esgci'];
  if (norm.includes('super admin')) return HARDCODED_SYSTEM_ROLES[0].permissions;
  if (norm.includes('admin')) return HARDCODED_SYSTEM_ROLES[1].permissions;
  return ['page_home', 'page_learners', 'uni_all'];
}

const SESSION_KEY = 'eduops_session';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    return '/api';
  }
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

// Subscriber system for auth state changes
type AuthListener = (session: Session | null) => void;
const listeners = new Set<AuthListener>();

function notifyListeners(session: Session | null) {
  listeners.forEach(l => {
    try {
      l(session);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

function readStoredSession(): Session | null {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// Clears a session the server no longer accepts (expired, revoked, or from before server-issued tokens)
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  notifyListeners(null);
}

// Authenticated fetch: attaches the session token and signs out on 401
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readStoredSession()?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401) clearSession();
  return response;
}

async function readError(response: Response, fallback: string): Promise<{ message: string }> {
  const errRes = (await response.json().catch(() => ({}))) as { error?: { message?: string } | string };
  const msg = typeof errRes.error === 'string' ? errRes.error : errRes.error?.message;
  return { message: msg || fallback };
}

export const authService = {
  /**
   * Generates a 6-digit OTP code for the email via the Express/Turso API.
   */
  async sendOtp(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized })
      });
    } catch {
      throw new Error('Unable to reach the server. Please check your connection and try again.');
    }

    if (!response.ok) {
      throw new Error((await readError(response, 'Failed to send verification code')).message);
    }
  },

  /**
   * Verifies the OTP code via the Express/Turso API and stores the server-issued session token.
   */
  async verifyOtp(email: string, token: string): Promise<{ session: Session | null; error: { message: string } | null }> {
    const normalized = email.trim().toLowerCase();
    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, token })
      });

      if (response.ok) {
        const result = (await response.json()) as { session: Session | null; error: { message: string } | null };
        if (result.session && !result.error) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
          notifyListeners(result.session);
        }
        return result;
      }
    } catch (e) {
      console.warn('Backend verify-otp fetch failed:', e);
    }

    return {
      session: null,
      error: { message: 'Unable to verify the code right now. Please try again.' }
    };
  },

  /**
   * Retrieves the current session (cached in browser localStorage).
   * Sessions without a server-issued token are discarded.
   */
  getCurrentSession(): Session | null {
    const session = readStoredSession();
    if (session && (!session.access_token || (session.expires_at && session.expires_at < Date.now()))) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  },

  /**
   * Retrieves the signed-in user's profile; permissions come from the server.
   */
  async getProfile(userId: string): Promise<{ data: Profile | null; error: { message: string } | null }> {
    try {
      const response = await apiFetch(`/profiles/${encodeURIComponent(userId)}`);
      if (response.ok) {
        return (await response.json()) as { data: Profile | null; error: { message: string } | null };
      }
      return { data: null, error: await readError(response, 'Failed to fetch profile') };
    } catch (e) {
      console.warn('Profile fetch error:', e);
      return { data: null, error: { message: 'Failed to fetch profile' } };
    }
  },

  /**
   * Retrieves all profiles (Admin Action).
   */
  async getProfiles(): Promise<{ data: Profile[] | null; error: { message: string } | null }> {
    try {
      const response = await apiFetch('/profiles');
      if (response.ok) {
        return (await response.json()) as { data: Profile[] | null; error: { message: string } | null };
      }
      return { data: null, error: await readError(response, 'Failed to fetch users') };
    } catch (e) {
      console.warn('Profiles fetch error:', e);
      return { data: null, error: { message: 'Failed to fetch users' } };
    }
  },

  /**
   * Creates a user manually (Admin Action).
   */
  async createUser(email: string, fullName: string, role: string): Promise<{ success: boolean; data?: Profile; error?: { message: string } }> {
    const response = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ email, full_name: fullName, role })
    });

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Failed to create user') };
    }

    return (await response.json()) as { success: boolean; data: Profile };
  },

  /**
   * Updates user details (Admin Action).
   */
  async updateUser(id: string, email: string, fullName: string, role: string): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await apiFetch(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ email, full_name: fullName, role })
    });

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Failed to update user') };
    }

    return (await response.json()) as { success: boolean };
  },

  /**
   * Deletes a user (Admin Action).
   */
  async deleteUser(id: string): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await apiFetch(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Failed to delete user') };
    }

    return (await response.json()) as { success: boolean };
  },

  /**
   * Deletes several users at once (Admin Action). The signed-in admin is never deleted.
   */
  async bulkDeleteUsers(ids: string[]): Promise<{ success: boolean; count?: number; error?: { message: string } }> {
    const response = await apiFetch('/users/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      return { success: false, error: await readError(response, 'Failed to delete users') };
    }

    return (await response.json()) as { success: boolean; count: number };
  },

  /**
   * Bulk uploads users (Admin Action).
   */
  async bulkUploadUsers(usersList: { email: string; name: string; role: string }[]): Promise<{ success: boolean; count: number; errors: string[] }> {
    const response = await apiFetch('/users/bulk-upload', {
      method: 'POST',
      body: JSON.stringify({ users: usersList })
    });

    if (!response.ok) {
      throw new Error((await readError(response, 'Failed to bulk upload users')).message);
    }

    return (await response.json()) as { success: boolean; count: number; errors: string[] };
  },

  /**
   * Creates a new role (Admin Action).
   */
  async createRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const response = await apiFetch('/roles', {
        method: 'POST',
        body: JSON.stringify({ name, description, permissions })
      });
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
      return { success: false, error: await readError(response, 'Failed to create role') };
    } catch (e) {
      console.warn('createRole failed', e);
      return { success: false, error: { message: 'Failed to create role' } };
    }
  },

  /**
   * Updates an existing role (Admin Action).
   */
  async updateRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const response = await apiFetch(`/roles/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description, permissions })
      });
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
      return { success: false, error: await readError(response, 'Failed to update role') };
    } catch (e) {
      console.warn('updateRole failed', e);
      return { success: false, error: { message: 'Failed to update role' } };
    }
  },

  /**
   * Deletes a role (Admin Action).
   */
  async deleteRole(name: string): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const response = await apiFetch(`/roles/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
      return { success: false, error: await readError(response, 'Failed to delete role') };
    } catch (e) {
      console.warn('deleteRole failed', e);
      return { success: false, error: { message: 'Failed to delete role' } };
    }
  },

  /**
   * Fetches all roles. Falls back to the pre-coded system roles if the server is unreachable.
   */
  async getRoles(): Promise<{ data: Role[] | null; error: { message: string } | null }> {
    try {
      const response = await apiFetch('/roles');
      if (response.ok) {
        const res = (await response.json()) as { data: Role[] | null };
        if (res.data && res.data.length >= HARDCODED_SYSTEM_ROLES.length) {
          return { data: res.data, error: null };
        }
      }
    } catch {
      console.warn('Backend fetch failed, returning pre-coded system roles');
    }
    return { data: HARDCODED_SYSTEM_ROLES, error: null };
  },

  /**
   * Signs out the user by revoking the session on the server and clearing it locally.
   */
  async signOut(): Promise<void> {
    try {
      await apiFetch('/auth/sign-out', { method: 'POST' });
    } catch (e) {
      console.warn('Sign out request failed', e);
    }
    clearSession();
  },

  /**
   * Emulates subscriber mechanism
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const wrapper = (session: Session | null) => callback('SIGNED_IN', session);
    listeners.add(wrapper);
    return {
      data: {
        subscription: {
          unsubscribe() {
            listeners.delete(wrapper);
          }
        }
      }
    };
  }
};
