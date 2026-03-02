import { useState, useRef, useEffect } from "react";

// Fonction utilitaire pour formatter les dates
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

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
  const [botThinking, setBotThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const hasSelected = !!selectedConversationId;
  const isEscalated = conversationStatus === "ESCALATED";
  const isClosed = conversationStatus === "CLOSED";

  // Fonction pour scroller en bas avec animation
  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Auto-scroll au chargement et quand messages changent
  useEffect(() => {
    scrollToBottom();
  }, [messages, botThinking]);

  // Scroll aussi au changement de conversation
  useEffect(() => {
    scrollToBottom();
  }, [selectedConversationId]);

  // Fonction pour parser le markdown simple
  function parseMarkdown(text: string): string {
  return text
    // Titres # → <h2>
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>')
    // Sous-titres avec : (ex: "Préparation:") → <div>
    .replace(/^([^-•\n]+):$/gm, '<div class="font-semibold mt-3 mb-1">$1 :</div>')
    // Gras **texte** → <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Listes - FIX: plus de <li> sinon double bullet
    .replace(/^[•\-]\s*(.+)$/gm, (_match, content) => {
      const clean = content.replace(/^[•\-]\s*/, "");
      return `<div class="ml-4 my-0.5">• ${clean}</div>`;
    })
    // Sauts de ligne simples → <br>
    .replace(/\n/g, '<br/>');
}

  async function handleSend() {
    if (!selectedConversationId) return;
    const content = draft.trim();
    if (!content) return;

    setDraft("");
    setBotThinking(true);
    
    try {
      await onSend(selectedConversationId, content);
    } finally {
      setBotThinking(false);
    }
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
            <span className="font-semibold">Conversation escaladée</span> - Le bot ne répond plus. Un agent humain va prendre en charge votre demande.
          </div>
        )}
        
        {/* Alerte si fermé */}
        {isClosed && (
          <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 p-2 text-xs text-gray-700">
            Cette conversation est <span className="font-semibold">fermée</span>.
          </div>
        )}
        
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>

      <div 
        ref={scrollContainerRef} 
        className="flex-1 overflow-auto p-4 space-y-3"
        style={{ scrollBehavior: "smooth" }}
      >
        {loading ? (
          <div className="text-sm text-gray-500">Chargement des messages…</div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
            Aucun message pour l'instant. Envoie le premier message 👇
          </div>
        ) : (
          <>
            {messages.map((m) => (
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
                  {m.sender_role === "CARE" ? "Agent" : m.sender_role} • {formatDate(m.created_at)}
                </div>
                {/* Render markdown pour BOT, plain text pour USER/CARE */}
                {m.sender_role === "BOT" ? (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            ))}

            {/* Animation "Bot réfléchit..." */}
            {botThinking && (
              <div className="max-w-[80%] mr-auto rounded-2xl border bg-gray-50 px-3 py-2 text-sm">
                <div className="text-[10px] text-gray-500 mb-1">BOT</div>
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                  </div>
                  <span>Le bot réfléchit...</span>
                </div>
              </div>
            )}

            {/* Ref pour auto-scroll */}
            <div ref={messagesEndRef} />
          </>
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