// bff/src/routes/escalations.routes.ts
import { Router } from "express";
import { requestEscalation } from "../db/repos/escalations.repo";
import { getConversationForUser } from "../db/repos/conversations.repo";
import { requireAuth } from "../auth/auth.middleware";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

/**
 * ==========================================
 * USER ROUTES UNIQUEMENT
 * ==========================================
 * Montées sur /api/escalations
 * 
 * Les CARE n'ont pas besoin de route d'escalation,
 * ils gèrent directement le statut via PATCH /api/care/conversations/:id/status
 */
export function buildUserEscalationsRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * POST /api/escalations/:conversationId
   * User demande une escalade
   * 
   * Cette route :
   * 1. Vérifie que la conversation appartient au user
   * 2. Insère une ligne dans escalations (avec ON CONFLICT pour éviter les doublons)
   * 3. Passe la conversation en statut ESCALATED
   */
  router.post("/:conversationId", auth, async (req: any, res) => {
    try {
      const conversationId: string = req.params.conversationId;
      const userId: string = req.user.id;

      if (!conversationId) {
        return res.status(400).json({ error: "Missing conversationId" });
      }

      // Vérifier que la conversation appartient au user
      const conv = await getConversationForUser(conversationId, userId);

      if (!conv) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await requestEscalation(conversationId, userId);
      res.json(result);
    } catch (err) {
      console.error("Error escalating conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}