# backend/services/faiss_manager.py
"""
Service de gestion FAISS (index + mapping)
"""
import faiss
import numpy as np
import json
from pathlib import Path


class FAISSManager:
    """Gestionnaire FAISS centralisé"""
    
    def __init__(self, index_path: Path, mapping_path: Path):
        self.index_path = index_path
        self.mapping_path = mapping_path
        self.dimension = 1024  # Mistral embed dimension
    
    def get_index(self) -> faiss.IndexFlatIP:
        """Charge ou crée un index FAISS"""
        if self.index_path.exists():
            return faiss.read_index(str(self.index_path))
        return faiss.IndexFlatIP(self.dimension)
    
    def save_index(self, index: faiss.IndexFlatIP):
        """Sauvegarde l'index"""
        faiss.write_index(index, str(self.index_path))
    
    def load_mapping(self) -> dict:
        """Charge le mapping chunk_id → metadata"""
        if self.mapping_path.exists():
            with open(self.mapping_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def save_mapping(self, mapping: dict):
        """Sauvegarde le mapping"""
        with open(self.mapping_path, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)
    
    def add_chunks(
        self,
        document_id: str,
        chunks: list[dict],
        vectors: list[np.ndarray]
    ) -> list[str]:
        """
        Ajoute des chunks à FAISS
        
        Args:
            document_id: UUID du document
            chunks: Liste de chunks (avec chunk_index, page_number, content)
            vectors: Vecteurs correspondants
            
        Returns:
            Liste des chunk_ids créés
        """
        index = self.get_index()
        mapping = self.load_mapping()
        
        next_id = index.ntotal
        chunk_ids = []
        
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            faiss_id = next_id + i
            chunk_id = f"{document_id}_chunk_{chunk['chunk_index']}"
            
            # Ajouter à FAISS
            index.add(vector.reshape(1, -1))
            
            # Ajouter au mapping
            mapping[str(faiss_id)] = {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk.get("page_number"),
                "content": chunk["content"]
            }
            
            chunk_ids.append(chunk_id)
        
        # Sauvegarder
        self.save_index(index)
        self.save_mapping(mapping)
        
        return chunk_ids
    
    def search(
        self,
        query_vector: np.ndarray,
        k: int = 10
    ) -> tuple[list[float], list[int]]:
        """
        Recherche les k plus proches voisins
        
        Returns:
            (scores, indices)
        """
        index = self.get_index()
        
        if index.ntotal == 0:
            return [], []
        
        k = min(k, index.ntotal)
        D, I = index.search(query_vector.reshape(1, -1), k)
        
        return D[0].tolist(), I[0].tolist()
    
    def get_chunks_by_indices(self, indices: list[int]) -> list[dict]:
        """Récupère les chunks par leurs indices FAISS"""
        mapping = self.load_mapping()
        
        chunks = []
        for idx in indices:
            if str(idx) in mapping:
                chunks.append(mapping[str(idx)])
        
        return chunks
    
    def delete_document(self, document_id: str) -> int:
        """
        Supprime tous les chunks d'un document du mapping
        
        Note: FAISS ne supporte pas la suppression directe
        Les vecteurs restent mais ne seront plus utilisés
        
        Returns:
            Nombre de chunks supprimés
        """
        mapping = self.load_mapping()
        
        ids_to_remove = [
            faiss_id for faiss_id, data in mapping.items()
            if data.get("document_id") == document_id
        ]
        
        for faiss_id in ids_to_remove:
            del mapping[faiss_id]
        
        self.save_mapping(mapping)
        
        return len(ids_to_remove)
    
    def get_stats(self) -> dict:
        """Retourne les stats FAISS"""
        index = self.get_index()
        mapping = self.load_mapping()
        
        return {
            "total_vectors": index.ntotal,
            "mapping_entries": len(mapping),
            "index_exists": self.index_path.exists()
        }
