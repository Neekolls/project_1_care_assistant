// bff/src/routes/users.routes.ts
import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { pool } from "../db";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

/**
 * ==========================================
 * CARE ROUTES (ADMIN/CARE uniquement)
 * ==========================================
 */
export function buildCareUsersRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  /**
   * GET /api/care/users
   * Liste tous les users (pour dropdown assignation documents)
   */
  router.get("/", auth, careOnly, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT id, email, role, created_at
         FROM users
         WHERE role = 'USER'
         ORDER BY email ASC`
      );

      res.json(result.rows);
    } catch (err: any) {
      console.error("Error listing users:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
