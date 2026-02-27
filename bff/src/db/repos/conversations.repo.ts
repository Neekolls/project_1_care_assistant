import { pool } from "../../db";
import { ConversationsSQL } from "../queries/conversations.sql";

export type ConversationRow = {
  id: string;
  user_id: string;
  status: "OPEN" | "ESCALATED" | "CLOSED";
  assigned_admin_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationCareRow = ConversationRow & {
  user_email: string;
};

export type ConversationWithSummary = ConversationRow & {
  summary: string;
  summary_updated_at: string | null;
};

export type SummaryRow = {
  summary: string;
  summary_updated_at: string | null;
};

// ==========================================
// USER
// ==========================================

export async function createConversation(userId: string): Promise<ConversationRow> {
  const r = await pool.query(ConversationsSQL.create, [userId]);
  return r.rows[0];
}

export async function getConversationForUser(
  conversationId: string,
  userId: string
): Promise<ConversationRow | null> {
  const r = await pool.query(ConversationsSQL.getForUser, [conversationId, userId]);
  return r.rows[0] || null;
}

export async function listUserConversations(userId: string): Promise<ConversationRow[]> {
  const r = await pool.query(ConversationsSQL.listForUser, [userId]);
  return r.rows;
}

// ==========================================
// CARE
// ==========================================

export async function getConversationForCare(
  conversationId: string
): Promise<ConversationCareRow | null> {
  const r = await pool.query(ConversationsSQL.getForCare, [conversationId]);
  return r.rows[0] || null;
}

export async function listCareConversations(
  priority: "ALL" | "ESCALATED" | "NORMAL",
  status: "ALL" | "OPEN" | "CLOSED"
): Promise<ConversationCareRow[]> {
  const r = await pool.query(ConversationsSQL.listForCare, [priority, status]);
  return r.rows;
}

export async function setConversationStatus(
  conversationId: string,
  status: "OPEN" | "ESCALATED" | "CLOSED"
): Promise<ConversationRow> {
  const r = await pool.query(ConversationsSQL.setStatus, [conversationId, status]);
  return r.rows[0];
}

// ==========================================
// SUMMARY (nouvelles fonctions)
// ==========================================

/**
 * Récupérer uniquement le résumé d'une conversation
 * Utilisé par Python pour construire le contexte
 */
export async function getConversationSummary(
  conversationId: string
): Promise<SummaryRow | null> {
  const r = await pool.query(ConversationsSQL.getSummary, [conversationId]);
  return r.rows[0] || null;
}

/**
 * Mettre à jour le résumé d'une conversation
 * Appelé par Python (via route CARE) tous les 10 messages USER
 */
export async function updateConversationSummary(
  conversationId: string,
  summary: string
): Promise<SummaryRow> {
  const r = await pool.query(ConversationsSQL.updateSummary, [
    conversationId,
    summary,
  ]);
  return r.rows[0];
}

/**
 * Récupérer conversation complète avec résumé
 * Utilisé par Python pour avoir toutes les infos d'un coup
 */
export async function getConversationWithSummary(
  conversationId: string
): Promise<ConversationWithSummary | null> {
  const r = await pool.query(ConversationsSQL.getWithSummary, [conversationId]);
  return r.rows[0] || null;
}