// frontend/src/components/SourcesPanel.tsx
import { useState, useEffect } from "react";
import { DocumentsAPI, RagAPI, type DocumentRow, type ChunkSource } from "../api";

type SourcesPanelProps = {
  isVisible: boolean;
  onToggle: () => void;
  userRole?: "USER" | "ADMIN" | "CARE";
  lastChunkIds: string[];
};

type Tab = "citations" | "ressources" | "upload";

export default function SourcesPanel({ 
  isVisible, 
  onToggle, 
  userRole,
  lastChunkIds 
}: SourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("citations");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [citations, setCitations] = useState<ChunkSource[]>([]);
  const [visibility, setVisibility] = useState<"PUBLIC" | "ADMIN_ONLY" | "USER_SPECIFIC">("PUBLIC");
  
  // Nouveau : Liste users + owner sélectionné
  const [users, setUsers] = useState<Array<{id: string, email: string}>>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

  // Charger les citations quand chunk_ids change
  useEffect(() => {
    console.log('🔍 Citations useEffect:', { 
      lastChunkIds: lastChunkIds.length, 
      activeTab 
    });
    
    if (lastChunkIds.length > 0) {
      loadCitations();
    } else {
      setCitations([]);
    }
  }, [lastChunkIds]); // Retire activeTab de la dépendance

  // Charger documents quand on ouvre l'onglet Ressources
  useEffect(() => {
    if (activeTab === "ressources") {
      loadDocuments();
    }
  }, [activeTab]);

  // Charger liste users si ADMIN (pour dropdown)
  useEffect(() => {
    if (userRole === "ADMIN" || userRole === "CARE") {
      loadUsers();
    }
  }, [userRole]);

  async function loadUsers() {
    try {
      const response = await fetch("/api/care/users", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  async function loadCitations() {
    console.log('📚 Loading citations for chunk_ids:', lastChunkIds);
    try {
      const sources = await RagAPI.sourcesMine(lastChunkIds);
      console.log('✅ Citations loaded:', sources.length, 'sources');
      setCitations(sources);
    } catch (err) {
      console.error("❌ Error loading citations:", err);
    }
  }

  async function loadDocuments() {
    try {
      let docs: DocumentRow[];
      
      // ADMIN/CARE voit TOUS les documents
      if (userRole === "ADMIN" || userRole === "CARE") {
        docs = await DocumentsAPI.listCare();
      } else {
        docs = await DocumentsAPI.listMine();
      }
      
      console.log(`📁 Loaded ${docs.length} documents`);
      setDocuments(docs);
    } catch (err) {
      console.error("Error loading documents:", err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Seuls les fichiers PDF sont acceptés");
      return;
    }

    // Validation : USER_SPECIFIC nécessite un owner
    if (visibility === "USER_SPECIFIC" && !selectedOwnerId) {
      setUploadError("Veuillez sélectionner un utilisateur pour USER_SPECIFIC");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      if (userRole === "ADMIN" || userRole === "CARE") {
        formData.append("visibility", visibility);
        
        // Si USER_SPECIFIC, envoyer l'owner sélectionné
        if (visibility === "USER_SPECIFIC" && selectedOwnerId) {
          formData.append("owner_user_id", selectedOwnerId);
        }
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      console.log("✅ Document uploaded:", result);
      
      // Reset
      setSelectedOwnerId("");
      
      // Switch to ressources tab to see the new doc
      setActiveTab("ressources");
      loadDocuments();
      
      e.target.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!confirm("Supprimer ce document ? (Ceci supprimera aussi tous les chunks et l'index FAISS)")) return;
    
    try {
      await DocumentsAPI.deleteCare(docId);
      console.log("✅ Document deleted");
      loadDocuments();
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Erreur lors de la suppression");
    }
  }

  async function handleChangeVisibility(
    docId: string, 
    newVisibility: "PUBLIC" | "ADMIN_ONLY" | "USER_SPECIFIC",
    newOwnerId?: string
  ) {
    try {
      // Si USER_SPECIFIC, on doit avoir un owner
      if (newVisibility === "USER_SPECIFIC" && !newOwnerId) {
        alert("Veuillez sélectionner un utilisateur pour USER_SPECIFIC");
        return;
      }

      await DocumentsAPI.updateVisibility(docId, newVisibility, newOwnerId);
      console.log(`✅ Visibility changed to ${newVisibility}` + (newOwnerId ? ` (owner: ${newOwnerId})` : ""));
      loadDocuments();
    } catch (err) {
      console.error("Error changing visibility:", err);
      alert("Erreur lors du changement de visibilité");
    }
  }

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-2 py-8 rounded-l-lg hover:bg-blue-700 shadow-lg z-50"
        title="Afficher les sources"
      >
        <span className="writing-mode-vertical">Sources</span>
      </button>
    );
  }

  return (
    <div className="relative h-full flex flex-col bg-white">
      {/* Header avec bouton fermer */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-semibold">Sources</h2>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700"
          title="Masquer les sources"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("citations")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === "citations"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Citations
          {citations.length > 0 && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
              {citations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("ressources")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === "ressources"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Ressources
          {documents.length > 0 && (
            <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {documents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === "upload"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Upload
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* CITATIONS TAB */}
        {activeTab === "citations" && (
          <div className="p-4">
            {citations.length === 0 ? (
              <div className="text-sm text-gray-500 italic text-center py-8">
                Aucune citation pour le moment.
                <br />
                Les sources apparaîtront ici après une réponse du bot.
              </div>
            ) : (
              <div className="space-y-4">
                {citations.map((citation, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-sm text-blue-600 truncate">
                        {citation.filename}
                      </div>
                      {citation.page_number && (
                        <div className="text-xs text-gray-500 ml-2">
                          p.{citation.page_number}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      {citation.content}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Chunk {citation.chunk_index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESSOURCES TAB */}
        {activeTab === "ressources" && (
          <div className="p-4">
            {documents.length === 0 ? (
              <div className="text-sm text-gray-500 italic text-center py-8">
                Aucun document indexé
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-3 hover:bg-gray-50"
                  >
                    {/* Nom fichier */}
                    <div className="font-medium text-sm truncate mb-2">{doc.filename}</div>
                    
                    {/* Infos */}
                    <div className="text-xs text-gray-500 flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded ${
                        doc.visibility === "PUBLIC" ? "bg-green-100 text-green-700" :
                        doc.visibility === "ADMIN_ONLY" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {doc.visibility}
                      </span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Actions ADMIN */}
                    {(userRole === "ADMIN" || userRole === "CARE") && (
                      <div className="space-y-2 mt-2">
                        {/* Changer visibilité */}
                        <select
                          value={doc.visibility}
                          onChange={(e) => {
                            const newVis = e.target.value as any;
                            if (newVis !== "USER_SPECIFIC") {
                              handleChangeVisibility(doc.id, newVis);
                            }
                            // Si USER_SPECIFIC, on attend la sélection du user
                          }}
                          className="text-xs border rounded px-2 py-1 w-full"
                        >
                          <option value="PUBLIC">Public</option>
                          <option value="ADMIN_ONLY">Admin uniquement</option>
                          <option value="USER_SPECIFIC">Spécifique à un user</option>
                        </select>

                        {/* Dropdown user si USER_SPECIFIC */}
                        {doc.visibility === "USER_SPECIFIC" && (
                          <div className="flex gap-2">
                            <select
                              value={doc.owner_user_id || ""}
                              onChange={(e) => handleChangeVisibility(doc.id, "USER_SPECIFIC", e.target.value)}
                              className="text-xs border rounded px-2 py-1 flex-1"
                            >
                              <option value="">-- Sélectionner un user --</option>
                              {users.map(user => (
                                <option key={user.id} value={user.id}>
                                  {user.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {/* Supprimer */}
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-xs text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded w-full"
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <div className="p-4">
            <div className="text-sm font-medium mb-3">Upload Document (PDF)</div>
            
            {(userRole === "ADMIN" || userRole === "CARE") && (
              <>
                <div className="mb-3">
                  <label className="text-xs text-gray-600 block mb-1">Visibilité</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="PUBLIC">Public (tous les users)</option>
                    <option value="ADMIN_ONLY">Admin uniquement</option>
                    <option value="USER_SPECIFIC">Spécifique à un user</option>
                  </select>
                </div>

                {/* Dropdown user si USER_SPECIFIC */}
                {visibility === "USER_SPECIFIC" && (
                  <div className="mb-3">
                    <label className="text-xs text-gray-600 block mb-1">Assigner à</label>
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      <option value="">-- Sélectionner un user --</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
            />

            {uploading && (
              <div className="mt-2 text-sm text-blue-600">
                📤 Upload et indexation en cours...
              </div>
            )}

            {uploadError && (
              <div className="mt-2 text-sm text-red-600">
                ❌ {uploadError}
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              Le document sera automatiquement découpé en chunks et indexé pour le RAG.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}