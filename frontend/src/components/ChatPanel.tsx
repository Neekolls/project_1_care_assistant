import { useState } from "react";

type Message = {
  id: string;
  sender_role: "USER" | "CARE" | "BOT";
  content: string;
  created_at: string;
};

type Props = {
  selectedConversationId: string | null;
  conversationStatus?: "OPEN" | "ESCALATED" | "CLOSED";
  messages: Message[];
  loading?: boolean;
  error?: string | null;
  onSend: (conversationId: string, content: string) => Promise<void>;
};

export default function ChatPanel({
  selectedConversationId,
  conversationStatus,
  messages,
  loading = false,
  error = null,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const hasSelected = !!selectedConversationId;
  const isEscalated = conversationStatus === "ESCALATED";
  const isClosed = conversationStatus === "CLOSED";

  async function handleSend() {
    if (!selectedConversationId) return;
    const content = draft.trim();
    if (!content) return;

    setDraft("");
    await onSend(selectedConversationId, content);
  }

  if (!hasSelected) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">Sélectionne une conversation à gauche.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-white p-4">
        <div className="text-sm font-semibold">Chat</div>
        <div className="text-xs text-gray-500 break-all">{selectedConversationId}</div>
        
        {/* Alerte si escaladé */}
        {isEscalated && (
          <div className="mt-2 rounded-lg border border-orange-300 bg-orange-50 p-2 text-xs text-orange-700">
            🚨 <span className="font-semibold">Conversation escaladée</span> - Le bot ne répond plus. Un agent humain va prendre en charge votre demande.
          </div>
        )}
        
        {/* Alerte si fermé */}
        {isClosed && (
          <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 p-2 text-xs text-gray-700">
            ℹ️ Cette conversation est <span className="font-semibold">fermée</span>.
          </div>
        )}
        
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500">Chargement des messages…</div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
            Aucun message pour l'instant. Envoie le premier message 👇
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={[
                "max-w-[80%] rounded-2xl border px-3 py-2 text-sm",
                m.sender_role === "USER"
                  ? "ml-auto bg-white"
                  : m.sender_role === "CARE"
                  ? "mr-auto bg-blue-50 border-blue-200"
                  : "mr-auto bg-gray-50",
              ].join(" ")}
            >
              <div className="text-[10px] text-gray-500 mb-1">
                {m.sender_role === "CARE" ? "👨‍💼 Agent" : m.sender_role} • {m.created_at}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="border-t bg-white p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border p-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder={isClosed ? "Conversation fermée" : "Écrire un message…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isClosed}
          />
          <button
            className="rounded-lg bg-black px-3 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={!draft.trim() || isClosed}
          >
            Send
          </button>
        </div>

        <div className="mt-1 text-[11px] text-gray-500">
          {isClosed
            ? "Cette conversation est fermée. Vous ne pouvez plus envoyer de messages."
            : isEscalated
            ? "Le bot ne répond plus - Un agent va vous répondre"
            : "Entrée = envoyer • Shift+Entrée = nouvelle ligne"}
        </div>
      </div>
    </div>
  );
}