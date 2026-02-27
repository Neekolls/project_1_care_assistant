// bff/src/routes/rag.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { pool } from "../db";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

/**
 * ==========================================
 * USER RAG ROUTES
 * ==========================================
 */
export function buildUserRagRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * POST /api/sources
   * Récupérer les chunks sources par IDs avec filtrage visibilité
   * 
   * Body: { chunkIds: string[] }
   * Returns: ChunkSource[]
   */
  router.post("/sources", auth, async (req: any, res) => {
    try {
      const { chunkIds } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
        return res.json([]);
      }

      // Récupérer les chunks avec filtrage visibilité
      const result = await pool.query(
        `SELECT 
          dc.id as chunk_id,
          dc.document_id,
          dc.chunk_index,
          dc.page_number,
          dc.content,
          d.filename,
          d.visibility,
          d.owner_user_id
         FROM document_chunks dc
         JOIN documents d ON dc.document_id = d.id
         WHERE dc.id::text = ANY($1::text[])
           AND (
             d.visibility = 'PUBLIC'
             OR d.owner_user_id = $2
             OR d.visibility = 'ADMIN_ONLY'
           )
         ORDER BY dc.document_id, dc.chunk_index`,
        [chunkIds, userId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching sources:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

/**
 * ==========================================
 * CARE RAG ROUTES
 * ==========================================
 */
export function buildCareRagRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  /**
   * POST /api/care/sources
   * Récupérer chunks (CARE peut tout voir)
   */
  router.post("/sources", auth, careOnly, async (req, res) => {
    try {
      const { chunkIds } = req.body;

      if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
        return res.json([]);
      }

      const result = await pool.query(
        `SELECT 
          dc.id as chunk_id,
          dc.document_id,
          dc.chunk_index,
          dc.page_number,
          dc.content,
          d.filename,
          d.visibility,
          d.owner_user_id
         FROM document_chunks dc
         JOIN documents d ON dc.document_id = d.id
         WHERE dc.id::text = ANY($1::text[])
         ORDER BY dc.document_id, dc.chunk_index`,
        [chunkIds]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching sources:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}