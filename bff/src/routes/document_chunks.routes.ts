import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import {
  upsertDocumentChunks,
  listDocumentChunksByDocumentId,
  deleteChunksByDocumentId,
  NewChunk,
} from "../db/repos/document_chunks.repo";

type RouteOptions = { jwtSecret: string; cookieName: string };

export function buildDocumentChunksRouter(opts: RouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  /**
   * GET /api/care/documents/:documentId/chunks
   * Debug/admin : liste tous les chunks d’un doc
   */
  router.get(
    "/documents/:documentId/chunks",
    auth,
    careOnly,
    async (req, res) => {
      const documentId: string = req.params.documentId as string;
      if (!documentId) return res.status(400).json({ error: "Missing documentId" });

      const rows = await listDocumentChunksByDocumentId(documentId);
      res.json(rows);
    }
  );

  /**
   * POST /api/care/documents/:documentId/chunks
   * Bulk upsert : reçoit { chunks: NewChunk[] }
   */
  router.post(
    "/documents/:documentId/chunks",
    auth,
    careOnly,
    async (req, res) => {
      const documentId: string = req.params.documentId as string;
      if (!documentId) return res.status(400).json({ error: "Missing documentId" });

      const chunks = (req.body?.chunks as NewChunk[] | undefined) || [];
      if (!Array.isArray(chunks)) {
        return res.status(400).json({ error: "chunks must be an array" });
      }

      // validation minimale (on évite les crashs)
      for (const c of chunks) {
        if (typeof c?.chunk_index !== "number") {
          return res.status(400).json({ error: "chunk_index must be a number" });
        }
        if (!(c.page_number === null || typeof c.page_number === "number")) {
          return res.status(400).json({ error: "page_number must be number|null" });
        }
        if (typeof c?.content !== "string" || !c.content.trim()) {
          return res.status(400).json({ error: "content must be a non-empty string" });
        }
      }

      const rows = await upsertDocumentChunks(documentId, chunks);
      res.json({ ok: true, upserted: rows.length, rows });
    }
  );

  /**
   * DELETE /api/care/documents/:documentId/chunks
   * Utile quand tu reprocess un PDF : tu vires tout puis tu ré-insères
   */
  router.delete(
    "/documents/:documentId/chunks",
    auth,
    careOnly,
    async (req, res) => {
      const documentId: string = req.params.documentId as string;
      if (!documentId) return res.status(400).json({ error: "Missing documentId" });

      await deleteChunksByDocumentId(documentId);
      res.json({ ok: true });
    }
  );

  return router;
}
