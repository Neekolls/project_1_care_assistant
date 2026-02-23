import { Router } from "express";
import {
  createConversation,
  listUserConversations,
  getConversationForUser,
  listCareConversations,
  getConversationForCare,
  setConversationStatus,
} from "../db/repos/conversations.repo";

import { requireAuth, requireRole } from "../auth/auth.middleware";

type ConversationsRouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

/**
 * Normalise un query param Express:
 * - Express: string | string[] | undefined
 * - Nous: string | undefined
 */
function oneQuery(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export function buildConversationsRouter(opts: ConversationsRouteOptions) {
  const router = Router();

  const auth = requireAuth(opts.jwtSecret, opts.cookieName);
  const careOnly = requireRole(["ADMIN", "CARE"]);

  // ==========================
  // USER
  // ==========================

  router.post("/", auth, async (req: any, res) => {
    const userId = req.user.id;
    const conv = await createConversation(userId);
    res.json(conv);
  });

  router.get("/", auth, async (req: any, res) => {
    const userId = req.user.id;
    const conversations = await listUserConversations(userId);
    res.json(conversations);
  });

  router.get("/:id", auth, async (req: any, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const conv = await getConversationForUser(id, userId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    res.json(conv);
  });

  // ==========================
  // CARE
  // ==========================

  /**
   * GET /api/conversations/care?priority=&status=
   * priority: ALL | ESCALATED | NORMAL
   * status: ALL | OPEN | CLOSED
   */
  router.get("/care", auth, careOnly, async (req, res) => {
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
  });

  router.get("/care/:id", auth, careOnly, async (req, res) => {
    const { id } = req.params;

    const conv = await getConversationForCare(id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    res.json(conv);
  });

  router.patch("/care/:id/status", auth, careOnly, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["OPEN", "ESCALATED", "CLOSED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await setConversationStatus(id, status);
    res.json(updated);
  });

  return router;
}
