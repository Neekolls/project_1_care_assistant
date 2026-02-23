// bff/src/routes/auth.routes.ts
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { createUser, findUserByEmail, findUserById } from "../db/repos/users.repo";

/**
 * Types
 */
export type AuthUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "CARE";
};

type AuthRouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

/**
 * Fabrique un JWT (session)
 * - sub = user.id
 * - email/role utiles côté front
 */
function sign(user: AuthUser, jwtSecret: string) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

/**
 * Middleware d'authentification basé sur cookie + JWT
 * - si OK : injecte req.user
 */
function makeAuthMiddleware(opts: AuthRouteOptions) {
  return function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = (req as any).cookies?.[opts.cookieName];

    if (!token) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    try {
      const payload = jwt.verify(token, opts.jwtSecret) as any;

      (req as any).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      } as AuthUser;

      return next();
    } catch {
      return res.status(401).json({ ok: false, error: "Invalid token" });
    }
  };
}

/**
 * Router /api/auth/*
 * - register / login / logout
 */
export function buildAuthRouter(opts: AuthRouteOptions) {
  const router = express.Router();

  /**
   * POST /api/auth/register
   * Crée un compte STANDARD (USER uniquement)
   * - utilise users.repo (pas de SQL inline)
   * - id généré par Postgres (DEFAULT gen_random_uuid())
   */
  router.post("/register", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ detail: "email and password required" });
    }

    // 1) Vérifie si email existe déjà
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ detail: "Email already exists" });
    }

    // 2) Hash mot de passe (jamais stocké en clair)
    const passwordHash = await bcrypt.hash(password, 12);

    // 3) Crée l'utilisateur en DB
    await createUser(email, passwordHash, "USER");

    return res.json({ ok: true });
  });

  /**
   * POST /api/auth/login
   * - récupère user par email
   * - compare bcrypt
   * - pose cookie httpOnly avec JWT
   */
  router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ detail: "email and password required" });
    }

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ detail: "Bad credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ detail: "Bad credentials" });

    const token = sign({ id: user.id, email: user.email, role: user.role }, opts.jwtSecret);

    res.cookie(opts.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // dev
    });

    return res.json({ ok: true });
  });

  /**
   * POST /api/auth/logout
   * - supprime le cookie
   */
  router.post("/logout", async (_req, res) => {
    res.clearCookie(opts.cookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
    return res.json({ ok: true });
  });

  return router;
}

/**
 * Route /api/me (hors /api/auth)
 * - doit rester exactement /api/me pour ton front existant
 */
export function buildMeRouter(opts: AuthRouteOptions) {
  const router = express.Router();
  const auth = makeAuthMiddleware(opts);

  router.get("/me", auth, async (req, res) => {
    const u = (req as any).user as AuthUser;

    // On relit l'user en DB (source of truth)
    const user = await findUserById(u.id);
    if (!user) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, user });
  });

  return router;
}
