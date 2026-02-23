/**
 * ChatPanel (panneau central)
 * ---------------------------
 * Objectif :
 * - afficher les messages d'une conversation sélectionnée
 * - input désactivé si aucune conversation sélectionnée
 *
 * Pour l'instant : on n'a pas de données et pas de conversation sélectionnée,
 * donc on affiche un empty state + input disabled.
 */
export default function ChatPanel() {
  // Plus tard ce composant recevra : selectedConversation + messages
  const hasSelectedConversation = false;

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Header du chat */}
      <div className="h-14 bg-white border-b px-4 flex items-center justify-between">
        <div className="font-semibold text-gray-800">Chat</div>
        <div className="text-xs text-gray-500">
          {hasSelectedConversation ? "Conversation sélectionnée" : "Aucune conversation"}
        </div>
      </div>

      {/* Zone messages */}
      <div className="flex-1 overflow-auto p-6">
        {!hasSelectedConversation ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <div className="text-sm font-medium text-gray-800">
                Sélectionne une conversation
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Clique une conversation à gauche pour afficher les messages.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600">Messages (à venir)</div>
        )}
      </div>

      {/* Composer (input + send) */}
      <div className="bg-white border-t p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border p-2 text-sm disabled:bg-gray-100"
            placeholder={
              hasSelectedConversation
                ? "Écris ton message…"
                : "Sélectionne une conversation d’abord"
            }
            disabled={!hasSelectedConversation}
          />
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm disabled:opacity-50"
            disabled={!hasSelectedConversation}
          >
            Envoyer
          </button>
        </div>
      </div>
    </main>
  );
}
