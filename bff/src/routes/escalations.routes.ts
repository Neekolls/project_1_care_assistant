import { Router } from "express";
import { requestEscalation } from "../db/repos/escalations.repo";
import { getConversationForUser } from "../db/repos/conversations.repo";
import { requireAuth } from "../auth/auth.middleware";

type EscalationsRouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

export function buildEscalationsRouter(opts: EscalationsRouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * POST /api/escalations/:conversationId
   * User demande une escalade
   */
  router.post("/:conversationId", auth, async (req: any, res) => {
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

    try {
      const result = await requestEscalation(conversationId, userId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: "Escalation failed" });
    }
  });

  return router;
}
