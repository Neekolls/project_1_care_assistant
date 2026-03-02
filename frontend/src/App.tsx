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

// ✅ AJOUT : import du logo
import logo from "./assets/logowhite.png";

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
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([]);
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
        credentials: "include",
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
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status: "ESCALATED" } : c))
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
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }

      // Retirer de la liste
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

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
  async function handleChangeStatus(
    conversationId: string,
    newStatus: "OPEN" | "ESCALATED" | "CLOSED"
  ) {
    try {
      const response = await fetch(`/api/care/conversations/${conversationId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Mettre à jour localement
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status: newStatus } : c))
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
    const filteredConversations = conversations.filter((c) => {
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
        <div className="flex items-center justify-between border-b bg-blue-600 px-6 py-4 shadow-md">
          <div className="flex items-center gap-4">
            <div className="text-xl font-bold text-white">Easy Care</div>
            <div className="h-6 w-px bg-blue-400"></div>
            <div className="text-sm text-blue-100">
              {me?.user?.email} • {me?.user?.role}
            </div>
          </div>

          <div>
            <button
              className="rounded-lg bg-white hover:bg-blue-50 text-blue-600 font-medium px-4 py-2 text-sm transition-colors"
              onClick={logout}
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* 3 columns (avec toggle sources) */}
        <div className="flex h-[calc(100vh-73px)]">
          <div className="w-[320px] border-r bg-white">
            <ConversationPanel
              items={filteredConversations}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
              onCreate={createNewConversation}
              onEscalate={me?.user?.role === "USER" ? handleEscalate : undefined}
              onDelete={
                me?.user?.role === "ADMIN" || me?.user?.role === "CARE"
                  ? handleDeleteConversation
                  : undefined
              }
              onChangeStatus={
                me?.user?.role === "ADMIN" || me?.user?.role === "CARE"
                  ? handleChangeStatus
                  : undefined
              }
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
              conversationStatus={conversations.find((c) => c.id === selectedConversationId)?.status}
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

  // ✅ Login/register screen (logo centré en haut)
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 via-blue-300 to-white flex flex-col">
      {/* Logo en haut */}
      <div className="w-full flex justify-center pt-10">
        <img src={logo} alt="Easy Care" className="h-60 w-auto object-contain" />
      </div>

      {/* Contenu centré (card login) */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-8">
          {/* Tagline (optionnel) */}
          <div className="text-center mb-8">
            <p className="text-blue-100">Plateforme de support client intelligente</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-xl font-semibold text-gray-800 mb-6">Connexion</div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  type="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") login();
                  }}
                />
              </div>

              {msg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {msg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
                  onClick={login}
                >
                  Se connecter
                </button>

                <button
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-colors"
                  onClick={register}
                >
                  S'inscrire
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer en bas */}
      <div className="text-center pb-6 text-white text-sm">
        <p>Easy Care © 2026 - Support client simplifié</p>
      </div>
    </div>
  );
}