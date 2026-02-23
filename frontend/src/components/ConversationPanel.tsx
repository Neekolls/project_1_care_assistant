
/**
 * ConversationPanel (panneau gauche)
 * ---------------------------------
 * Objectif UX :
 * - Afficher la liste des conversations (plus tard via API)
 * - Pour l'instant : afficher un "empty state" propre (aucune conversation)
 *
 * Pourquoi un composant séparé ?
 * - Le panneau gauche va grossir : liste, recherche, filtres care, click conversation…
 * - Le sortir du App.tsx évite de tout mélanger.
 */

export default function ConversationPanel() {
  // Pour l'instant, on n'a pas de données.
  // Plus tard, ce composant recevra des props, par exemple :
  // - conversations: Conversation[]
  // - selectedId: string | null
  // - onSelect: (id: string) => void
  const hasConversations = false;

  return (
    /**
     * Conteneur du panneau gauche
     * - width fixe : w-80 (~320px)
     * - hauteur : prend toute la hauteur disponible (flex parent)
     * - overflow : scroll interne quand la liste sera longue
     */
    <aside className="w-80 bg-white border-r flex flex-col overflow-hidden">
      {/* Header du panneau gauche (titre + actions futures) */}
      <div className="h-14 px-4 flex items-center justify-between border-b">
        <div className="font-semibold text-gray-800">Conversations</div>

        {/* 
          Zone "actions" (future)
          Exemples plus tard :
          - bouton refresh
          - search input
          - filtres care/admin
        */}
        <div className="text-xs text-gray-400">v0</div>
      </div>

      {/* Body du panneau gauche */}
      <div className="flex-1 overflow-auto">
        {hasConversations ? (
          /**
           * LISTE (future)
           * Ici on fera un .map(conversations) avec des items cliquables.
           */
          <div className="p-4 text-sm text-gray-600">
            {/* placeholder */}
            Liste de conversations (à venir)
          </div>
        ) : (
          /**
           * EMPTY STATE (maintenant)
           * Quand il n'y a aucune conversation à afficher.
           */
          <div className="h-full p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-800">
                Aucune conversation
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Quand tu auras des conversations, elles s’afficheront ici.
              </div>

              {/* 
                Option UX future :
                - bouton "New conversation" (si tu décides d'en créer)
                - ou explication "Commence à chatter"
              */}
            </div>
          </div>
        )}
      </div>

      {/* Footer (optionnel) : on le laisse prêt mais vide */}
      <div className="border-t p-3 text-xs text-gray-500">
        {/* Plus tard : compteur, status, etc. */}
        Prêt.
      </div>
    </aside>
  );
}
