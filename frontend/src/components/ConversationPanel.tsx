type Conversation = {
  id: string;
  status: "OPEN" | "ESCALATED" | "CLOSED";
  last_message_at: string | null;
  user_email?: string; // Pour ADMIN/CARE uniquement
};

type User = {
  id: string;
  email: string;
};

type Props = {
  items: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEscalate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onChangeStatus?: (id: string, status: "OPEN" | "ESCALATED" | "CLOSED") => void; // ← NOUVEAU
  loading?: boolean;
  error?: string | null;
  
  // Filtres (pour ADMIN/CARE)
  isAdmin?: boolean;
  users?: User[];
  selectedUserId?: string;
  onUserFilterChange?: (userId: string) => void;
  selectedStatus?: string;
  onStatusFilterChange?: (status: string) => void;
};

export default function ConversationPanel({
  items,
  selectedId,
  onSelect,
  onCreate,
  onEscalate,
  onDelete,
  onChangeStatus,
  loading = false,
  error = null,
  isAdmin = false,
  users = [],
  selectedUserId = "ALL",
  onUserFilterChange,
  selectedStatus = "ALL",
  onStatusFilterChange,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Conversations</div>
            <div className="text-xs text-gray-500">
              {loading ? "Chargement..." : `${items.length} conversation(s)`}
            </div>
          </div>

          <button
            className="rounded-lg bg-black px-3 py-2 text-xs text-white"
            onClick={onCreate}
            title="Nouvelle conversation"
          >
            + New
          </button>
        </div>

        {/* Filtres ADMIN/CARE */}
        {isAdmin && (
          <div className="mt-3 space-y-2">
            {/* Filtre User */}
            {onUserFilterChange && (
              <div>
                <label className="text-xs text-gray-600 block mb-1">Utilisateur</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => onUserFilterChange(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="ALL">Tous les utilisateurs</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtre Status */}
            {onStatusFilterChange && (
              <div>
                <label className="text-xs text-gray-600 block mb-1">Statut</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => onStatusFilterChange(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="OPEN">OPEN</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
            )}
          </div>
        )}

        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
            Aucune conversation pour l'instant.
            <div className="mt-2 text-xs text-gray-500">
              Clique sur <span className="font-semibold">New</span> pour en créer une.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((c) => {
              const active = c.id === selectedId;
              const isEscalated = c.status === "ESCALATED";
              
              return (
                <div
                  key={c.id}
                  className={[
                    "rounded-xl border",
                    active ? "border-black bg-gray-50" : "bg-white",
                    isEscalated ? "border-red-300 bg-red-50" : "",
                  ].join(" ")}
                >
                  <button
                    onClick={() => onSelect(c.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">
                          {c.user_email ? c.user_email : "Conversation"}
                        </div>
                        
                        {/* Bouton escalade - visible uniquement si pas encore escaladé */}
                        {!isEscalated && onEscalate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Demander une escalade vers un agent humain ?")) {
                                onEscalate(c.id);
                              }
                            }}
                            className="rounded-full border border-red-300 bg-white px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
                            title="Demander une escalade"
                          >
                            🚨 Escalade
                          </button>
                        )}
                      </div>

                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[10px]",
                          isEscalated
                            ? "border-red-600 bg-red-100 text-red-700"
                            : c.status === "CLOSED"
                            ? "border-gray-400 bg-gray-100 text-gray-600"
                            : "border-green-600 bg-green-100 text-green-700",
                        ].join(" ")}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {c.last_message_at ? `Last: ${c.last_message_at}` : "No messages yet"}
                    </div>

                    <div className="mt-1 text-[10px] text-gray-400 break-all">{c.id}</div>
                  </button>

                  {/* Actions ADMIN */}
                  {isAdmin && (onDelete || onChangeStatus) && (
                    <div className="border-t px-3 py-2 space-y-2">
                      {/* Changer status */}
                      {onChangeStatus && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeStatus(c.id, "OPEN");
                            }}
                            disabled={c.status === "OPEN"}
                            className={`flex-1 text-xs px-2 py-1 rounded ${
                              c.status === "OPEN"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            ✅ OPEN
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeStatus(c.id, "CLOSED");
                            }}
                            disabled={c.status === "CLOSED"}
                            className={`flex-1 text-xs px-2 py-1 rounded ${
                              c.status === "CLOSED"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-gray-600 text-white hover:bg-gray-700"
                            }`}
                          >
                            🔒 CLOSE
                          </button>
                        </div>
                      )}

                      {/* Supprimer */}
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Supprimer cette conversation ? Cette action est irréversible.")) {
                              onDelete(c.id);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-800 w-full text-left"
                        >
                          🗑️ Supprimer la conversation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}