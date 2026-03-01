// bff/src/routes/documents.routes.ts
import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import axios from "axios";
import { pool } from "../db";

// Repos
import {
  createDocument,
  getDocumentByIdCare,
  getDocumentByIdUser,
  listDocumentsForUser,
  listDocumentsForCare,
  deleteDocument,
} from "../db/repos/documents.repo";

import {
  upsertDocumentChunks,
  deleteChunksByDocumentId,
} from "../db/repos/document_chunks.repo";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

// Type pour les params de route avec ID
type DocumentParams = {
  id: string;
};

// ==========================================
// MULTER CONFIG
// ==========================================
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const PYTHON_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

// ==========================================
// USER ROUTES
// ==========================================
export function buildUserDocumentsRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * POST /api/documents/upload
   */
  router.post("/upload", auth, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      if (!req.user || !req.user.id) {
        console.error("❌ Auth error: req.user =", req.user);
        return res.status(401).json({ error: "Not authenticated or missing user ID" });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      let visibility = "USER_SPECIFIC";

      if (userRole === "ADMIN" || userRole === "CARE") {
        visibility = req.body.visibility || "PUBLIC";
      }

      console.log(`📤 Upload debug:`);
      console.log(`   - userId: ${userId}`);
      console.log(`   - userRole: ${userRole}`);
      console.log(`   - visibility: ${visibility}`);

      const document = await createDocument(
        req.file.originalname,
        req.file.mimetype,
        req.file.filename,
        visibility as any,
        userId
      );

      const pythonRes = await axios.post(
        `${PYTHON_URL}/process-pdf`,
        {
          document_id: document.id,
          file_path: req.file.path,
          visibility,
          owner_user_id: userId,
        },
        { timeout: 120000 }
      );

      const chunks = pythonRes.data.chunks;
      if (chunks && chunks.length > 0) {
        await upsertDocumentChunks(document.id, chunks);
        console.log(`✅ ${chunks.length} chunks stored in DB`);
      }

      res.json({
        ok: true,
        document,
        chunks_created: pythonRes.data.chunks_created,
      });
    } catch (err: any) {
      console.error("❌ Upload error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/documents
   */
  router.get("/", auth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const docs = await listDocumentsForUser(req.user.id);
      res.json(docs);
    } catch (err: any) {
      console.error("Error listing documents:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/documents/:id
   */
  router.get("/:id", auth, async (req: Request<DocumentParams>, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const doc = await getDocumentByIdUser(req.params.id, req.user.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (err: any) {
      console.error("Error getting document:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

// ==========================================
// CARE ROUTES
// ==========================================
export function buildCareDocumentsRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const care = requireRole(["ADMIN", "CARE"]);

  /**
   * GET /api/care/documents
   */
  router.get("/", auth, care, async (req: Request, res: Response) => {
    try {
      const docs = await listDocumentsForCare();
      res.json(docs);
    } catch (err: any) {
      console.error("Error listing documents:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/care/documents/:id
   */
  router.get("/:id", auth, care, async (req: Request<DocumentParams>, res: Response) => {
    try {
      const doc = await getDocumentByIdCare(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (err: any) {
      console.error("Error getting document:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PATCH /api/care/documents/:id/visibility
   * Modifier visibilité + owner
   * Body: { visibility: "PUBLIC" | "ADMIN_ONLY" | "USER_SPECIFIC", owner_user_id?: string }
   */
  router.patch("/:id/visibility", auth, care, async (req: Request<DocumentParams>, res: Response) => {
    try {
      const { visibility, owner_user_id } = req.body;

      if (!["PUBLIC", "ADMIN_ONLY", "USER_SPECIFIC"].includes(visibility)) {
        return res.status(400).json({
          error: "Invalid visibility",
        });
      }

      // Validation : USER_SPECIFIC nécessite owner_user_id
      if (visibility === "USER_SPECIFIC" && !owner_user_id) {
        return res.status(400).json({
          error: "owner_user_id required for USER_SPECIFIC",
        });
      }

      // Récupérer ancien document pour connaître ancienne visibilité
      const oldDoc = await getDocumentByIdCare(req.params.id);
      if (!oldDoc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Mettre à jour en DB
      const result = await pool.query(
        `UPDATE documents 
         SET visibility = $1, 
             owner_user_id = $2,
             updated_at = NOW() 
         WHERE id = $3 
         RETURNING *`,
        [
          visibility,
          visibility === "USER_SPECIFIC" ? owner_user_id : null,
          req.params.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Document not found" });
      }

      const updatedDoc = result.rows[0];

      console.log(`✅ Document ${req.params.id} visibility → ${visibility}` + 
                  (owner_user_id ? ` (owner: ${owner_user_id})` : ""));

      // Appeler Python pour déplacer dans FAISS
      try {
        await axios.patch(
          `${PYTHON_URL}/documents/${req.params.id}/visibility`,
          {
            document_id: req.params.id,
            old_visibility: oldDoc.visibility,
            old_owner_user_id: oldDoc.owner_user_id,
            new_visibility: visibility,
            new_owner_user_id: visibility === "USER_SPECIFIC" ? owner_user_id : null,
          },
          { timeout: 10000 }
        );
        console.log(`✅ FAISS index updated for document ${req.params.id}`);
      } catch (pythonErr: any) {
        console.warn(`⚠️  FAISS update failed: ${pythonErr.message}`);
        // Continue quand même, la DB est à jour
      }

      res.json(updatedDoc);
    } catch (err: any) {
      console.error("Error updating visibility:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/care/documents/:id
   */
  router.delete("/:id", auth, care, async (req: Request<DocumentParams>, res: Response) => {
    try {
      const id = req.params.id;

      const doc = await getDocumentByIdCare(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Nettoyer FAISS
      try {
        await axios.delete(`${PYTHON_URL}/delete-document/${id}`, {
          timeout: 10000,
        });
        console.log(`✅ Document ${id} removed from FAISS`);
      } catch (pythonErr: any) {
        console.warn(`⚠️  FAISS cleanup failed: ${pythonErr.message}`);
      }

      // Supprimer chunks DB
      await deleteChunksByDocumentId(id);

      // Supprimer document DB
      await deleteDocument(id);

      // Supprimer fichier physique
      const filePath = path.join(uploadDir, doc.storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.log(`🗑️  Document ${id} deleted completely`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Error deleting document:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}