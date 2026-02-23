import { useState } from "react";

/**
 * SourcesPanel (panneau droit)
 * ----------------------------
 * Objectif :
 * - afficher les sources RAG (doc, page, extrait)
 * - pouvoir se rétracter (toggle)
 *
 * Pour l'instant : empty state.
 */
export default function SourcesPanel() {
  // Le panneau est ouvert par défaut ; tu peux mettre false si tu préfères.
  const [open, setOpen] = useState(true);

  // Largeur quand c'est ouvert
  const widthClass = open ? "w-96" : "w-12";

  return (
    <aside className={`${widthClass} bg-white border-l flex flex-col overflow-hidden transition-all duration-200`}>
      {/* Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b">
        {/* Quand c'est fermé, on cache le texte pour garder un mini panneau */}
        <div className={`font-semibold text-gray-800 ${open ? "block" : "hidden"}`}>
          Sources
        </div>

        <button
          className="text-xs px-2 py-1 rounded-md border hover:bg-gray-50"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Rétracter" : "Ouvrir"}
        >
          {open ? "⟩" : "⟨"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {!open ? null : (
          <div className="text-center mt-10">
            <div className="text-sm font-medium text-gray-800">Aucune source</div>
            <div className="mt-1 text-xs text-gray-500">
              Quand le bot répondra avec des sources, elles apparaîtront ici.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
