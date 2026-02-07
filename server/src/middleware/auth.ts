import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool.js';
import { generateUUID } from '../db/sqlite.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  isAdmin?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Simple username-based auth middleware.
 * Reads username from X-Username header or request body.
 * Creates user in DB if not exists.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const username = (req.headers['x-username'] as string) || req.body?.username || 'anonymous';

  try {
    // Find or create user
    let result = await pool.query('SELECT id, username, is_admin FROM users WHERE username = ?', [username]);

    if (result.rows.length === 0) {
      const userId = generateUUID();
      await pool.query(
        'INSERT INTO users (id, username) VALUES (?, ?)',
        [userId, username]
      );
      req.user = { id: userId, username };
    } else {
      const user = result.rows[0];
      req.user = { id: user.id, username: user.username, isAdmin: !!user.is_admin };
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Fall back to anonymous
    req.user = { id: 'anonymous', username: 'anonymous' };
    next();
  }
}

/**
 * Optional auth - same as authMiddleware but never fails.
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const username = req.headers['x-username'] as string;

  if (username) {
    try {
      const result = await pool.query('SELECT id, username, is_admin FROM users WHERE username = ?', [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.user = { id: user.id, username: user.username, isAdmin: !!user.is_admin };
      }
    } catch {
      // Continue without user
    }
  }

  next();
}
