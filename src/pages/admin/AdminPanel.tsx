import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, HARDCODED_SYSTEM_ROLES } from '../../lib/authService';
import { useAuth } from '../../hooks/useAuth';
import type { Profile, Role } from '../../lib/authService';
import { UNIVERSITIES } from '../../lib/universities';

const PAGES_PERMISSIONS = [
  { key: 'page_home', name: 'Dashboard Home', desc: 'Allows viewing /lex/home' },
  { key: 'page_learners', name: 'Learners Directory', desc: 'Allows viewing global learner profiles' },
  { key: 'page_budget', name: 'Financial Budgets', desc: 'Allows viewing cohort/program budgets' },
  { key: 'page_admin', name: 'Admin Panel Console', desc: 'Enables entering this Admin Panel' },
  { key: 'action_edit_users', name: 'Edit Users', desc: 'Allows user creation and deletion' },
  { key: 'action_edit_budgets', name: 'Edit Budgets', desc: 'Allows modifying financial budgets' },
  { key: 'page_program_dash', name: 'Program Dashboard', desc: 'Allows program sub-dashboards' },
  { key: 'page_live_sessions', name: 'Live Sessions', desc: 'Allows live session details' },
  { key: 'page_immersion', name: 'Immersion', desc: 'Allows immersion details' },
  { key: 'page_dissertation', name: 'Dissertation', desc: 'Allows dissertation tracking' },
  { key: 'page_academic_perf', name: 'Academic Performance', desc: 'Allows academic performance' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { profile: adminProfile, signOut } = useAuth();

  // Tab State: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [collapsed, setCollapsed] = useState(false);

  // Database lists
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');

  // Modals visibility
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);

  // Custom Role Form State
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [editingRoleName, setEditingRoleName] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  // User Form State
  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState('super admin');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Bulk Upload State
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<{ email: string; name: string; role: string; error?: string }[]>([]);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkInputEmail, setBulkInputEmail] = useState('');
  const [bulkInputName, setBulkInputName] = useState('');
  const [bulkInputRole, setBulkInputRole] = useState('super admin');

  // Fetch everything
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        authService.getProfiles(),
        authService.getRoles()
      ]);

      if (profilesRes.error) throw new Error(profilesRes.error.message);
      if (rolesRes.error) throw new Error(rolesRes.error.message);

      setProfiles(profilesRes.data || []);
      const loadedRoles = rolesRes.data && rolesRes.data.length >= HARDCODED_SYSTEM_ROLES.length ? rolesRes.data : HARDCODED_SYSTEM_ROLES;
      setRoles(loadedRoles);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch database information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  // ─── User Actions ────────────────────────────────────────────────────────────

  const openAddUser = () => {
    setFormEmail('');
    setFormFullName('');
    setFormRole(roles[0]?.name || 'super admin');
    setShowAddUserModal(true);
  };

  const submitAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formRole) return;

    setLoading(true);
    const res = await authService.createUser(formEmail, formFullName, formRole);
    setLoading(false);

    if (!res.success) {
      triggerToast(`❌ ${res.error?.message || 'Failed to add user'}`);
      return;
    }

    triggerToast('✅ User created successfully!');
    setShowAddUserModal(false);
    void loadData();
  };

  const openEditUser = (u: Profile) => {
    setSelectedUserId(u.id);
    setFormEmail(u.email);
    setFormFullName(u.full_name || '');
    setFormRole(u.role);
    setShowEditUserModal(true);
  };

  const submitEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !formEmail.trim() || !formRole) return;

    setLoading(true);
    const res = await authService.updateUser(selectedUserId, formEmail, formFullName, formRole);
    setLoading(false);

    if (!res.success) {
      triggerToast(`❌ ${res.error?.message || 'Failed to update user'}`);
      return;
    }

    triggerToast('✅ User details updated!');
    setShowEditUserModal(false);
    void loadData();
  };

  const openDeleteUser = (u: Profile) => {
    setSelectedUserId(u.id);
    setFormEmail(u.email);
    setShowDeleteUserModal(true);
  };

  const submitDeleteUser = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    const res = await authService.deleteUser(selectedUserId);
    setLoading(false);

    if (!res.success) {
      triggerToast(`❌ ${res.error?.message || 'Failed to delete user'}`);
      return;
    }

    triggerToast('🗑️ User account deleted.');
    setShowDeleteUserModal(false);
    void loadData();
  };

  // ─── CSV Bulk Upload Actions ─────────────────────────────────────────────────

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseAndPreviewCsv(text);
    };
    reader.readAsText(file);
  };

  const parseAndPreviewCsv = (text: string) => {
    const lines = text.split('\n');
    if (lines.length <= 1) {
      setCsvPreview([]);
      return;
    }

    // Headers check
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIndex = headers.indexOf('email');
    const nameIndex = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('full_name');
    const roleIndex = headers.indexOf('role');

    if (emailIndex === -1) {
      triggerToast('❌ Invalid CSV format. Must contain "email" header.');
      return;
    }

    const previewRows: typeof csvPreview = [];
    const availableRoleNames = roles.map(r => r.name);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',').map(c => c.trim());
      const email = columns[emailIndex] || '';
      const name = nameIndex !== -1 ? columns[nameIndex] : '';
      let role = roleIndex !== -1 ? columns[roleIndex] : 'user';
      role = role.toLowerCase();

      let rowErr = '';
      if (!email) {
        rowErr = 'Email missing';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowErr = 'Invalid email format';
      } else if (role && !availableRoleNames.includes(role)) {
        rowErr = `Role '${role}' not defined (defaults to 'user')`;
      }

      previewRows.push({
        email,
        name: name || email.split('@')[0],
        role: availableRoleNames.includes(role) ? role : 'user',
        error: rowErr || undefined
      });
    }

    setCsvPreview(previewRows);
  };

  const handleAddManualUser = () => {
    const email = bulkInputEmail.trim().toLowerCase();
    if (!email) {
      triggerToast('❌ Email is required');
      return;
    }

    const name = bulkInputName.trim() || email.split('@')[0];
    const role = bulkInputRole.trim().toLowerCase();

    let rowErr = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErr = 'Invalid email format';
    } else if (csvPreview.some(p => p.email === email)) {
      rowErr = 'Duplicate email in preview';
    }

    const newRow = {
      email,
      name,
      role,
      error: rowErr || undefined
    };

    setCsvPreview(prev => [...prev, newRow]);
    setBulkInputEmail('');
    setBulkInputName('');
    triggerToast('➕ User added to preview');
  };

  const submitBulkUpload = async () => {
    if (csvPreview.length === 0) return;
    const cleanUsers = csvPreview.filter(p => !p.error || p.error.includes('defaults to'));

    if (cleanUsers.length === 0) {
      triggerToast('❌ All CSV rows have critical errors!');
      return;
    }

    setUploadProcessing(true);
    try {
      const res = await authService.bulkUploadUsers(cleanUsers);
      setUploadProcessing(false);
      triggerToast(`📦 Uploaded ${res.count} users successfully!`);
      if (res.errors.length > 0) {
        console.warn('Bulk upload warnings:', res.errors);
      }
      setShowBulkUploadModal(false);
      setCsvText('');
      setCsvPreview([]);
      void loadData();
    } catch {
      setUploadProcessing(false);
      triggerToast('❌ Bulk upload failed!');
    }
  };

  // ─── Role Actions ────────────────────────────────────────────────────────────

  const openCreateRole = () => {
    setRoleName('');
    setRoleDescription('');
    setSelectedPerms([]);
    setEditingRoleName(null);
    setShowCreateRoleModal(true);
  };

  const openEditRole = (r: Role) => {
    setRoleName(r.name);
    setRoleDescription(r.description || '');
    setSelectedPerms(r.permissions);
    setEditingRoleName(r.name);
    setShowCreateRoleModal(true);
  };

  const togglePermission = (permKey: string) => {
    setSelectedPerms(prev =>
      prev.includes(permKey) ? prev.filter(k => k !== permKey) : [...prev, permKey]
    );
  };

  const toggleUniversityContext = (uniId: string, programs: { id: string }[]) => {
    const uniKey = `uni_${uniId}`;
    const hasUni = selectedPerms.includes(uniKey);

    if (hasUni) {
      setSelectedPerms(prev => {
        let next = prev.filter(k => k !== uniKey);
        programs.forEach(p => {
          next = next.filter(k => k !== `prog_${p.id}`);
        });
        return next;
      });
    } else {
      setSelectedPerms(prev => {
        let next = [...prev, uniKey];
        programs.forEach(p => {
          next = next.filter(k => k !== `prog_${p.id}`);
        });
        return next;
      });
    }
  };

  const toggleProgramContext = (programId: string) => {
    const progKey = `prog_${programId}`;
    setSelectedPerms(prev =>
      prev.includes(progKey) ? prev.filter(k => k !== progKey) : [...prev, progKey]
    );
  };

  const submitCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = roleName.trim().toLowerCase();
    if (!trimmedName || selectedPerms.length === 0) {
      triggerToast('❌ Role name and at least one permission or restriction required.');
      return;
    }

    setLoading(true);
    let res;
    if (editingRoleName) {
      res = await authService.updateRole(editingRoleName, roleDescription, selectedPerms);
    } else {
      res = await authService.createRole(trimmedName, roleDescription, selectedPerms);
    }
    setLoading(false);

    if (!res.success) {
      triggerToast(`❌ ${res.error?.message || 'Failed to save role'}`);
      return;
    }

    triggerToast(editingRoleName ? `✨ Custom role '${trimmedName}' updated!` : `✨ Custom role '${trimmedName}' created!`);
    setShowCreateRoleModal(false);
    setEditingRoleName(null);
    void loadData();
  };

  const handleDeleteRole = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete role '${name}'? Users assigned to this role will automatically demote to 'user'.`)) return;

    setLoading(true);
    const res = await authService.deleteRole(name);
    setLoading(false);

    if (!res.success) {
      triggerToast(`❌ ${res.error?.message || 'Failed to delete role'}`);
      return;
    }

    triggerToast(`🗑️ Role '${name}' deleted.`);
    void loadData();
  };

  // ─── Rendering Filters ───────────────────────────────────────────────────────

  const filteredProfiles = profiles.filter(p =>
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsersCount = profiles.length;
  const adminUsersCount = profiles.filter(p => p.role === 'admin').length;
  const activeRolesCount = roles.length;

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={{
        ...styles.sidebar,
        width: collapsed ? 56 : 240,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{
          ...styles.sidebarLogo,
          padding: collapsed ? '24px 8px' : '24px 20px',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12, width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{
              ...styles.sidebarLogoIcon,
              width: collapsed ? 36 : 40,
              height: collapsed ? 36 : 40,
            }}>
              <i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: collapsed ? 18 : 22 }} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em' }}>EduOps360</div>
                <div style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Panel</div>
              </div>
            )}
          </div>
        </div>

        <nav style={{
          ...styles.sidebarNav,
          padding: collapsed ? '16px 8px' : '16px 12px',
        }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              ...(activeTab === 'users' ? styles.navItemActive : styles.navItem),
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            title={collapsed ? "Users" : undefined}
            className="sidebar-nav-item"
          >
            <i className="fas fa-users" style={{ fontSize: 14 }} />
            {!collapsed && <span>Users</span>}
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            style={{
              ...(activeTab === 'roles' ? styles.navItemActive : styles.navItem),
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            title={collapsed ? "Roles & Permissions" : undefined}
            className="sidebar-nav-item"
          >
            <i className="fas fa-user-shield" style={{ fontSize: 14 }} />
            {!collapsed && <span>Roles & Permissions</span>}
          </button>
          <button
            onClick={() => navigate('/lex/home')}
            style={{
              ...styles.navItem,
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            title={collapsed ? "Overall Dashboard" : undefined}
            className="sidebar-nav-item"
          >
            <i className="fas fa-chart-line" style={{ fontSize: 14 }} />
            {!collapsed && <span>Overall Dashboard</span>}
          </button>
        </nav>

        <div style={{
          ...styles.sidebarFooter,
          padding: collapsed ? '16px 8px' : '16px 12px',
        }}>
          {collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={styles.sidebarAvatar} title={adminProfile?.email || 'Admin'}>
                {adminProfile?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <button onClick={handleSignOut} style={styles.signOutBtn} className="sidebar-signout-btn sidebar-nav-item" title="Sign out">
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
              <div style={styles.sidebarUserInfo}>
                <div style={styles.sidebarAvatar}>
                  {adminProfile?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {adminProfile?.email || 'Admin'}
                  </div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Administrator</div>
                </div>
              </div>
              <button onClick={handleSignOut} style={styles.signOutBtn} className="sidebar-signout-btn sidebar-nav-item" title="Sign out">
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <div className="sidebar-footer" style={{ borderTop: 'none', padding: collapsed ? '10px 8px' : '10px 12px' }}>
          <button
            className="sidebar-collapse-btn sidebar-nav-item"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              ...styles.navItem,
              padding: collapsed ? '6px 0' : '6px 10px',
              fontSize: 11,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`} style={{ fontSize: 11 }} />
            {!collapsed && <span style={{ fontSize: 11 }}>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.headerTitle}>
              {activeTab === 'users' ? 'User Accounts' : 'Roles & Permissions'}
            </h1>
            <p style={styles.headerSub}>
              {activeTab === 'users'
                ? 'Create, edit, delete and bulk upload user accounts'
                : 'Configure access controls and define custom roles'
              }
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {activeTab === 'users' ? (
              <>
                <button onClick={() => {
                  setBulkInputEmail('');
                  setBulkInputName('');
                  setBulkInputRole(roles[0]?.name || 'user');
                  setCsvPreview([]);
                  setShowBulkUploadModal(true);
                }} style={styles.secondaryBtnAction}>
                  <i className="fas fa-file-upload" />
                  <span>Bulk Upload (CSV)</span>
                </button>
                <button onClick={openAddUser} style={styles.primaryBtnAction}>
                  <i className="fas fa-user-plus" />
                  <span>Add User</span>
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                <i className="fas fa-shield-alt text-indigo-500" />
                <span>Pre-coded System Roles</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statCardIcon, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              <i className="fas fa-users" />
            </div>
            <div>
              <div style={styles.statCardValue}>{totalUsersCount}</div>
              <div style={styles.statCardLabel}>Total Users</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statCardIcon, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
              <i className="fas fa-shield-alt" />
            </div>
            <div>
              <div style={styles.statCardValue}>{adminUsersCount}</div>
              <div style={styles.statCardLabel}>Admins</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statCardIcon, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
              <i className="fas fa-user-tag" />
            </div>
            <div>
              <div style={styles.statCardValue}>{activeRolesCount}</div>
              <div style={styles.statCardLabel}>Active Roles</div>
            </div>
          </div>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} />{error}
          </div>
        )}

        {/* ─── Render: Users Tab ──────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div style={styles.tableCard}>
            <div style={styles.tableHeader}>
              <div>
                <h2 style={styles.tableTitle}>All Users</h2>
                <p style={styles.tableSub}>{filteredProfiles.length} of {totalUsersCount} users</p>
              </div>
              <div style={styles.searchWrapper}>
                <i className="fas fa-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
                <input
                  type="text"
                  placeholder="Search by email, name or role…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHead}>
                    <th style={{ ...styles.th, width: '40%' }}>User</th>
                    <th style={{ ...styles.th, width: '20%' }}>Role</th>
                    <th style={{ ...styles.th, width: '25%' }}>Created At</th>
                    <th style={{ ...styles.th, width: '15%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} style={styles.td}>
                          <div style={{ height: 16, background: '#f1f5f9', borderRadius: 6, width: '100%', animation: 'pulse 1.5s infinite' }} />
                        </td>
                      </tr>
                    ))
                  ) : filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...styles.td, textAlign: 'center', padding: '40px 24px', color: '#94a3b8', fontWeight: 600 }}>
                        <i className="fas fa-search" style={{ fontSize: 24, marginBottom: 8, display: 'block', opacity: 0.4 }} />
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map(p => (
                      <tr key={p.id} style={styles.tableRow}>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 36, height: 36,
                              borderRadius: 10,
                              background: p.role === 'admin' ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: 900, fontSize: 14,
                            }}>
                              {p.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{p.full_name || p.email.split('@')[0]}</div>
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{p.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            background: p.role === 'admin' ? 'rgba(139,92,246,0.1)' : 'rgba(79,70,229,0.08)',
                            color: p.role === 'admin' ? '#7c3aed' : '#4f46e5',
                            border: `1px solid ${p.role === 'admin' ? 'rgba(139,92,246,0.2)' : 'rgba(79,70,229,0.15)'}`
                          }}>
                            <i className={`fas ${p.role === 'admin' ? 'fa-shield-alt' : 'fa-user'}`} style={{ fontSize: 9 }} />
                            {p.role}
                          </span>
                        </td>
                        <td style={{ ...styles.td, color: '#64748b', fontSize: 13, fontWeight: 600 }}>
                          {formatDate(p.created_at)}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => openEditUser(p)} style={styles.actionBtnEdit} title="Edit User">
                              <i className="fas fa-edit" />
                            </button>
                            {p.id !== adminProfile?.id ? (
                              <button onClick={() => openDeleteUser(p)} style={styles.actionBtnDelete} title="Delete User">
                                <i className="fas fa-trash-alt" />
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '0 8px' }}>You</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Render: Roles Tab ────────────────────────────────────────────────── */}
        {activeTab === 'roles' && (
          <div style={styles.tableCard}>
            <div style={styles.tableHeader}>
              <div>
                <h2 style={styles.tableTitle}>Roles & Permissions</h2>
                <p style={styles.tableSub}>Configure access controls and user groups</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHead}>
                    <th style={{ ...styles.th, width: '20%' }}>Role Name</th>
                    <th style={{ ...styles.th, width: '30%' }}>Description</th>
                    <th style={{ ...styles.th, width: '40%' }}>Assigned Permissions</th>
                    <th style={{ ...styles.th, width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} style={styles.td}>
                        <div style={{ height: 16, background: '#f1f5f9', borderRadius: 6, width: '100%', animation: 'pulse 1.5s infinite' }} />
                      </td>
                    </tr>
                  ) : (
                    roles.map(r => (
                      <tr key={r.name} style={styles.tableRow}>
                        <td style={{ ...styles.td, fontWeight: 800, textTransform: 'capitalize', color: '#0f172a' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {r.name}
                            {r.is_system && <span style={styles.sysRoleBadge}>System</span>}
                          </span>
                        </td>
                        <td style={{ ...styles.td, color: '#64748b', fontSize: 13 }}>{r.description || 'No description provided.'}</td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {r.permissions.map(perm => (
                              <span key={perm} style={styles.permBadge}>
                                {perm.replace('page_', 'Page: ').replace('action_', 'Action: ').replace('uni_', 'University: ').replace('prog_', 'Program: ').replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {!r.is_system ? (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => openEditRole(r)} style={styles.actionBtnEdit} title="Edit Role">
                                <i className="fas fa-edit" />
                              </button>
                              <button onClick={() => handleDeleteRole(r.name)} style={styles.actionBtnDelete} title="Delete Role">
                                <i className="fas fa-trash-alt" />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginRight: 8 }}><i className="fas fa-lock" /> Locked</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ─── Modal Dialog: Add User ─────────────────────────────────────────── */}
      {showAddUserModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add New User</h3>
              <button onClick={() => setShowAddUserModal(false)} style={styles.modalCloseBtn}><i className="fas fa-times" /></button>
            </div>
            <form onSubmit={submitAddUser} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Email address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="name@example.com"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Full Name (Optional)</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={e => setFormFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Assign Role</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                  style={styles.formSelect}
                >
                  {roles.map(r => (
                    <option key={r.name} value={r.name}>{r.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setShowAddUserModal(false)} style={styles.btnSecondary}>Cancel</button>
                <button type="submit" style={styles.btnPrimary}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Dialog: Edit User ────────────────────────────────────────── */}
      {showEditUserModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit User Profile</h3>
              <button onClick={() => setShowEditUserModal(false)} style={styles.modalCloseBtn}><i className="fas fa-times" /></button>
            </div>
            <form onSubmit={submitEditUser} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Email address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Full Name</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={e => setFormFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Role Assignment</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                  style={styles.formSelect}
                >
                  {roles.map(r => (
                    <option key={r.name} value={r.name}>{r.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setShowEditUserModal(false)} style={styles.btnSecondary}>Cancel</button>
                <button type="submit" style={styles.btnPrimary}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Dialog: Delete Confirmation ──────────────────────────────── */}
      {showDeleteUserModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: 400 }}>
            <div style={styles.modalHeader}>
              <h3 style={{ ...styles.modalTitle, color: '#ef4444' }}>Delete Account</h3>
              <button onClick={() => setShowDeleteUserModal(false)} style={styles.modalCloseBtn}><i className="fas fa-times" /></button>
            </div>
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <i className="fas fa-exclamation-triangle" style={{ color: '#ef4444', fontSize: 42, marginBottom: 16 }} />
              <p style={{ color: '#334155', fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Confirm deletion</p>
              <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete the account for <strong style={{ color: '#0f172a' }}>{formEmail}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowDeleteUserModal(false)} style={{ ...styles.btnSecondary, flex: 1 }}>Cancel</button>
                <button onClick={submitDeleteUser} style={{ ...styles.btnPrimary, background: '#ef4444', flex: 1 }}>Confirm Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Dialog: CSV Bulk Upload ──────────────────────────────────── */}
      {showBulkUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: 700 }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Bulk Upload Users (CSV)</h3>
              <button onClick={() => { setShowBulkUploadModal(false); setCsvPreview([]); }} style={styles.modalCloseBtn}><i className="fas fa-times" /></button>
            </div>
            <div style={styles.modalForm}>
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Prepare a CSV file containing at least an <strong>email</strong> column. You can also include <strong>name</strong> and <strong>role</strong> columns. Example:
                </p>
                <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 10, fontSize: 11, fontFamily: 'monospace', margin: 0, border: '1px solid #e2e8f0', color: '#475569' }}>
                  email,name,role{'\n'}
                  akash@upgrad.com,Akash Gupta,user{'\n'}
                  admin2@upgrad.com,Assistant Admin,admin
                </pre>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleCsvFileChange}
                  style={styles.fileInput}
                />
              </div>

              <div style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 16, padding: 16, background: '#f8fafc', marginBottom: 18 }}>
                <label style={{ ...styles.formLabel, marginBottom: 12 }}>Or Enter User Details Directly</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={bulkInputEmail}
                      onChange={e => setBulkInputEmail(e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={bulkInputName}
                      onChange={e => setBulkInputName(e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</label>
                    <select
                      value={bulkInputRole}
                      onChange={e => setBulkInputRole(e.target.value)}
                      style={styles.formSelect}
                    >
                      {roles.map(r => (
                        <option key={r.name} value={r.name}>{r.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualUser}
                    style={{
                      ...styles.btnPrimary,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <i className="fas fa-plus" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* CSV Parsing Preview */}
              {csvPreview.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={styles.formLabel}>Data Preview ({csvPreview.length} rows found)</label>
                  <div style={styles.previewTableWrapper}>
                    <table style={styles.previewTable}>
                      <thead>
                        <tr style={styles.tableHead}>
                          <th style={styles.previewTh}>Email</th>
                          <th style={styles.previewTh}>Name</th>
                          <th style={styles.previewTh}>Role</th>
                          <th style={styles.previewTh}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={styles.previewTd}>{row.email || <span style={{ color: '#ef4444' }}>Empty</span>}</td>
                            <td style={styles.previewTd}>{row.name}</td>
                            <td style={styles.previewTd}>{row.role}</td>
                            <td style={styles.previewTd}>
                              {row.error ? (
                                <span style={{ color: row.error.includes('defaults') ? '#eab308' : '#ef4444', fontSize: 11, fontWeight: 700 }}>
                                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />{row.error}
                                </span>
                              ) : (
                                <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                                  <i className="fas fa-check-circle" style={{ marginRight: 4 }} />Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => { setShowBulkUploadModal(false); setCsvPreview([]); }} style={styles.btnSecondary}>Cancel</button>
                <button
                  type="button"
                  onClick={submitBulkUpload}
                  disabled={csvPreview.length === 0 || uploadProcessing}
                  style={{ ...styles.btnPrimary, opacity: (csvPreview.length === 0 || uploadProcessing) ? 0.6 : 1 }}
                >
                  {uploadProcessing ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ─── Modal Dialog: Create Custom Role ─────────────────────────────────── */}
      {showCreateRoleModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: 850 }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingRoleName ? 'Edit Custom Role' : 'Create Custom Role'}</h3>
              <button onClick={() => setShowCreateRoleModal(false)} style={styles.modalCloseBtn}><i className="fas fa-times" /></button>
            </div>
            <form onSubmit={submitCreateRole} style={styles.modalForm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Left Column: General & Page Permissions */}
                <div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Role Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ggu support, marketing manager"
                      value={roleName}
                      onChange={e => setRoleName(e.target.value)}
                      disabled={!!editingRoleName}
                      style={{
                        ...styles.formInput,
                        ...(editingRoleName ? { background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {})
                      }}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Role Description</label>
                    <textarea
                      placeholder="Describe what access this role has..."
                      value={roleDescription}
                      onChange={e => setRoleDescription(e.target.value)}
                      rows={2}
                      style={{ ...styles.formInput, resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.formLabel}>Page & Action Permissions</label>
                    <div style={{
                      maxHeight: 280,
                      overflowY: 'auto',
                      border: '1px solid #cbd5e1',
                      borderRadius: 12,
                      padding: 12,
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      {PAGES_PERMISSIONS.map(perm => {
                        const isChecked = selectedPerms.includes(perm.key);
                        return (
                          <label key={perm.key} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: isChecked ? 'rgba(99,102,241,0.06)' : 'white',
                            border: `1px solid ${isChecked ? 'rgba(99,102,241,0.2)' : '#e2e8f0'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(perm.key)}
                              style={{ marginTop: 3 }}
                            />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isChecked ? '#4f46e5' : '#0f172a' }}>{perm.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{perm.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Universities & Program Isolation */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={styles.formLabel}>University & Program Access</label>
                  <div style={{
                    flex: 1,
                    maxHeight: 400,
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: 12,
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    {UNIVERSITIES.map(uni => {
                      const uniKey = `uni_${uni.id}`;
                      const hasUniAccess = selectedPerms.includes(uniKey);
                      return (
                        <div key={uni.id} style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: 12,
                          padding: 12
                        }}>
                          {/* University Header Checkbox */}
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            paddingBottom: 8,
                            borderBottom: '1px solid #f1f5f9',
                            marginBottom: 8
                          }}>
                            <input
                              type="checkbox"
                              checked={hasUniAccess}
                              onChange={() => toggleUniversityContext(uni.id, uni.programs)}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <i className="fas fa-university" style={{ color: uni.accentColor, fontSize: 13 }} />
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{uni.name}</span>
                            </div>
                          </label>

                          {/* Programs List */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            paddingLeft: 22
                          }}>
                            {uni.programs.map(prog => {
                              const progKey = `prog_${prog.id}`;
                              const isChecked = hasUniAccess || selectedPerms.includes(progKey);
                              return (
                                <label key={prog.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  cursor: hasUniAccess ? 'not-allowed' : 'pointer',
                                  opacity: hasUniAccess ? 0.75 : 1
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={hasUniAccess}
                                    onChange={() => toggleProgramContext(prog.id)}
                                  />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                                    {prog.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setShowCreateRoleModal(false)} style={styles.btnSecondary}>Cancel</button>
                <button type="submit" style={styles.btnPrimary}>{editingRoleName ? 'Save Changes' : 'Create Role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={styles.toast}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .sidebar-nav-item {
          transition: all 0.2s ease-in-out;
        }
        .sidebar-nav-item:hover {
          color: white !important;
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .sidebar-signout-btn:hover {
          background-color: rgba(239, 68, 68, 0.2) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  sidebar: {
    width: 240,
    background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    flexShrink: 0,
    boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
  },
  sidebarLogo: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  sidebarLogoIcon: {
    width: 40, height: 40,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
    flexShrink: 0,
  },
  sidebarNav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    color: 'rgba(148,163,184,0.7)',
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.2s',
  },
  navItemActive: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    color: 'white',
    fontSize: 13, fontWeight: 700,
    background: 'rgba(99,102,241,0.2)',
    border: '1px solid rgba(99,102,241,0.25)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
  },
  sidebarFooter: {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  sidebarUserInfo: {
    flex: 1, minWidth: 0,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  sidebarAvatar: {
    width: 34, height: 34,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 900, fontSize: 14,
    flexShrink: 0,
  },
  signOutBtn: {
    width: 32, height: 32,
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    color: 'rgba(252,165,165,0.8)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
    fontSize: 13,
  },
  main: {
    flex: 1,
    padding: '32px 36px',
    overflowY: 'auto',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 28, fontWeight: 900, color: '#0f172a',
    margin: '0 0 4px', letterSpacing: '-0.025em',
  },
  headerSub: {
    fontSize: 13, color: '#64748b', fontWeight: 500, margin: 0,
  },
  primaryBtnAction: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 18px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    border: 'none',
    borderRadius: 12,
    color: 'white', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
    transition: 'all 0.2s',
  },
  primaryBtnActionPurple: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 18px',
    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    border: 'none',
    borderRadius: 12,
    color: 'white', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
    transition: 'all 0.2s',
  },
  secondaryBtnAction: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 18px',
    background: 'white',
    border: '1px solid rgba(15,23,42,0.12)',
    borderRadius: 12,
    color: '#475569', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
    transition: 'all 0.2s',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: 'white',
    borderRadius: 20,
    padding: '20px 24px',
    border: '1px solid rgba(15,23,42,0.07)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    display: 'flex', alignItems: 'center', gap: 16,
  },
  statCardIcon: {
    width: 48, height: 48,
    borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18,
  },
  statCardValue: {
    fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em',
  },
  statCardLabel: {
    fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2,
  },
  tableCard: {
    background: 'white',
    borderRadius: 24,
    border: '1px solid rgba(15,23,42,0.07)',
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #f1f5f9',
  },
  tableTitle: {
    fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 2px',
  },
  tableSub: {
    fontSize: 12, color: '#94a3b8', fontWeight: 600, margin: 0,
  },
  searchWrapper: {
    position: 'relative',
    width: 260,
  },
  searchInput: {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 14px 9px 38px',
    background: '#f8fafc',
    border: '1px solid rgba(15,23,42,0.1)',
    borderRadius: 10,
    fontSize: 13, fontWeight: 500, color: '#334155',
    outline: 'none',
  },
  errorBanner: {
    margin: '0 0 20px',
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10,
    color: '#dc2626',
    fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHead: {
    background: '#f8fafc',
  },
  th: {
    padding: '12px 24px',
    fontSize: 10, fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    textAlign: 'left',
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '16px 24px',
    borderBottom: '1px solid #f8fafc',
    fontSize: 14,
    verticalAlign: 'middle',
  },
  tableRow: {
    transition: 'background 0.15s',
  },
  sysRoleBadge: {
    fontSize: 9, fontWeight: 800, color: '#64748b', background: '#e2e8f0', borderRadius: 4, padding: '2px 6px',
  },
  permBadge: {
    fontSize: 9, fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', textTransform: 'capitalize',
  },
  actionBtnEdit: {
    width: 32, height: 32,
    border: '1px solid rgba(79,70,229,0.2)',
    borderRadius: 8,
    color: '#4f46e5',
    background: 'rgba(79,70,229,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  actionBtnDelete: {
    width: 32, height: 32,
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    color: '#ef4444',
    background: 'rgba(239,68,68,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    background: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  modalTitle: {
    fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0,
  },
  modalCloseBtn: {
    background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer',
  },
  modalForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    display: 'block', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
  },
  formInput: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#0f172a', outline: 'none',
  },
  formSelect: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#0f172a', outline: 'none', background: 'white',
  },
  formTextarea: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px',
    fontSize: 13, color: '#0f172a', outline: 'none', resize: 'vertical', fontFamily: 'monospace',
  },
  fileInput: {
    width: '100%', boxSizing: 'border-box',
    border: '1px dashed #cbd5e1', borderRadius: 8, padding: '14px 12px',
    fontSize: 13, color: '#475569', cursor: 'pointer', background: '#f8fafc',
  },
  previewTableWrapper: {
    maxHeight: 180, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 10,
  },
  previewTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
  },
  previewTh: {
    padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left', fontWeight: 700, color: '#475569',
  },
  previewTd: {
    padding: '8px 12px', color: '#334155',
  },
  permissionsListGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
    maxHeight: 200, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12,
  },
  permissionItem: {
    display: 'flex', alignItems: 'flex-start', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, border: '1px solid #f1f5f9', background: '#f8fafc',
  },
  modalFooter: {
    display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    border: 'none', borderRadius: 10, padding: '10px 20px',
    color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(79,70,229,0.25)',
  },
  btnPrimaryPurple: {
    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    border: 'none', borderRadius: 10, padding: '10px 20px',
    color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
  },
  btnSecondary: {
    background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, padding: '9px 20px',
    color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  toast: {
    position: 'fixed',
    bottom: 28,
    right: 28,
    background: '#0f172a',
    color: 'white',
    padding: '14px 22px',
    borderRadius: 14,
    fontSize: 14, fontWeight: 700,
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    zIndex: 9999,
    animation: 'toastIn 0.3s ease',
  },
};
