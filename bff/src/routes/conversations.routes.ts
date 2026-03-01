// bff/src/routes/conversations.routes.ts
import { Router } from "express";
import {
  createConversation,
  listUserConversations,
  getConversationForUser,
  listCareConversations,
  getConversationForCare,
  setConversationStatus,
  getConversationSummary,
  updateConversationSummary,
  getConversationWithSummary,
} from "../db/repos/conversations.repo";

import { requireAuth, requireRole } from "../auth/auth.middleware";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

function oneQuery(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

/**
 * ==========================================
 * USER ROUTES
 * ==========================================
 * Montées sur /api/conversations
 */
export function buildUserConversationsRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * POST /api/conversations
   * Créer une nouvelle conversation
   */
  router.post("/", auth, async (req: any, res) => {
    try {
      const userId: string = req.user.id;
      const conv = await createConversation(userId);
      res.json(conv);
    } catch (err) {
      console.error("Error creating conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/conversations
   * Lister toutes les conversations du user
   */
  router.get("/", auth, async (req: any, res) => {
    try {
      const userId: string = req.user.id;
      const conversations = await listUserConversations(userId);
      res.json(conversations);
    } catch (err) {
      console.error("Error listing conversations:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/conversations/:id
   * Récupérer une conversation spécifique du user
   */
  router.get("/:id", auth, async (req: any, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const userId: string = req.user.id;
      const conv = await getConversationForUser(id, userId);

      if (!conv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(conv);
    } catch (err) {
      console.error("Error getting conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

/**
 * ==========================================
 * CARE ROUTES
 * ==========================================
 * Montées sur /api/care/conversations
 */
export function buildCareConversationsRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  /**
   * GET /api/care/conversations
   * Lister toutes les conversations avec filtres
   * Query params:
   *   - priority: ALL | ESCALATED | NORMAL
   *   - status: ALL | OPEN | CLOSED
   */
  router.get("/", auth, careOnly, async (req, res) => {
    try {
      const rawPriority = oneQuery(req.query.priority as any);
      const rawStatus = oneQuery(req.query.status as any);

      const priority: "ALL" | "ESCALATED" | "NORMAL" =
        rawPriority === "ESCALATED" || rawPriority === "NORMAL"
          ? rawPriority
          : "ALL";

      const status: "ALL" | "OPEN" | "CLOSED" =
        rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : "ALL";

      const conversations = await listCareConversations(priority, status);
      res.json(conversations);
    } catch (err) {
      console.error("Error listing care conversations:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/care/conversations/:id
   * Récupérer une conversation spécifique (accès admin)
   */
  router.get("/:id", auth, careOnly, async (req, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const conv = await getConversationForCare(id);

      if (!conv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(conv);
    } catch (err) {
      console.error("Error getting care conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PATCH /api/care/conversations/:id/status
   * Modifier le statut d'une conversation
   * Body: { status: "OPEN" | "ESCALATED" | "CLOSED" }
   */
  router.patch("/:id/status", auth, careOnly, async (req, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const { status } = req.body;

      if (!["OPEN", "ESCALATED", "CLOSED"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await setConversationStatus(id, status);
      res.json(updated);
    } catch (err) {
      console.error("Error updating conversation status:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==========================================
  // SUMMARY ROUTES (nouvelles routes)
  // ==========================================

  /**
   * GET /api/care/conversations/:id/summary
   * Récupérer le résumé d'une conversation
   * Utilisé par Python pour construire le contexte
   */
  router.get("/:id/summary", auth, careOnly, async (req, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const summaryData = await getConversationSummary(id);

      if (!summaryData) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(summaryData);
    } catch (err) {
      console.error("Error getting conversation summary:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PATCH /api/care/conversations/:id/summary
   * Mettre à jour le résumé d'une conversation
   * Body: { summary: string }
   * 
   * ⚠️ Route appelée automatiquement par Python
   * tous les 10 messages USER (20 messages total)
   */
  router.patch("/:id/summary", auth, careOnly, async (req, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const { summary } = req.body;

      if (typeof summary !== "string") {
        return res.status(400).json({ error: "summary must be a string" });
      }

      const updated = await updateConversationSummary(id, summary);
      res.json(updated);
    } catch (err) {
      console.error("Error updating conversation summary:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/care/conversations/:id/with-summary
   * Récupérer conversation complète avec résumé
   * Utilisé par Python pour avoir toutes les infos d'un coup
   */
  router.get("/:id/with-summary", auth, careOnly, async (req, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const conv = await getConversationWithSummary(id);

      if (!conv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(conv);
    } catch (err) {
      console.error("Error getting conversation with summary:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/care/conversations/:id
   * Supprimer une conversation (cascade messages + escalations)
   */
  router.delete("/:id", auth, careOnly, async (req, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      // Importer pool pour requête directe
      const { pool } = require("../db");

      // Vérifier que la conversation existe
      const checkResult = await pool.query(
        `SELECT id FROM conversations WHERE id = $1`,
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Supprimer (cascade automatique sur messages et escalations)
      await pool.query(
        `DELETE FROM conversations WHERE id = $1`,
        [id]
      );

      console.log(`🗑️  Conversation ${id} deleted`);

      res.json({ ok: true });
    } catch (err) {
      console.error("Error deleting conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}