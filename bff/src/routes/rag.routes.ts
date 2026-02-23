import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import {
  getChunkSourcesCare,
  getChunkSourcesUser,
} from "../db/repos/document_chunks.repo";

type RouteOptions = { jwtSecret: string; cookieName: string };

export function buildRagRouter(opts: RouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  /**
   * POST /api/rag/sources
   * Body: { chunkIds: string[] }
   * → renvoie les sources filtrées pour le user connecté
   */
  router.post("/sources", auth, async (req: any, res) => {
    const userId: string = req.user.id;
    const chunkIds: string[] = req.body?.chunkIds || [];

    if (!Array.isArray(chunkIds)) {
      return res.status(400).json({ error: "chunkIds must be an array" });
    }

    const rows = await getChunkSourcesUser(chunkIds, userId);
    res.json(rows);
  });

  /**
   * POST /api/care/rag/sources
   * Body: { chunkIds: string[] }
   * → renvoie les sources sans filtrage (care/admin)
   */
  router.post("/care/sources", auth, careOnly, async (req, res) => {
    const chunkIds: string[] = (req as any).body?.chunkIds || [];

    if (!Array.isArray(chunkIds)) {
      return res.status(400).json({ error: "chunkIds must be an array" });
    }

    const rows = await getChunkSourcesCare(chunkIds);
    res.json(rows);
  });

  return router;
}
