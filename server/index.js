import express from 'express';
import cors from 'cors';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'database.db');

const db = new DatabaseSync(dbPath);

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'ggugenai.operations@upgrad.com',
    pass: 'kmrgmrmbqqhtfxhw',
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

// Automatic DB Migration: Drop old schema if roles table doesn't exist
try {
  db.prepare('SELECT 1 FROM roles').all();
} catch {

  db.exec('DROP TABLE IF EXISTS profiles');
  db.exec('DROP TABLE IF EXISTS otps');
  db.exec('DROP TABLE IF EXISTS sessions');
}

// ─── Initialize DB Schema ───────────────────────────────────────────────────

// 1. Roles table
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    name TEXT PRIMARY KEY,
    description TEXT,
    permissions TEXT NOT NULL, -- JSON stringified array
    is_system INTEGER DEFAULT 0
  )
`);

// 2. Profiles table (without role CHECK constraint, referencing roles table)
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' REFERENCES roles(name) ON UPDATE CASCADE,
    full_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// 3. OTPs table
db.exec(`
  CREATE TABLE IF NOT EXISTS otps (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

// ─── Pre-populate Roles & Profiles ──────────────────────────────────────────

// Always reset/overwrite system roles to ensure the new schema is applied
try {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM roles');

  const insertRole = db.prepare('INSERT OR REPLACE INTO roles (name, description, permissions, is_system) VALUES (?, ?, ?, ?)');

  // 1. Super Admin permissions (full access)
  const superAdminPerms = [
    'page_home',
    'page_learners',
    'page_program_dash',
    'page_live_sessions',
    'page_immersion',
    'page_dissertation',
    'page_academic_perf',
    'page_admin',
    'action_edit_users',
    'action_edit_budgets',
    'uni_all'
  ];
  insertRole.run('super admin', 'Super Administrator with full access to all panels and dashboards', JSON.stringify(superAdminPerms), 1);

  // 2. Admin permissions (no admin console/user edit, but everything else)
  const adminPerms = [
    'page_home',
    'page_learners',
    'page_program_dash',
    'page_live_sessions',
    'page_immersion',
    'page_dissertation',
    'page_academic_perf',
    'action_edit_budgets',
    'uni_all'
  ];
  insertRole.run('admin', 'Administrator with full access except Admin Panel and user editing', JSON.stringify(adminPerms), 1);

  // 3. University Specific Viewers
  insertRole.run('ggu viewer', 'Golden Gate University Viewer (Restricted to GGU details only)', JSON.stringify(['page_home', 'page_learners', 'uni_ggu']), 1);
  insertRole.run('psb viewer', 'Paris School of Business Viewer (Restricted to PSB details only)', JSON.stringify(['page_home', 'page_learners', 'uni_psb']), 1);
  insertRole.run('edgewood viewer', 'Edgewood University Viewer (Restricted to Edgewood details only)', JSON.stringify(['page_home', 'page_learners', 'uni_edgewood']), 1);
  insertRole.run('esgci viewer', 'ESGCI Viewer (Restricted to ESGCI details only)', JSON.stringify(['page_home', 'page_learners', 'uni_esgci']), 1);

} catch (err) {
  console.error('[SQLite DB Error] Failed to seed roles:', err);
}

// Pre-populate profiles with university-specific users
try {
  const insertProfile = db.prepare('INSERT OR REPLACE INTO profiles (id, email, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)');

  insertProfile.run('admin-shetty-id', 'akshit1.shetty@upgrad.com', 'super admin', 'Akshit Shetty', new Date().toISOString());
  insertProfile.run('user-standard-id', 'standard.user@upgrad.com', 'user', 'Standard User', new Date().toISOString());
  insertProfile.run('user-ggu-id', 'ggu.user@upgrad.com', 'ggu viewer', 'GGU Manager', new Date().toISOString());
  insertProfile.run('user-psb-id', 'psb.user@upgrad.com', 'psb viewer', 'PSB Manager', new Date().toISOString());
  insertProfile.run('user-edgewood-id', 'edgewood.user@upgrad.com', 'edgewood viewer', 'Edgewood Manager', new Date().toISOString());
  insertProfile.run('user-esgci-id', 'esgci.user@upgrad.com', 'esgci viewer', 'ESGCI Manager', new Date().toISOString());
} catch (err) {
  console.error('[SQLite DB Error] Failed to seed profiles:', err);
}

// Ensure foreign keys are enabled
try {
  db.exec('PRAGMA foreign_keys = ON;');
} catch (err) {
  console.error('[SQLite DB Error] Failed to enable foreign keys:', err);
}

const app = express();
app.use(cors());
app.use(express.json());

// helper to generate unique id
function generateUUID() {
  return 'uuid-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
}

// Helper to get permissions list for a user profile
function augmentProfileWithPermissions(profile) {
  if (!profile) return null;
  const selectRole = db.prepare('SELECT permissions FROM roles WHERE name = ?');
  const roles = selectRole.all(profile.role);
  const roleRecord = roles[0];
  const permissions = roleRecord ? JSON.parse(roleRecord.permissions) : [];
  return { ...profile, permissions };
}

// ─── API Endpoints ───────────────────────────────────────────────────────────

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const normalized = email.trim().toLowerCase();

  // Check if profile exists in the database
  const selectProfile = db.prepare('SELECT 1 FROM profiles WHERE email = ?');
  const profiles = selectProfile.all(normalized);

  if (profiles.length === 0) {
    return res.status(400).json({ error: { message: 'This email is not registered in the system' } });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry

  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO otps (email, code, expires_at) VALUES (?, ?, ?)');
    stmt.run(normalized, code, expiresAt);



    // Send email using Nodemailer
    const mailOptions = {
      from: '"ggugenaiops" <ggugenai.operations@upgrad.com>',
      to: normalized,
      subject: 'Your EduOps360 Login OTP Verification Code',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; color: #1e293b; box-shadow: 0 8px 30px rgba(15,23,42,0.04);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 50px; height: 50px; line-height: 50px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 14px; color: #ffffff; font-size: 24px; font-weight: bold; text-align: center; box-shadow: 0 6px 20px rgba(79,70,229,0.2);">
              🎓
            </div>
            <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 12px 0 4px; letter-spacing: -0.02em;">EduOps360</h2>
            <p style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; font-weight: 600;">Operations Platform Auth</p>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #edf2f7; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #334155; margin: 0 0 16px; font-weight: 500;">Use the following verification code to sign into your account:</p>
            <div style="font-size: 32px; font-weight: 900; color: #4f46e5; letter-spacing: 6px; padding: 12px 20px; background: #e0e7ff; border-radius: 12px; display: inline-block; border: 1px solid #c7d2fe; font-family: monospace;">
              ${code}
            </div>
            <p style="font-size: 11px; color: #64748b; margin: 16px 0 0; font-weight: 500;">This verification code will expire in 5 minutes.</p>
          </div>
          
          <div style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px; font-weight: 500;">
            If you did not request this code, you can safely ignore this email.
            <br />
            <span style="display: inline-block; margin-top: 8px; color: #cbd5e1; font-weight: 600;">🔐 Secured by Local SQLite Virtual Auth</span>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);


    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[SMTP Error] Failed to send email to ${normalized}:`, err);
    return res.status(500).json({ error: `Failed to send email: ${message}` });
  }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ error: 'Email and token are required' });
  }
  const normalized = email.trim().toLowerCase();

  const selectOtp = db.prepare('SELECT * FROM otps WHERE email = ?');
  const otps = selectOtp.all(normalized);
  const otpRecord = otps[0];

  if (!otpRecord || otpRecord.code !== token || Date.now() > otpRecord.expires_at) {
    return res.json({
      session: null,
      error: { message: 'Invalid or expired code. Please try again.' }
    });
  }

  // Delete the OTP code from DB
  const deleteOtp = db.prepare('DELETE FROM otps WHERE email = ?');
  deleteOtp.run(normalized);

  // Check if profile exists
  const selectProfile = db.prepare('SELECT * FROM profiles WHERE email = ?');
  const profiles = selectProfile.all(normalized);
  let profile = profiles[0];

  if (!profile) {
    return res.json({
      session: null,
      error: { message: 'Access denied. Your email is not registered in the system.' }
    });
  }

  return res.json({
    session: {
      user: {
        id: profile.id,
        email: profile.email
      }
    },
    error: null
  });
});

// 3. Get all profiles (including role permissions)
app.get('/api/profiles', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles');
    const rows = stmt.all();
    const data = rows.map(augmentProfileWithPermissions);
    return res.json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ data: null, error: { message } });
  }
});

// 4. Get single profile (with role permissions)
app.get('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const rows = stmt.all(id);
    const profile = rows[0] || null;
    return res.json({
      data: augmentProfileWithPermissions(profile),
      error: profile ? null : { message: 'Profile not found' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ data: null, error: { message } });
  }
});

// 5. Create user manually (Admin Action)
app.post('/api/users', (req, res) => {
  const { email, full_name, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' });
  }
  const normalized = email.trim().toLowerCase();

  try {
    // Check if role is valid
    const selectRole = db.prepare('SELECT name FROM roles WHERE name = ?');
    const roleMatch = selectRole.all(role);
    if (roleMatch.length === 0) {
      return res.status(400).json({ error: `Selected role '${role}' does not exist` });
    }

    // Check if email already exists
    const checkEmail = db.prepare('SELECT id FROM profiles WHERE email = ?');
    const existing = checkEmail.all(normalized);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const newUser = {
      id: generateUUID(),
      email: normalized,
      role,
      full_name: full_name ? full_name.trim() : normalized.split('@')[0],
      created_at: new Date().toISOString()
    };

    const insert = db.prepare('INSERT INTO profiles (id, email, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)');
    insert.run(newUser.id, newUser.email, newUser.role, newUser.full_name, newUser.created_at);

    return res.json({ success: true, data: augmentProfileWithPermissions(newUser) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 6. Update user (Admin Action)
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { email, full_name, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' });
  }
  const normalized = email.trim().toLowerCase();

  try {
    // Verify role exists
    const selectRole = db.prepare('SELECT name FROM roles WHERE name = ?');
    const roleMatch = selectRole.all(role);
    if (roleMatch.length === 0) {
      return res.status(400).json({ error: `Role '${role}' does not exist` });
    }

    // Verify email unique to other profiles
    const checkEmail = db.prepare('SELECT id FROM profiles WHERE email = ? AND id != ?');
    const existing = checkEmail.all(normalized, id);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const update = db.prepare('UPDATE profiles SET email = ?, role = ?, full_name = ? WHERE id = ?');
    const result = update.run(normalized, role, full_name ? full_name.trim() : null, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 7. Delete user (Admin Action)
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  try {
    const remove = db.prepare('DELETE FROM profiles WHERE id = ?');
    const result = remove.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 8. Bulk upload users (Admin Action)
app.post('/api/users/bulk-upload', (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) {
    return res.status(400).json({ error: 'Invalid user list format' });
  }

  let successCount = 0;
  const errors = [];

  // Load all existing roles
  const selectRoles = db.prepare('SELECT name FROM roles');
  const availableRoles = selectRoles.all().map(r => r.name);

  // We perform inserts in a loop. Since node:sqlite is synchronous, this runs very fast
  for (const user of users) {
    const { email, name, role } = user;
    if (!email) {
      errors.push(`Skipped row: missing email`);
      continue;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const assignedRole = (role && availableRoles.includes(role.trim().toLowerCase())) ? role.trim().toLowerCase() : 'user';
    const fullName = name ? name.trim() : normalizedEmail.split('@')[0];

    try {
      // Check for duplicate
      const checkEmail = db.prepare('SELECT id FROM profiles WHERE email = ?');
      const existing = checkEmail.all(normalizedEmail);
      if (existing.length > 0) {
        errors.push(`Skipped ${normalizedEmail}: Email already exists`);
        continue;
      }

      const id = generateUUID();
      const createdAt = new Date().toISOString();
      const insert = db.prepare('INSERT INTO profiles (id, email, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)');
      insert.run(id, normalizedEmail, assignedRole, fullName, createdAt);
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to insert ${normalizedEmail}: ${message}`);
    }
  }

  return res.json({ success: true, count: successCount, errors });
});

// 9. Get all custom roles
app.get('/api/roles', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM roles');
    const rows = stmt.all();
    const data = rows.map(r => ({
      name: r.name,
      description: r.description,
      permissions: JSON.parse(r.permissions),
      is_system: r.is_system === 1
    }));
    return res.json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ data: null, error: { message } });
  }
});

// 10. Create a role
app.post('/api/roles', (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Role name and permissions list are required' });
  }
  const roleName = name.trim().toLowerCase();

  try {
    // Check if role name is empty or reserved
    if (!roleName) {
      return res.status(400).json({ error: 'Role name cannot be empty' });
    }

    const check = db.prepare('SELECT name FROM roles WHERE name = ?');
    const existing = check.all(roleName);
    if (existing.length > 0) {
      return res.status(400).json({ error: `Role '${roleName}' already exists` });
    }

    const stmt = db.prepare('INSERT INTO roles (name, description, permissions, is_system) VALUES (?, ?, ?, ?)');
    stmt.run(roleName, description ? description.trim() : '', JSON.stringify(permissions), 0);
    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 11. Delete custom role
app.delete('/api/roles/:name', (req, res) => {
  const { name } = req.params;
  const roleName = name.trim().toLowerCase();

  try {
    const check = db.prepare('SELECT is_system FROM roles WHERE name = ?');
    const records = check.all(roleName);
    const roleRecord = records[0];

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' });
    }
    if (roleRecord.is_system === 1) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }

    // Demote any users who had this role to standard 'user' role
    const updateUsers = db.prepare('UPDATE profiles SET role = \'user\' WHERE role = ?');
    updateUsers.run(roleName);

    // Delete role
    const remove = db.prepare('DELETE FROM roles WHERE name = ?');
    remove.run(roleName);

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 12. Update custom role
app.put('/api/roles/:name', (req, res) => {
  const { name } = req.params;
  const { description, permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions list is required' });
  }
  const roleName = name.trim().toLowerCase();

  try {
    const check = db.prepare('SELECT is_system FROM roles WHERE name = ?');
    const records = check.all(roleName);
    const roleRecord = records[0];

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' });
    }
    if (roleRecord.is_system === 1) {
      return res.status(400).json({ error: 'System roles cannot be modified' });
    }

    const stmt = db.prepare('UPDATE roles SET description = ?, permissions = ? WHERE name = ?');
    stmt.run(description ? description.trim() : '', JSON.stringify(permissions), roleName);
    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 13. Sign out
app.post('/api/auth/sign-out', (req, res) => {
  return res.json({ success: true });
});

// Start Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
