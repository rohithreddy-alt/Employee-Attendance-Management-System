import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import express, { type Response } from 'express';
import { db } from '../database.ts';
import {
  clearSessionCookie,
  createSession,
  getAdminFromRequest,
  requireAuth,
  setSessionCookie,
  type AuthedRequest
} from '../middleware/auth.ts';

const router = express.Router();

function hasConfiguredEnvPasscode(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
}

function verifyEnvPasscode(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSCODE?.trim() || '';
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.get('/status', (req, res: Response) => {
  const adminCount = (db.prepare('SELECT COUNT(*) AS count FROM admins').get() as { count: number }).count;
  const needsSetup = adminCount === 0 && !hasConfiguredEnvPasscode();
  const resolved = getAdminFromRequest(req);
  const company = db.prepare('SELECT company_name, office_start_time, office_end_time FROM settings WHERE id = 1').get();

  res.json({
    success: true,
    data: {
      authenticated: Boolean(resolved),
      needsSetup,
      admin: resolved ? resolved.admin : null,
      company: company || null
    }
  });
});

router.post('/setup', (req, res: Response) => {
  try {
    if (hasConfiguredEnvPasscode()) {
      res.status(403).json({
        success: false,
        message: 'Initial setup is disabled because an environment admin passcode is configured.'
      });
      return;
    }

    const adminCount = (db.prepare('SELECT COUNT(*) AS count FROM admins').get() as { count: number }).count;
    if (adminCount > 0) {
      res.status(403).json({
        success: false,
        message: 'Admin account is already initialized. Please sign in.'
      });
      return;
    }

    const fullName = String(req.body?.full_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirm_password || '');

    if (!fullName || !email || !password) {
      res.status(400).json({ success: false, message: 'Full name, email, and password are required.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Password and confirmation do not match.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(fullName, email, passwordHash, 'Super Admin');

    const admin = db
      .prepare('SELECT id, full_name, email, role FROM admins WHERE id = ?')
      .get(result.lastInsertRowid) as { id: number; full_name: string; email: string; role: string };

    const { rawToken, maxAgeMs } = createSession(admin.id, true);
    setSessionCookie(res, rawToken, maxAgeMs);

    const company = db.prepare('SELECT company_name, office_start_time, office_end_time FROM settings WHERE id = 1').get();

    res.status(201).json({
      success: true,
      message: 'Admin account created and signed in.',
      data: {
        token: rawToken,
        admin,
        company
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.post('/login', (req, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const rememberMe = Boolean(req.body?.rememberMe);

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    let admin = db
      .prepare('SELECT id, full_name, email, password_hash, role FROM admins WHERE LOWER(email) = LOWER(?)')
      .get(email) as
      | { id: number; full_name: string; email: string; password_hash: string; role: string }
      | undefined;

    if (hasConfiguredEnvPasscode()) {
      if (!verifyEnvPasscode(password)) {
        res.status(401).json({ success: false, message: 'Invalid email or password.' });
        return;
      }
      if (!admin) {
        const count = (db.prepare('SELECT COUNT(*) AS count FROM admins').get() as { count: number }).count;
        if (count === 0) {
          const hash = bcrypt.hashSync(password, 10);
          const inserted = db
            .prepare('INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
            .run('Alex Morgan', email, hash, 'Super Admin');
          admin = db
            .prepare('SELECT id, full_name, email, password_hash, role FROM admins WHERE id = ?')
            .get(inserted.lastInsertRowid) as typeof admin;
        } else {
          res.status(401).json({ success: false, message: 'Invalid email or password.' });
          return;
        }
      }
    } else {
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        res.status(401).json({ success: false, message: 'Invalid email or password.' });
        return;
      }
    }

    if (!admin) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const { rawToken, maxAgeMs } = createSession(admin.id, rememberMe);
    setSessionCookie(res, rawToken, maxAgeMs);

    const company = db.prepare('SELECT company_name, office_start_time, office_end_time FROM settings WHERE id = 1').get();

    res.json({
      success: true,
      message: 'Signed in successfully.',
      data: {
        token: rawToken,
        admin: {
          id: admin.id,
          full_name: admin.full_name,
          email: admin.email,
          role: admin.role
        },
        company
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.post('/logout', (req: AuthedRequest, res: Response) => {
  const resolved = getAdminFromRequest(req);
  if (resolved) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(resolved.tokenHash);
  }
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const company = db.prepare('SELECT company_name, office_start_time, office_end_time FROM settings WHERE id = 1').get();
  res.json({
    success: true,
    data: {
      admin: req.admin,
      company: company || {}
    }
  });
});

export default router;
