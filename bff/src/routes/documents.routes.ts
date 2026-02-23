import { Router } from "express";
import {
  createDocument,
  deleteDocument,
  getDocumentByIdCare,
  getDocumentByIdUser,
  listDocumentsForCare,
  listDocumentsForUser,
} from "../db/repos/documents.repo";

import { requireAuth, requireRole } from "../auth/auth.middleware";

type DocumentsRouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

export function buildDocumentsRouter(opts: DocumentsRouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  // ==========================
  // USER ROUTES
  // ==========================

  // GET /api/documents
  router.get("/", auth, async (req: any, res) => {
    const userId: string = req.user.id;
    const docs = await listDocumentsForUser(userId);
    res.json(docs);
  });

  // GET /api/documents/:id
  router.get("/:id", auth, async (req: any, res) => {
    const id: string = req.params.id as string;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const userId: string = req.user.id;

    const doc = await getDocumentByIdUser(id, userId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    res.json(doc);
  });

  return router;
}

/**
 * CARE ROUTES (séparées)
 */
export function buildCareDocumentsRouter(opts: DocumentsRouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  // GET /api/care/documents
  router.get("/", auth, careOnly, async (_req, res) => {
    const docs = await listDocumentsForCare();
    res.json(docs);
  });

  // GET /api/care/documents/:id
  router.get("/:id", auth, careOnly, async (req, res) => {
    const id: string = req.params.id as string;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const doc = await getDocumentByIdCare(id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    res.json(doc);
  });
  // POST /api/documents (USER)
    // crée un document "user-specific" automatiquement
  router.post("/", auth, async (req: any, res) => {
    const userId: string = req.user.id;

    const { filename, mimeType, storagePath } = req.body || {};
    if (!filename || !storagePath) {
        return res.status(400).json({ error: "Missing data" });
    }

    // Force les règles USER
    const doc = await createDocument(
        filename,
        mimeType || "application/pdf",
        storagePath,
        "USER_SPECIFIC",
        userId
    );

    res.json(doc);
    });


  // POST /api/care/documents
  router.post("/", auth, careOnly, async (req, res) => {
    const { filename, mimeType, storagePath, visibility, ownerUserId } =
      req.body || {};

    if (!filename || !storagePath || !visibility) {
      return res.status(400).json({ error: "Missing data" });
    }

    if (!["ADMIN_ONLY", "USER_SPECIFIC", "PUBLIC"].includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility" });
    }

    const owner =
      visibility === "USER_SPECIFIC" ? (ownerUserId as string) : null;

    const doc = await createDocument(
      filename,
      mimeType || "application/pdf",
      storagePath,
      visibility,
      owner || null
    );

    res.json(doc);
  });

  // DELETE /api/care/documents/:id
  router.delete("/:id", auth, careOnly, async (req, res) => {
    const id: string = req.params.id as string;
    if (!id) return res.status(400).json({ error: "Missing id" });

    await deleteDocument(id);
    res.json({ ok: true });
  });

  return router;
}
