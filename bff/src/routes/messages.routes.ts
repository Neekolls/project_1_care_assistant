// bff/src/routes/messages.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import {
  listMessagesForConversationUser,
  listMessagesForConversationCare,
  addMessage,
} from "../db/repos/messages.repo";
import { pool } from "../db";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

/**
 * ==========================================
 * USER ROUTES
 * ==========================================
 */
export function buildUserMessagesRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * GET /api/messages/:conversationId
   * Lister les messages d'une conversation (user)
   */
  router.get("/:conversationId", auth, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const userId = req.user.id;

      const messages = await listMessagesForConversationUser(
        conversationId,
        userId
      );

      res.json(messages);
    } catch (err) {
      console.error("Error listing messages:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/messages/:conversationId/last-chunks
   * Récupérer les chunk_ids du dernier message BOT
   */
  router.get("/:conversationId/last-chunks", auth, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const userId = req.user.id;

      // Vérifier que la conversation appartient au user
      const convCheck = await pool.query(
        `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Récupérer le dernier message BOT avec chunk_ids
      const result = await pool.query(
        `SELECT chunk_ids 
         FROM messages 
         WHERE conversation_id = $1 AND sender_role = 'BOT'
         ORDER BY created_at DESC
         LIMIT 1`,
        [conversationId]
      );

      const chunkIds = result.rows[0]?.chunk_ids || [];
      res.json({ chunk_ids: chunkIds });

    } catch (err) {
      console.error("Error getting last chunks:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/messages/:conversationId
   * Envoyer un message USER
   * (Note: Le chat passe maintenant par /api/chat pour le bot)
   */
  router.post("/:conversationId", auth, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const userId = req.user.id;
      const { content } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "content required" });
      }

      // Vérifier que la conversation appartient au user
      const convCheck = await pool.query(
        `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await addMessage(conversationId, "USER", userId, content);

      res.json({ ok: true });
    } catch (err) {
      console.error("Error adding message:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

/**
 * ==========================================
 * CARE ROUTES
 * ==========================================
 */
export function buildCareMessagesRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  /**
   * GET /api/care/messages/:conversationId
   * Lister les messages (CARE)
   */
  router.get("/:conversationId", auth, careOnly, async (req, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const messages = await listMessagesForConversationCare(conversationId);
      res.json(messages);
    } catch (err) {
      console.error("Error listing messages:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/care/messages/:conversationId
   * Envoyer un message CARE
   */
  router.post("/:conversationId", auth, careOnly, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const userId = req.user.id;
      const { content } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "content required" });
      }

      await addMessage(conversationId, "CARE", userId, content);

      res.json({ ok: true });
    } catch (err) {
      console.error("Error adding message:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}