// bff/src/auth/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Middleware d'authentification
 * Vérifie le JWT dans le cookie et ajoute req.user
 */
export function requireAuth(jwtSecret: string, cookieName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Lire le token depuis le cookie
      const token = req.cookies?.[cookieName];

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // 2. Vérifier et décoder le JWT
      const decoded = jwt.verify(token, jwtSecret) as any;

      console.log("🔑 JWT decoded:", decoded);

      // 3. Ajouter user dans req (mapper sub → id)
      req.user = {
        id: decoded.sub || decoded.id,  // Support sub ET id
        email: decoded.email,
        role: decoded.role,
        created_at: decoded.created_at || new Date().toISOString()
      };

      // 4. Continuer vers la route
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

/**
 * Middleware de vérification de rôle
 * Doit être utilisé APRÈS requireAuth
 */
export function requireRole(allowedRoles: Array<"USER" | "ADMIN" | "CARE">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}