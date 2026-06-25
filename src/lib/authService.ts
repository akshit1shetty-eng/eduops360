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

const SESSION_KEY = 'eduops_session';
const API_URL = 'http://localhost:5000/api';

// Subscriber system for auth state changes (same as before)
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
    const response = await fetch(`${API_URL}/profiles/${userId}`);
    if (!response.ok) {
      return { data: null, error: { message: 'Failed to fetch profile' } };
    }
    return (await response.json()) as { data: Profile | null; error: { message: string } | null };
  },

  /**
   * Retrieves all profiles from Express/SQLite API.
   */
  async getProfiles(): Promise<{ data: Profile[] | null; error: { message: string } | null }> {
    const response = await fetch(`${API_URL}/profiles`);
    if (!response.ok) {
      return { data: null, error: { message: 'Failed to fetch profiles' } };
    }
    return (await response.json()) as { data: Profile[] | null; error: { message: string } | null };
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
   * Fetches all roles.
   */
  async getRoles(): Promise<{ data: Role[] | null; error: { message: string } | null }> {
    const response = await fetch(`${API_URL}/roles`);
    if (!response.ok) {
      return { data: null, error: { message: 'Failed to fetch roles' } };
    }
    return (await response.json()) as { data: Role[] | null; error: { message: string } | null };
  },

  /**
   * Creates a custom role.
   */
  async createRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, permissions })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as { error?: { message: string } };
      return { success: false, error: errRes.error || { message: 'Failed to create role' } };
    }

    return (await response.json()) as { success: boolean };
  },

  /**
   * Updates a custom role.
   */
  async updateRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await fetch(`${API_URL}/roles/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, permissions })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as { error?: { message: string } };
      return { success: false, error: errRes.error || { message: 'Failed to update role' } };
    }

    return (await response.json()) as { success: boolean };
  },

  /**
   * Deletes a custom role.
   */
  async deleteRole(name: string): Promise<{ success: boolean; error?: { message: string } }> {
    const response = await fetch(`${API_URL}/roles/${name}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errRes = (await response.json()) as { error?: { message: string } };
      return { success: false, error: errRes.error || { message: 'Failed to delete role' } };
    }

    return (await response.json()) as { success: boolean };
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
   * Emulates Supabase's onAuthStateChange subscriber mechanism
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
