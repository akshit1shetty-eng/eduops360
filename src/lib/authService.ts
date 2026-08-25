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
const API_URL = 'http://localhost:5000/api';

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

export const authService = {
  /**
   * Generates a 6-digit OTP code for the email via Express/SQLite API.
   */
  async sendOtp(email: string): Promise<void> {
    const response = await fetch(`${API_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const errRes = (await response.json().catch(() => ({}))) as { error?: { message: string } };
      throw new Error(errRes.error?.message || 'Failed to send verification code');
    }
  },

  /**
   * Verifies the OTP code via Express/SQLite API and creates/loads session.
   */
  async verifyOtp(email: string, token: string): Promise<{ session: Session | null; error: { message: string } | null }> {
    const response = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token })
    });

    if (!response.ok) {
      return {
        session: null,
        error: { message: 'Failed to verify verification code' }
      };
    }

    const result = (await response.json()) as { session: Session | null; error: { message: string } | null };

    if (result.session && !result.error) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      notifyListeners(result.session);
    }

    return result;
  },

  /**
   * Retrieves the current session (cached in browser localStorage).
   */
  getCurrentSession(): Session | null {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as Session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  /**
   * Retrieves the profile associated with a user ID from Express/SQLite API.
   */
  async getProfile(userId: string): Promise<{ data: Profile | null; error: { message: string } | null }> {
    try {
      const response = await fetch(`${API_URL}/profiles/${userId}`);
      if (response.ok) {
        const result = (await response.json()) as { data: Profile | null; error: { message: string } | null };
        if (result.data) {
          result.data.permissions = getPermissionsForRole(result.data.role);
        }
        return result;
      }
    } catch (e) {
      console.warn('Profile fetch error', e);
    }
    return { data: null, error: { message: 'Failed to fetch profile' } };
  },

  /**
   * Retrieves all profiles from Express/SQLite API.
   */
  async getProfiles(): Promise<{ data: Profile[] | null; error: { message: string } | null }> {
    try {
      const response = await fetch(`${API_URL}/profiles`);
      if (response.ok) {
        const result = (await response.json()) as { data: Profile[] | null; error: { message: string } | null };
        if (result.data) {
          result.data = result.data.map(p => ({
            ...p,
            permissions: getPermissionsForRole(p.role)
          }));
        }
        return result;
      }
    } catch (e) {
      console.warn('Profiles fetch error', e);
    }
    return { data: null, error: { message: 'Failed to fetch profiles' } };
  },

  /**
   * Creates a user manually (Admin Action).
   */
  async createUser(email: string, fullName: string, role: string): Promise<{ success: boolean; data?: Profile; error?: { message: string } }> {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, role })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as { error?: { message: string } };
      return { success: false, error: errRes.error || { message: 'Failed to create user' } };
    }

    return (await response.json()) as { success: boolean; data: Profile };
  },

  /**
   * Updates user details (Admin Action).
   */
  async updateUser(id: string, email: string, fullName: string, role: string): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, role })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as { error?: { message: string } };
      return { success: false, error: errRes.error || { message: 'Failed to update user' } };
    }

    return (await response.json()) as { success: boolean };
  },

  /**
   * Deletes a user (Admin Action).
   */
  async deleteUser(id: string): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errRes = (await response.json()) as { error?: { message: string } };
      return { success: false, error: errRes.error || { message: 'Failed to delete user' } };
    }

    return (await response.json()) as { success: boolean };
  },

  /**
   * Bulk uploads users (Admin Action).
   */
  async bulkUploadUsers(usersList: { email: string; name: string; role: string }[]): Promise<{ success: boolean; count: number; errors: string[] }> {
    const response = await fetch(`${API_URL}/users/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: usersList })
    });

    if (!response.ok) {
      throw new Error('Failed to bulk upload users');
    }

    return (await response.json()) as { success: boolean; count: number; errors: string[] };
  },

  /**
   * Creates a new role.
   */
  async createRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const response = await fetch(`${API_URL}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, permissions })
      });
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
    } catch (e) {
      console.warn('createRole failed', e);
    }
    return { success: true };
  },

  /**
   * Updates an existing role.
   */
  async updateRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const response = await fetch(`${API_URL}/roles/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, permissions })
      });
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
    } catch (e) {
      console.warn('updateRole failed', e);
    }
    return { success: true };
  },

  /**
   * Deletes a role.
   */
  async deleteRole(name: string): Promise<{ success: boolean; error?: { message: string } }> {
    try {
      const response = await fetch(`${API_URL}/roles/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        return (await response.json()) as { success: boolean };
      }
    } catch (e) {
      console.warn('deleteRole failed', e);
    }
    return { success: true };
  },

  /**
   * Fetches all roles. Returns pre-coded system roles.
   */
  async getRoles(): Promise<{ data: Role[] | null; error: { message: string } | null }> {
    try {
      const response = await fetch(`${API_URL}/roles`);
      if (response.ok) {
        const res = (await response.json()) as { data: Role[] | null };
        if (res.data && res.data.length >= HARDCODED_SYSTEM_ROLES.length) {
          return { data: res.data, error: null };
        }
      }
    } catch (e) {
      console.warn('Backend fetch failed, returning pre-coded system roles');
    }
    return { data: HARDCODED_SYSTEM_ROLES, error: null };
  },

  /**
   * Signs out the user by clearing the session locally and remotely.
   */
  async signOut(): Promise<void> {
    try {
      await fetch(`${API_URL}/auth/sign-out`, { method: 'POST' });
    } catch (e) {
      console.warn('Sign out request failed', e);
    }
    localStorage.removeItem(SESSION_KEY);
    notifyListeners(null);
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
