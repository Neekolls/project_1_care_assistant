import { Router } from "express";
import {
  listMessagesForConversationUser,
  listMessagesForConversationCare,
  addMessage,
} from "../db/repos/messages.repo";

import {
  getConversationForUser,
} from "../db/repos/conversations.repo";

import { requireAuth, requireRole } from "../auth/auth.middleware";

type MessagesRouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

export function buildMessagesRouter(opts: MessagesRouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  // ==========================
  // USER ROUTES
  // ==========================

  router.get("/:conversationId", auth, async (req: any, res) => {
    const conversationId: string = req.params.conversationId as string;
    const userId: string = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ error: "Missing conversationId" });
    }

    // Vérifier que la conversation appartient au user
    const conv = await getConversationForUser(conversationId, userId);

    if (!conv) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const messages = await listMessagesForConversationUser(
      conversationId,
      userId
    );

    res.json(messages);
  });

  router.post("/:conversationId", auth, async (req: any, res) => {
    const conversationId: string = req.params.conversationId as string;
    const userId: string = req.user.id;
    const { content } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ error: "Missing data" });
    }

    const conv = await getConversationForUser(conversationId, userId);

    if (!conv) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await addMessage(conversationId, "USER", userId, content);

    res.json({ ok: true });
  });

  // ==========================
  // CARE ROUTES
  // ==========================

  router.get(
    "/care/:conversationId",
    auth,
    careOnly,
    async (req, res) => {
      const conversationId: string = req.params.conversationId as string;

      if (!conversationId) {
        return res.status(400).json({ error: "Missing conversationId" });
      }

      const messages = await listMessagesForConversationCare(
        conversationId
      );

      res.json(messages);
    }
  );

  router.post(
    "/care/:conversationId",
    auth,
    careOnly,
    async (req: any, res) => {
      const conversationId: string = req.params.conversationId as string;
      const { content } = req.body;
      const adminId: string = req.user.id;

      if (!conversationId || !content) {
        return res.status(400).json({ error: "Missing data" });
      }

      await addMessage(conversationId, "CARE", adminId, content);

      res.json({ ok: true });
    }
  );

  return router;
}
