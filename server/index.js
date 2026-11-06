import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { buildOtpEmail } from './otpEmail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// ─── Database ────────────────────────────────────────────────────────────────
// Production (Vercel) uses a hosted Turso database so users persist across
// serverless instances. Local dev falls back to the SQLite file in this folder.
const dbUrl = process.env.TURSO_DATABASE_URL || pathToFileURL(join(__dirname, 'database.db')).href;
if (isVercel && !process.env.TURSO_DATABASE_URL) {
  console.error('[Config Error] TURSO_DATABASE_URL is not set — user data will not persist on Vercel.');
}
const db = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });

// Run a query and return its rows
async function query(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows;
}

// Run a statement and return the number of affected rows
async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rowsAffected;
}

// ─── Email ───────────────────────────────────────────────────────────────────
// Credentials come from environment variables (set in Vercel → Settings → Environment Variables)
const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Initialize DB Schema & Seed ─────────────────────────────────────────────

async function initDb() {
  // 1. Roles table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      name TEXT PRIMARY KEY,
      description TEXT,
      permissions TEXT NOT NULL, -- JSON stringified array
      is_system INTEGER DEFAULT 0
    )
  `);

  // 2. Profiles table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' REFERENCES roles(name) ON UPDATE CASCADE,
      full_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 3. OTPs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS otps (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // 4. Sessions table (server-issued login tokens)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // System roles are always refreshed so permission changes in code apply; custom roles are kept
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
  const systemRoles = [
    ['super admin', 'Super Administrator with full access to all panels and dashboards', superAdminPerms],
    ['admin', 'Administrator with full access except Admin Panel and user editing', adminPerms],
    ['ggu viewer', 'Golden Gate University Viewer (Restricted to GGU details only)', ['page_home', 'page_learners', 'uni_ggu']],
    // Default role for bulk uploads and users whose custom role was deleted
    ['user', 'Standard user with Home and Learners access to Golden Gate University', ['page_home', 'page_learners', 'uni_all']],
  ];

  // Seed users are only inserted if missing, so edits made in the Admin Panel are preserved
  const now = new Date().toISOString();
  const seedProfiles = [
    ['admin-shetty-id', 'akshit1.shetty@upgrad.com', 'super admin', 'Akshit Shetty'],
    ['user-standard-id', 'standard.user@upgrad.com', 'user', 'Standard User'],
    ['user-ggu-id', 'ggu.user@upgrad.com', 'ggu viewer', 'GGU Manager'],
  ];

  // Demo accounts are only seeded into an empty database, so users deleted in the Admin Panel stay deleted.
  // The primary super admin is always ensured so the Admin Panel can't be locked out.
  const [{ count: profileCount }] = await query('SELECT COUNT(*) AS count FROM profiles');
  const profilesToSeed = Number(profileCount) === 0 ? seedProfiles : seedProfiles.slice(0, 1);

  await db.batch([
    ...systemRoles.map(([name, description, perms]) => ({
      sql: 'INSERT OR REPLACE INTO roles (name, description, permissions, is_system) VALUES (?, ?, ?, 1)',
      args: [name, description, JSON.stringify(perms)],
    })),
    ...profilesToSeed.map(([id, email, role, fullName]) => ({
      sql: 'INSERT OR IGNORE INTO profiles (id, email, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, email, role, fullName, now],
    })),
  ], 'write');
}

// Serverless functions may handle a request as soon as they boot, so every request waits for init
const dbReady = initDb();
dbReady.catch((err) => console.error('[DB Error] Failed to initialize database:', err));

const app = express();
app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch {
    res.status(503).json({ error: { message: 'Database is unavailable. Please try again shortly.' } });
  }
});

// helper to generate unique id
function generateUUID() {
  return 'uuid-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
}

// Helper to get permissions list for a user profile
async function augmentProfileWithPermissions(profile) {
  if (!profile) return null;
  const roles = await query('SELECT permissions FROM roles WHERE name = ?', [profile.role]);
  const roleRecord = roles[0];
  const permissions = roleRecord ? JSON.parse(roleRecord.permissions) : [];
  return { ...profile, permissions };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await db.batch([
    { sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [Date.now()] },
    { sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', args: [token, userId, expiresAt] },
  ], 'write');
  return { token, expiresAt };
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

// Rejects requests without a valid session token; attaches the caller's profile as req.profile
async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: { message: 'Not signed in' } });
  }
  const rows = await query(
    'SELECT p.* FROM sessions s JOIN profiles p ON p.id = s.user_id WHERE s.token = ? AND s.expires_at > ?',
    [token, Date.now()]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: { message: 'Session expired. Please sign in again.' } });
  }
  req.profile = await augmentProfileWithPermissions(rows[0]);
  next();
}

// User and role management is limited to roles with the user-editing permission
function requireAdmin(req, res, next) {
  if (!req.profile?.permissions?.includes('action_edit_users')) {
    return res.status(403).json({ error: { message: 'You do not have permission to manage users and roles' } });
  }
  next();
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
  const profiles = await query('SELECT 1 FROM profiles WHERE email = ?', [normalized]);
  if (profiles.length === 0) {
    return res.status(400).json({ error: { message: 'This email is not registered in the system' } });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry

  try {
    await run('INSERT OR REPLACE INTO otps (email, code, expires_at) VALUES (?, ?, ?)', [normalized, code, expiresAt]);

    // Local dev without SMTP credentials: print the code instead of emailing it
    if (!smtpConfigured && !isVercel) {
      console.log(`[Local Dev] OTP for ${normalized} is: ${code}`);
      return res.json({ success: true });
    }

    const mailOptions = {
      from: `"EduOps360 · upGrad" <${process.env.SMTP_USER}>`,
      to: normalized,
      ...buildOtpEmail(code, 5),
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (smtpErr) {
      console.error(`[SMTP Error] Could not deliver email to ${normalized}:`, smtpErr);
      return res.status(502).json({ error: { message: 'Could not send the verification email. Please try again or contact the administrator.' } });
    }

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Server Error] Failed processing send-otp for ${normalized}:`, err);
    return res.status(500).json({ error: `Failed to process OTP request: ${message}` });
  }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ error: 'Email and token are required' });
  }
  const normalized = email.trim().toLowerCase();

  const otps = await query('SELECT * FROM otps WHERE email = ?', [normalized]);
  const otpRecord = otps[0];
  const isValidOtp = otpRecord && otpRecord.code === String(token) && Date.now() <= Number(otpRecord.expires_at);

  if (!isValidOtp) {
    return res.json({
      session: null,
      error: { message: 'Invalid or expired code. Please try again.' }
    });
  }

  // Delete the OTP code from DB
  await run('DELETE FROM otps WHERE email = ?', [normalized]);

  // Check if profile exists
  const profiles = await query('SELECT * FROM profiles WHERE email = ?', [normalized]);
  const profile = profiles[0];

  if (!profile) {
    return res.json({
      session: null,
      error: { message: 'Access denied. Your email is not registered in the system.' }
    });
  }

  const { token: accessToken, expiresAt } = await createSession(profile.id);

  return res.json({
    session: {
      access_token: accessToken,
      expires_at: expiresAt,
      user: {
        id: profile.id,
        email: profile.email
      }
    },
    error: null
  });
});

// 3. Get all profiles (including role permissions)
app.get('/api/profiles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM profiles');
    const data = await Promise.all(rows.map(augmentProfileWithPermissions));
    return res.json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ data: null, error: { message } });
  }
});

// 4. Get single profile (with role permissions)
app.get('/api/profiles/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  // Users may only read their own profile; admins may read any
  if (id !== req.profile.id && !req.profile.permissions.includes('action_edit_users')) {
    return res.status(403).json({ data: null, error: { message: 'Not allowed to view this profile' } });
  }
  try {
    const rows = await query('SELECT * FROM profiles WHERE id = ?', [id]);
    const profile = rows[0] || null;
    return res.json({
      data: await augmentProfileWithPermissions(profile),
      error: profile ? null : { message: 'Profile not found' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ data: null, error: { message } });
  }
});

// 5. Create user manually (Admin Action)
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, full_name, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' });
  }
  const normalized = email.trim().toLowerCase();

  try {
    // Check if role is valid
    const roleMatch = await query('SELECT name FROM roles WHERE name = ?', [role]);
    if (roleMatch.length === 0) {
      return res.status(400).json({ error: `Selected role '${role}' does not exist` });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM profiles WHERE email = ?', [normalized]);
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

    await run(
      'INSERT INTO profiles (id, email, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)',
      [newUser.id, newUser.email, newUser.role, newUser.full_name, newUser.created_at]
    );

    return res.json({ success: true, data: await augmentProfileWithPermissions(newUser) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 6. Update user (Admin Action)
app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, full_name, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' });
  }
  const normalized = email.trim().toLowerCase();

  try {
    // Verify role exists
    const roleMatch = await query('SELECT name FROM roles WHERE name = ?', [role]);
    if (roleMatch.length === 0) {
      return res.status(400).json({ error: `Role '${role}' does not exist` });
    }

    // Verify email unique to other profiles
    const existing = await query('SELECT id FROM profiles WHERE email = ? AND id != ?', [normalized, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const changes = await run(
      'UPDATE profiles SET email = ?, role = ?, full_name = ? WHERE id = ?',
      [normalized, role, full_name ? full_name.trim() : null, id]
    );

    if (changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 7. Delete user (Admin Action)
app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const changes = await run('DELETE FROM profiles WHERE id = ?', [id]);
    if (changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    await run('DELETE FROM sessions WHERE user_id = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 7b. Bulk delete users (Admin Action) — the caller's own account is never deleted
app.post('/api/users/bulk-delete', requireAuth, requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'A list of user ids is required' });
  }
  const targetIds = [...new Set(ids.map(String))].filter(id => id !== req.profile.id);
  if (targetIds.length === 0) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const placeholders = targetIds.map(() => '?').join(', ');
    const [deleted] = await db.batch([
      { sql: `DELETE FROM profiles WHERE id IN (${placeholders})`, args: targetIds },
      { sql: `DELETE FROM sessions WHERE user_id IN (${placeholders})`, args: targetIds },
    ], 'write');
    return res.json({ success: true, count: deleted.rowsAffected });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 8. Bulk upload users (Admin Action)
app.post('/api/users/bulk-upload', requireAuth, requireAdmin, async (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) {
    return res.status(400).json({ error: 'Invalid user list format' });
  }

  let successCount = 0;
  const errors = [];

  // Load all existing roles
  const availableRoles = (await query('SELECT name FROM roles')).map(r => r.name);

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
      const existing = await query('SELECT id FROM profiles WHERE email = ?', [normalizedEmail]);
      if (existing.length > 0) {
        errors.push(`Skipped ${normalizedEmail}: Email already exists`);
        continue;
      }

      await run(
        'INSERT INTO profiles (id, email, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)',
        [generateUUID(), normalizedEmail, assignedRole, fullName, new Date().toISOString()]
      );
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to insert ${normalizedEmail}: ${message}`);
    }
  }

  return res.json({ success: true, count: successCount, errors });
});

// 9. Get all custom roles
app.get('/api/roles', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM roles');
    const data = rows.map(r => ({
      name: r.name,
      description: r.description,
      permissions: JSON.parse(r.permissions),
      is_system: Number(r.is_system) === 1
    }));
    return res.json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ data: null, error: { message } });
  }
});

// 10. Create a role
app.post('/api/roles', requireAuth, requireAdmin, async (req, res) => {
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

    const existing = await query('SELECT name FROM roles WHERE name = ?', [roleName]);
    if (existing.length > 0) {
      return res.status(400).json({ error: `Role '${roleName}' already exists` });
    }

    await run(
      'INSERT INTO roles (name, description, permissions, is_system) VALUES (?, ?, ?, ?)',
      [roleName, description ? description.trim() : '', JSON.stringify(permissions), 0]
    );
    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 11. Delete custom role
app.delete('/api/roles/:name', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.params;
  const roleName = name.trim().toLowerCase();

  try {
    const records = await query('SELECT is_system FROM roles WHERE name = ?', [roleName]);
    const roleRecord = records[0];

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' });
    }
    if (Number(roleRecord.is_system) === 1) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }

    // Demote any users who had this role to standard 'user' role, then delete the role
    await db.batch([
      { sql: 'UPDATE profiles SET role = \'user\' WHERE role = ?', args: [roleName] },
      { sql: 'DELETE FROM roles WHERE name = ?', args: [roleName] },
    ], 'write');

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 12. Update custom role
app.put('/api/roles/:name', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.params;
  const { description, permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions list is required' });
  }
  const roleName = name.trim().toLowerCase();

  try {
    const records = await query('SELECT is_system FROM roles WHERE name = ?', [roleName]);
    const roleRecord = records[0];

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' });
    }
    if (Number(roleRecord.is_system) === 1) {
      return res.status(400).json({ error: 'System roles cannot be modified' });
    }

    await run(
      'UPDATE roles SET description = ?, permissions = ? WHERE name = ?',
      [description ? description.trim() : '', JSON.stringify(permissions), roleName]
    );
    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: { message } });
  }
});

// 13. Sign out
app.post('/api/auth/sign-out', async (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    await run('DELETE FROM sessions WHERE token = ?', [token]);
  }
  return res.json({ success: true });
});

// Start Express server if running directly
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
