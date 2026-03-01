// bff/src/routes/chat.routes.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { addMessage } from "../db/repos/messages.repo";
import { getConversationForUser } from "../db/repos/conversations.repo";

type RouteOptions = {
  jwtSecret: string;
  cookieName: string;
};

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export function buildChatRouter(opts: RouteOptions) {
  const router = Router();
  const auth = requireAuth(opts.jwtSecret, opts.cookieName);

  /**
   * POST /api/chat
   * Envoyer un message et recevoir réponse du bot
   */
  router.post("/", auth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId: string = req.user.id;
      const userRole: string = req.user.role;
      const { conversationId, message } = req.body;

      // Validation
      if (!conversationId || !message) {
        return res.status(400).json({ 
          error: "conversationId and message required" 
        });
      }

      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ 
          error: "message must be a non-empty string" 
        });
      }

      // Vérifier accès à la conversation
      let conversation;
      
      if (userRole === "ADMIN" || userRole === "CARE") {
        // ADMIN/CARE : accès à toutes les conversations
        const { getConversationForCare } = require("../db/repos/conversations.repo");
        conversation = await getConversationForCare(conversationId);
      } else {
        // USER : seulement ses conversations
        conversation = await getConversationForUser(conversationId, userId);
      }
      
      if (!conversation) {
        return res.status(404).json({ 
          error: "Conversation not found" 
        });
      }

      // ADMIN/CARE envoient des messages avec sender_role CARE
      const senderRole = (userRole === "ADMIN" || userRole === "CARE") ? "CARE" : "USER";

      // 1. Stocker le message en DB
      await addMessage(conversationId, senderRole, userId, message.trim());

      // ✅ ADMIN/CARE ne déclenchent JAMAIS le bot
      if (senderRole === "CARE") {
        return res.json({
          answer: null,
          chunk_ids: [],
          summary_updated: false,
          bot_disabled: true,
          reason: "Message envoyé par un agent"
        });
      }

      // ✅ Si conversation escaladée ou fermée → Pas de réponse bot
      if (conversation.status === "ESCALATED") {
        return res.json({
          answer: null,
          chunk_ids: [],
          summary_updated: false,
          bot_disabled: true,
          reason: "Conversation escaladée - En attente d'un agent humain"
        });
      }

      if (conversation.status === "CLOSED") {
        return res.json({
          answer: null,
          chunk_ids: [],
          summary_updated: false,
          bot_disabled: true,
          reason: "Conversation fermée"
        });
      }

      // 2. Récupérer l'historique complet pour Python
      const { listMessagesForConversationUser, listMessagesForConversationCare } = 
        require("../db/repos/messages.repo");
      
      let allMessages;
      if (conversation.user_id === userId) {
        allMessages = await listMessagesForConversationUser(conversationId, userId);
      } else {
        allMessages = await listMessagesForConversationCare(conversationId);
      }

      // 🔍 DEBUG : Compter messages USER
      const userMessageCount = allMessages.filter((m: any) => m.sender_role === "USER").length;
      console.log(`📊 BFF sending ${allMessages.length} total messages (${userMessageCount} USER) to Python`);

      // 3. Appeler le backend Python avec TOUT l'historique
      const pythonResponse = await fetch(`${PYTHON_BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_id: userId,
          user_role: userRole,  // ← AJOUTÉ pour filtrage FAISS
          message: message.trim(),
          history: allMessages,  // ← TOUT l'historique
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error("Python backend error:", errorText);
        throw new Error(`Python backend returned ${pythonResponse.status}`);
      }

      const pythonData = await pythonResponse.json();

      // 4. Stocker la réponse BOT en DB avec chunk_ids
      await addMessage(
        conversationId, 
        "BOT", 
        null, 
        pythonData.answer,
        pythonData.chunk_ids || []
      );

      // 5. Renvoyer la réponse au frontend
      res.json({
        answer: pythonData.answer,
        chunk_ids: pythonData.chunk_ids || [],
        summary_updated: pythonData.summary_updated || false,
      });

    } catch (err: any) {
      console.error("Error in chat route:", err);
      
      if (err.message?.includes("fetch") || err.code === "ECONNREFUSED") {
        return res.status(503).json({ 
          error: "AI backend unavailable. Please ensure Python backend is running." 
        });
      }

      res.status(500).json({ 
        error: err.message || "Internal server error" 
      });
    }
  });

  return router;
}