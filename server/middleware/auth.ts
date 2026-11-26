import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../database.ts';

export const SESSION_COOKIE_NAME = 'attendpro_sid';

export interface AuthenticatedAdmin {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

export interface AuthedRequest extends Request {
  admin?: AuthenticatedAdmin;
  sessionTokenHash?: string;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function setSessionCookie(res: Response, rawToken: string, maxAgeMs: number): void {
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    maxAge: maxAgeMs,
    path: '/'
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/'
  });
}

export function createSession(adminId: number, rememberMe: boolean): { rawToken: string; maxAgeMs: number } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const maxAgeMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const expiresAt = now + maxAgeMs;

  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare(
    'INSERT INTO sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(tokenHash, adminId, expiresAt, now);

  return { rawToken, maxAgeMs };
}

export function getAdminFromRequest(req: Request): { admin: AuthenticatedAdmin; tokenHash: string } | null {
  const authHeader = req.headers.authorization;
  let rawToken: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim();
  } else {
    rawToken = parseCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
  }

  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `SELECT s.expires_at, a.id, a.full_name, a.email, a.role
       FROM sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as (AuthenticatedAdmin & { expires_at: number }) | undefined;

  if (!row || row.expires_at < Date.now()) {
    if (row) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
    return null;
  }

  return {
    admin: {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role
    },
    tokenHash
  };
}

function isSameOriginOrCustomHeader(req: Request): boolean {
  if (req.headers['x-requested-with'] === 'AttendPro') return true;
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const parsed = new URL(origin);
      return parsed.host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const resolved = getAdminFromRequest(req);
  if (!resolved) {
    res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
    return;
  }

  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  const usesBearer = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));

  if (isMutation && !usesBearer && !isSameOriginOrCustomHeader(req)) {
    res.status(403).json({ success: false, message: 'Invalid request origin.' });
    return;
  }

  req.admin = resolved.admin;
  req.sessionTokenHash = resolved.tokenHash;
  next();
}
