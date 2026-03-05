import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth/authService';
import type { TokenPayload } from '../services/auth/authService';
import { isTokenRevoked } from '../services/auth/tokenBlacklistService';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Require a valid Bearer access token: extract from Authorization header,
 * check blacklist (revoked tokens), verify JWT, then set req.user and continue.
 * Responds 401 if missing, revoked, or invalid token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authService.extractTokenFromHeader(authHeader);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const revoked = await isTokenRevoked(token);
  if (revoked) {
    res.status(401).json({ error: 'Token has been revoked' });
    return;
  }

  try {
    const payload = authService.verifyToken(token) as TokenPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof Error && err.message.includes('expired')) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}
