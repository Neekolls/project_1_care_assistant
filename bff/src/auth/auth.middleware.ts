import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Type ajouté à Request pour inclure user
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "USER" | "ADMIN" | "CARE";
  };
}

/**
 * Middleware requireAuth
 * -----------------------
 * Vérifie que :
 * - un cookie existe
 * - le JWT est valide
 * Si OK → injecte req.user
 * Sinon → 401
 */
export function requireAuth(jwtSecret: string, cookieName: string) {
  return function (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    const token = (req as any).cookies?.[cookieName];

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as any;

      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

/**
 * Middleware requireRole
 * -----------------------
 * Vérifie que le rôle du user est autorisé
 * Sinon → 403
 */
export function requireRole(allowedRoles: string[]) {
  return function (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}
