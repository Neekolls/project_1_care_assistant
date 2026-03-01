// frontend/src/api.ts

// -----------------------------
// Types communs
// -----------------------------
export type Role = "USER" | "ADMIN" | "CARE";
export type ConversationStatus = "OPEN" | "ESCALATED" | "CLOSED";
export type DocVisibility = "ADMIN_ONLY" | "USER_SPECIFIC" | "PUBLIC";

export type Me = {
  ok: boolean;
  user?: { id: string; email: string; role: Role };
  error?: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  status: ConversationStatus;
  assigned_admin_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationCare = Conversation & {
  user_email: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_role: "USER" | "CARE" | "BOT";
  sender_user_id: string | null;
  content: string;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  filename: string;
  mime_type: string;
  storage_path: string;
  visibility: DocVisibility;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChunkSource = {
  chunk_id: string;
  document_id: string;
  filename: string;
  page_number: number | null;
  chunk_index: number;
  content: string;
  visibility: DocVisibility;
  owner_user_id: string | null;
};

export type NewChunk = {
  chunk_index: number;
  page_number: number | null;
  content: string;
};

// -----------------------------
// Helper unique pour toutes les requêtes
// -----------------------------
type ApiError = { status: number; message: string };

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const hasBody = init.body !== undefined && init.body !== null;

  // On met JSON par défaut si body existe et que ce n'est pas du FormData
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (hasBody && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    ...init,
    credentials: "include", // ✅ indispensable pour envoyer le cookie
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  // Si erreur HTTP, on tente de récupérer un message lisible
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      message = j?.detail || j?.error || message;
    } catch {
      // ignore
    }
    const err: ApiError = { status: res.status, message };
    throw err;
  }

  // Certaines routes peuvent renvoyer vide → on protège
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as unknown as T;
  }
}

// -----------------------------
// AUTH + ME
// -----------------------------
export const AuthAPI = {
  login: (email: string, password: string) =>
    request<{ ok: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<{ ok: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
    }),

  me: () => request<Me>("/api/me"),
};

// -----------------------------
// CONVERSATIONS
// -----------------------------
export const ConversationsAPI = {
  // ==========================================
  // USER ROUTES
  // ==========================================
  listMine: () => request<Conversation[]>("/api/conversations"),
  
  create: () =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: "{}",
    }),
  
  getMine: (conversationId: string) =>
    request<Conversation>(`/api/conversations/${conversationId}`),

  // ==========================================
  // CARE ROUTES (✅ CORRIGÉ)
  // ==========================================
  listCare: (params?: { 
    priority?: "ALL" | "ESCALATED" | "NORMAL"; 
    status?: "ALL" | "OPEN" | "CLOSED" 
  }) => {
    const qs = new URLSearchParams();
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    // ✅ AVANT: /api/conversations/care → APRÈS: /api/care/conversations
    return request<ConversationCare[]>(`/api/care/conversations${suffix}`);
  },
  
  getCare: (conversationId: string) =>
    // ✅ AVANT: /api/conversations/care/:id → APRÈS: /api/care/conversations/:id
    request<ConversationCare>(`/api/care/conversations/${conversationId}`),
  
  setStatus: (conversationId: string, status: ConversationStatus) =>
    // ✅ AVANT: /api/conversations/care/:id/status → APRÈS: /api/care/conversations/:id/status
    request<Conversation>(`/api/care/conversations/${conversationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// -----------------------------
// MESSAGES
// -----------------------------
export const MessagesAPI = {
  // ==========================================
  // USER ROUTES
  // ==========================================
  listMine: (conversationId: string) =>
    request<Message[]>(`/api/messages/${conversationId}`),
  
  sendMine: (conversationId: string, content: string) =>
    request<{ ok: boolean }>(`/api/messages/${conversationId}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // ==========================================
  // CARE ROUTES (✅ CORRIGÉ)
  // ==========================================
  listCare: (conversationId: string) =>
    // ✅ AVANT: /api/messages/care/:id → APRÈS: /api/care/messages/:id
    request<Message[]>(`/api/care/messages/${conversationId}`),
  
  sendCare: (conversationId: string, content: string) =>
    // ✅ AVANT: /api/messages/care/:id → APRÈS: /api/care/messages/:id
    request<{ ok: boolean }>(`/api/care/messages/${conversationId}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
    getLastChunks: (conversationId: string) =>
        request<{ chunk_ids: string[] }>(`/api/messages/${conversationId}/last-chunks`),
};
export const ChatAPI = {
  /**
   * Envoyer un message et recevoir réponse du bot
   */
  send: (conversationId: string, message: string) =>
    request<{
      answer: string;
      chunk_ids: string[];
      summary_updated: boolean;
    }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId, message }),
    }),
};

// -----------------------------
// ESCALATIONS
// -----------------------------
export const EscalationsAPI = {
  request: (conversationId: string) =>
    request<{ escalation: any; conversation: Conversation }>(
      `/api/escalations/${conversationId}`,
      { method: "POST" }
    ),
};

// -----------------------------
// DOCUMENTS
// -----------------------------
export const DocumentsAPI = {
  // ==========================================
  // USER ROUTES
  // ==========================================
  listMine: () => request<DocumentRow[]>("/api/documents"),
  
  getMine: (documentId: string) =>
    request<DocumentRow>(`/api/documents/${documentId}`),

  // Note: Pour l'instant, pas de route POST /api/documents pour les users
  // Si tu veux que les users uploadent leurs propres docs, il faudra l'ajouter

  // ==========================================
  // CARE ROUTES
  // ==========================================
  listCare: () => request<DocumentRow[]>("/api/care/documents"),
  
  getCare: (documentId: string) =>
    request<DocumentRow>(`/api/care/documents/${documentId}`),
  
  createCare: (payload: {
    filename: string;
    storagePath: string;
    visibility: DocVisibility;
    mimeType?: string;
    ownerUserId?: string | null;
  }) =>
    request<DocumentRow>("/api/care/documents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  
  deleteCare: (documentId: string) =>
    request<{ ok: boolean }>(`/api/care/documents/${documentId}`, {
      method: "DELETE",
    }),
  updateVisibility: async (
    docId: string, 
    visibility: string,
    ownerUserId?: string
  ) => {
    const body: any = { visibility };
    
    // Si USER_SPECIFIC, envoyer owner_user_id
    if (visibility === "USER_SPECIFIC" && ownerUserId) {
      body.owner_user_id = ownerUserId;
    }
    
    const res = await fetch(`/api/care/documents/${docId}/visibility`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) throw new Error("Failed to update visibility");
    return res.json();
  },
};

// -----------------------------
// DOCUMENT CHUNKS (CARE uniquement)
// -----------------------------
export const DocumentChunksAPI = {
  listCare: (documentId: string) =>
    request<any[]>(`/api/care/documents/${documentId}/chunks`),

  upsertCare: (documentId: string, chunks: NewChunk[]) =>
    request<{ ok: boolean; upserted: number; rows: any[] }>(
      `/api/care/documents/${documentId}/chunks`,
      {
        method: "POST",
        body: JSON.stringify({ chunks }),
      }
    ),

  deleteCare: (documentId: string) =>
    request<{ ok: boolean }>(`/api/care/documents/${documentId}/chunks`, {
      method: "DELETE",
    }),
};

// -----------------------------
// RAG SOURCES (✅ CORRIGÉ)
// -----------------------------
export const RagAPI = {
  // ✅ AVANT: /api/rag/sources → APRÈS: /api/sources
  sourcesMine: (chunkIds: string[]) =>
    request<ChunkSource[]>("/api/sources", {
      method: "POST",
      body: JSON.stringify({ chunkIds }),
    }),

  // ✅ AVANT: /api/care/rag/sources → APRÈS: /api/care/sources
  sourcesCare: (chunkIds: string[]) =>
    request<ChunkSource[]>("/api/care/sources", {
      method: "POST",
      body: JSON.stringify({ chunkIds }),
    }),
};