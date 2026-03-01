import { useEffect, useState } from "react";

import ConversationPanel from "./components/ConversationPanel";
import ChatPanel from "./components/ChatPanel";
import SourcesPanel from "./components/SourcesPanel";

import {
  AuthAPI,
  ConversationsAPI,
  MessagesAPI,
  ChatAPI,
  EscalationsAPI,
  type Conversation,
  type Me,
  type Message,
} from "./api";

export default function App() {
  // -----------------------------
  // AUTH STATES
  // -----------------------------
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("admin123");
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<string>("");

  // -----------------------------
  // CONVERSATIONS STATES
  // -----------------------------
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  
  // Filtres ADMIN
  const [users, setUsers] = useState<Array<{id: string, email: string}>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // -----------------------------
  // MESSAGES STATES
  // -----------------------------
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  // -----------------------------
  // UI STATES
  // -----------------------------
  const [sourcesVisible, setSourcesVisible] = useState(true);
  
  // -----------------------------
  // CITATIONS (derniers chunk_ids utilisés)
  // -----------------------------
  const [lastChunkIds, setLastChunkIds] = useState<string[]>([]);

  // -----------------------------
  // AUTH ACTIONS
  // -----------------------------
  async function refreshMe() {
    const j = await AuthAPI.me();
    setMe(j);
  }

  async function login() {
    setMsg("");
    try {
      await AuthAPI.login(email, password);
      await refreshMe();
    } catch (e: any) {
      setMsg(e?.message || "Login failed");
    }
  }

  async function register() {
    setMsg("");
    try {
      await AuthAPI.register(email, password);
      await refreshMe();
    } catch (e: any) {
      setMsg(e?.message || "Register failed");
    }
  }

  async function logout() {
    try {
      await AuthAPI.logout();
    } finally {
      setMe({ ok: false });
      setConversations([]);
      setSelectedConversationId(null);
      setConvError(null);
      setConvLoading(false);
      setMessages([]);
      setMsgError(null);
      setMsgLoading(false);
    }
  }

  // -----------------------------
  // CONVERSATIONS ACTIONS
  // -----------------------------
  async function loadUsers() {
    try {
      const response = await fetch("/api/care/users", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Failed to load users:", e);
    }
  }

  async function loadConversations() {
    setConvError(null);
    setConvLoading(true);

    try {
      if (me?.user?.role === "ADMIN" || me?.user?.role === "CARE") {
        const items = await ConversationsAPI.listCare({ priority: "ALL", status: "ALL" });
        setConversations(items as any);
      } else {
        const items = await ConversationsAPI.listMine();
        setConversations(items);
      }
    } catch (e: any) {
      setConvError(e?.message || "Failed to load conversations");
    } finally {
      setConvLoading(false);
    }
  }

  async function createNewConversation() {
    setConvError(null);

    try {
      const created = await ConversationsAPI.create();
      await loadConversations();
      setSelectedConversationId(created.id);
      setMessages([]);
      setMsgError(null);
    } catch (e: any) {
      setConvError(e?.message || "Failed to create conversation");
    }
  }

  // -----------------------------
  // MESSAGES ACTIONS
  // -----------------------------
  async function loadMessages(conversationId: string) {
    setMsgError(null);
    setMsgLoading(true);
    try {
      let rows: Message[];
      
      if (me?.user?.role === "ADMIN" || me?.user?.role === "CARE") {
        rows = await MessagesAPI.listCare(conversationId);
      } else {
        rows = await MessagesAPI.listMine(conversationId);
      }
      
      setMessages(rows);
      
      // Charger les derniers chunk_ids pour les citations
      try {
        const lastChunks = await MessagesAPI.getLastChunks(conversationId);
        setLastChunkIds(lastChunks.chunk_ids || []);
      } catch (e) {
        console.warn("Could not load last chunks:", e);
        setLastChunkIds([]);
      }
    } catch (e: any) {
      setMsgError(e?.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }

  async function sendMessage(conversationId: string, content: string) {
    setMsgError(null);

    try {
      const response = await ChatAPI.send(conversationId, content);
      
      // Stocker les chunks utilisés pour affichage dans Citations
      setLastChunkIds(response.chunk_ids || []);
      
      await loadMessages(conversationId);
      await loadConversations();
      
      if (response.chunk_ids.length > 0) {
        console.log("📚 Sources RAG:", response.chunk_ids);
      }
      
      if (response.summary_updated) {
        console.log("🧠 Résumé mis à jour");
      }
    } catch (e: any) {
      setMsgError(e?.message || "Failed to send message");
    }
  }

  // -----------------------------
  // ESCALADE ACTION
  // -----------------------------
  async function handleEscalate(conversationId: string) {
    try {
      await EscalationsAPI.request(conversationId);
      
      // Mettre à jour le statut localement
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId
            ? { ...c, status: "ESCALATED" }
            : c
        )
      );
      
      // Recharger les messages pour voir l'alerte
      if (selectedConversationId === conversationId) {
        await loadMessages(conversationId);
      }
      
      console.log("🚨 Escalade demandée pour", conversationId);
    } catch (e: any) {
      setMsgError(e?.message || "Erreur lors de l'escalade");
    }
  }

  // -----------------------------
  // DELETE CONVERSATION (ADMIN)
  // -----------------------------
  async function handleDeleteConversation(conversationId: string) {
    try {
      const response = await fetch(`/api/care/conversations/${conversationId}`, {
        method: "DELETE",
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }
      
      // Retirer de la liste
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // Si c'était la conversation sélectionnée, déselectionner
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
      
      console.log("🗑️  Conversation supprimée:", conversationId);
    } catch (e: any) {
      setConvError(e?.message || "Erreur lors de la suppression");
    }
  }

  // -----------------------------
  // CHANGE STATUS (ADMIN)
  // -----------------------------
  async function handleChangeStatus(conversationId: string, newStatus: "OPEN" | "ESCALATED" | "CLOSED") {
    try {
      const response = await fetch(`/api/care/conversations/${conversationId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      
      // Mettre à jour localement
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId
            ? { ...c, status: newStatus }
            : c
        )
      );
      
      console.log(`✅ Conversation ${conversationId} → ${newStatus}`);
    } catch (e: any) {
      setConvError(e?.message || "Erreur lors du changement de statut");
    }
  }

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------
  useEffect(() => {
    refreshMe();
  }, []);

  const isLoggedIn = !!me?.ok && !!me.user;

  useEffect(() => {
    if (isLoggedIn) {
      loadConversations();
      
      // Charger users si ADMIN/CARE
      if (me?.user?.role === "ADMIN" || me?.user?.role === "CARE") {
        loadUsers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && selectedConversationId) {
      loadMessages(selectedConversationId);
    } else {
      setMessages([]);
      setMsgError(null);
      setMsgLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, selectedConversationId]);

  // -----------------------------
  // RENDER
  // -----------------------------
  if (isLoggedIn) {
    // Filtrer conversations côté client
    const filteredConversations = conversations.filter(c => {
      // Filtre par user
      if (selectedUserId !== "ALL") {
        if ((c as any).user_id !== selectedUserId) return false;
      }
      
      // Filtre par status
      if (selectedStatus !== "ALL") {
        if (c.status !== selectedStatus) return false;
      }
      
      return true;
    });

    return (
      <div className="h-screen bg-gray-50 text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Care Assistant — MVP</div>
            <div className="text-xs text-gray-500">
              {me?.user?.email} • {me?.user?.role}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={loadConversations}
              title="Recharger la liste des conversations"
            >
              Reload conv
            </button>

            <button
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={refreshMe}
              title="Rafraîchir la session"
            >
              Refresh /me
            </button>

            <button
              className="rounded-lg bg-black px-3 py-2 text-sm text-white"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>

        {/* 3 columns (avec toggle sources) */}
        <div className="flex h-[calc(100vh-57px)]">
          <div className="w-[320px] border-r bg-white">
            <ConversationPanel
              items={filteredConversations}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
              onCreate={createNewConversation}
              onEscalate={me?.user?.role === "USER" ? handleEscalate : undefined}
              onDelete={me?.user?.role === "ADMIN" || me?.user?.role === "CARE" ? handleDeleteConversation : undefined}
              onChangeStatus={me?.user?.role === "ADMIN" || me?.user?.role === "CARE" ? handleChangeStatus : undefined}
              loading={convLoading}
              error={convError}
              isAdmin={me?.user?.role === "ADMIN" || me?.user?.role === "CARE"}
              users={users}
              selectedUserId={selectedUserId}
              onUserFilterChange={setSelectedUserId}
              selectedStatus={selectedStatus}
              onStatusFilterChange={setSelectedStatus}
            />
          </div>

          <div className="flex-1">
            <ChatPanel
              selectedConversationId={selectedConversationId}
              conversationStatus={
                conversations.find(c => c.id === selectedConversationId)?.status
              }
              messages={messages}
              loading={msgLoading}
              error={msgError}
              onSend={sendMessage}
            />
          </div>

          {/* Sources Panel avec toggle */}
          {sourcesVisible ? (
            <div className="w-[360px] border-l bg-white">
              <SourcesPanel 
                isVisible={sourcesVisible}
                onToggle={() => setSourcesVisible(!sourcesVisible)}
                userRole={me?.user?.role}
                lastChunkIds={lastChunkIds}
              />
            </div>
          ) : (
            <SourcesPanel 
              isVisible={sourcesVisible}
              onToggle={() => setSourcesVisible(!sourcesVisible)}
              userRole={me?.user?.role}
              lastChunkIds={lastChunkIds}
            />
          )}
        </div>
      </div>
    );
  }

  // Login/register screen
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">Care Assistant — MVP</h1>

        <div className="mt-6 rounded-2xl bg-white p-4 shadow">
          <div className="text-sm font-medium mb-2">Login / Register</div>

          <div className="grid gap-2">
            <input
              className="rounded-lg border p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
            />

            <input
              className="rounded-lg border p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
            />

            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg bg-black px-3 py-2 text-white" onClick={login}>
                Login
              </button>

              <button className="rounded-lg border px-3 py-2" onClick={register}>
                Register
              </button>

              <button className="rounded-lg border px-3 py-2" onClick={refreshMe}>
                Refresh /me
              </button>
            </div>

            {msg && <div className="text-sm text-red-600">{msg}</div>}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow">
          <div className="text-sm font-medium mb-2">Session</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(me, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}