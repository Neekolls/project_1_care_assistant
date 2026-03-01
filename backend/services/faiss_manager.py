# backend/services/faiss_manager.py
"""
Service de gestion FAISS multi-index (user, public, admin)
"""
import faiss
import numpy as np
import json
from pathlib import Path
from typing import Optional


class FAISSManager:
    """
    Gestionnaire FAISS avec index séparés par type de document
    
    Structure:
    - data/faiss_index/public.index (documents PUBLIC)
    - data/faiss_index/admin.index (documents ADMIN_ONLY)
    - data/faiss_index/user_{user_id}.index (documents USER_SPECIFIC)
    """
    
    def __init__(self, index_dir: Path, mapping_dir: Path):
        self.index_dir = index_dir
        self.mapping_dir = mapping_dir
        self.dimension = 1024  # Mistral embed dimension
    
    def _get_index_path(self, index_type: str, user_id: Optional[str] = None) -> Path:
        """Retourne le chemin de l'index selon le type"""
        if index_type == "user" and user_id:
            return self.index_dir / f"user_{user_id}.index"
        elif index_type == "public":
            return self.index_dir / "public.index"
        elif index_type == "admin":
            return self.index_dir / "admin.index"
        else:
            raise ValueError(f"Invalid index_type: {index_type}")
    
    def _get_mapping_path(self, index_type: str, user_id: Optional[str] = None) -> Path:
        """Retourne le chemin du mapping selon le type"""
        if index_type == "user" and user_id:
            return self.mapping_dir / f"user_{user_id}_mapping.json"
        elif index_type == "public":
            return self.mapping_dir / "public_mapping.json"
        elif index_type == "admin":
            return self.mapping_dir / "admin_mapping.json"
        else:
            raise ValueError(f"Invalid index_type: {index_type}")
    
    def get_index(self, index_type: str, user_id: Optional[str] = None) -> faiss.IndexFlatIP:
        """Charge ou crée un index FAISS"""
        index_path = self._get_index_path(index_type, user_id)
        
        if index_path.exists():
            return faiss.read_index(str(index_path))
        return faiss.IndexFlatIP(self.dimension)
    
    def save_index(self, index: faiss.IndexFlatIP, index_type: str, user_id: Optional[str] = None):
        """Sauvegarde l'index"""
        index_path = self._get_index_path(index_type, user_id)
        faiss.write_index(index, str(index_path))
    
    def load_mapping(self, index_type: str, user_id: Optional[str] = None) -> dict:
        """Charge le mapping chunk_id → metadata"""
        mapping_path = self._get_mapping_path(index_type, user_id)
        
        if mapping_path.exists():
            with open(mapping_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def save_mapping(self, mapping: dict, index_type: str, user_id: Optional[str] = None):
        """Sauvegarde le mapping"""
        mapping_path = self._get_mapping_path(index_type, user_id)
        with open(mapping_path, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)
    
    def add_chunks(
        self,
        document_id: str,
        chunks: list[dict],
        vectors: list[np.ndarray],
        visibility: str,
        owner_user_id: Optional[str] = None
    ) -> list[str]:
        """
        Ajoute des chunks au bon index selon la visibilité
        
        Args:
            document_id: UUID du document
            chunks: Liste de chunks (avec chunk_index, page_number, content)
            vectors: Vecteurs correspondants
            visibility: PUBLIC | ADMIN_ONLY | USER_SPECIFIC
            owner_user_id: ID du propriétaire (requis si USER_SPECIFIC)
            
        Returns:
            Liste des chunk_ids créés
        """
        # Déterminer l'index cible
        if visibility == "PUBLIC":
            index_type = "public"
            user_id = None
        elif visibility == "ADMIN_ONLY":
            index_type = "admin"
            user_id = None
        elif visibility == "USER_SPECIFIC":
            if not owner_user_id:
                raise ValueError("owner_user_id required for USER_SPECIFIC documents")
            index_type = "user"
            user_id = owner_user_id
        else:
            raise ValueError(f"Invalid visibility: {visibility}")
        
        # Charger index et mapping
        index = self.get_index(index_type, user_id)
        mapping = self.load_mapping(index_type, user_id)
        
        next_id = index.ntotal
        chunk_ids = []
        
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            faiss_id = next_id + i
            chunk_id = f"{document_id}_chunk_{chunk['chunk_index']}"
            
            # Ajouter à FAISS
            index.add(vector.reshape(1, -1))
            
            # Ajouter au mapping (avec vecteur pour migration future)
            mapping[str(faiss_id)] = {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk.get("page_number"),
                "content": chunk["content"],
                "vector": vector.tolist()  # ← Stocké pour move_document()
            }
            
            chunk_ids.append(chunk_id)
        
        # Sauvegarder
        self.save_index(index, index_type, user_id)
        self.save_mapping(mapping, index_type, user_id)
        
        print(f"✅ Added {len(chunks)} chunks to {index_type}" + 
              (f" (user {user_id})" if user_id else ""))
        
        return chunk_ids
    
    def search_for_user(
        self,
        query_vector: np.ndarray,
        user_id: str,
        user_role: str,
        k: int = 10
    ) -> tuple[list[float], list[dict]]:
        """
        Recherche dans les index accessibles par l'utilisateur
        
        Args:
            query_vector: Vecteur de la question
            user_id: ID de l'utilisateur
            user_role: Rôle (USER, ADMIN, CARE)
            k: Nombre de résultats souhaités
            
        Returns:
            (scores, chunks) triés par score décroissant
        """
        all_results = []
        
        # 1. Chercher dans l'index user (documents USER_SPECIFIC)
        user_index = self.get_index("user", user_id)
        if user_index.ntotal > 0:
            user_mapping = self.load_mapping("user", user_id)
            D, I = user_index.search(query_vector.reshape(1, -1), min(k, user_index.ntotal))
            
            for score, idx in zip(D[0], I[0]):
                if str(idx) in user_mapping:
                    chunk = user_mapping[str(idx)].copy()
                    chunk["score"] = float(score)
                    all_results.append(chunk)
        
        # 2. Chercher dans l'index public (documents PUBLIC)
        public_index = self.get_index("public")
        if public_index.ntotal > 0:
            public_mapping = self.load_mapping("public")
            D, I = public_index.search(query_vector.reshape(1, -1), min(k, public_index.ntotal))
            
            for score, idx in zip(D[0], I[0]):
                if str(idx) in public_mapping:
                    chunk = public_mapping[str(idx)].copy()
                    chunk["score"] = float(score)
                    all_results.append(chunk)
        
        # 3. Si ADMIN/CARE, chercher aussi dans l'index admin
        if user_role in ["ADMIN", "CARE"]:
            admin_index = self.get_index("admin")
            if admin_index.ntotal > 0:
                admin_mapping = self.load_mapping("admin")
                D, I = admin_index.search(query_vector.reshape(1, -1), min(k, admin_index.ntotal))
                
                for score, idx in zip(D[0], I[0]):
                    if str(idx) in admin_mapping:
                        chunk = admin_mapping[str(idx)].copy()
                        chunk["score"] = float(score)
                        all_results.append(chunk)
        
        # 4. Trier par score et garder top k
        all_results.sort(key=lambda x: x["score"], reverse=True)
        top_k = all_results[:k]
        
        # Séparer scores et chunks
        scores = [c["score"] for c in top_k]
        chunks = [{k: v for k, v in c.items() if k != "score"} for c in top_k]
        
        return scores, chunks
    
    def delete_document(self, document_id: str) -> int:
        """
        Supprime tous les chunks d'un document de TOUS les index
        
        Note: FAISS ne supporte pas la suppression directe
        Les vecteurs restent mais ne seront plus utilisés
        
        Returns:
            Nombre total de chunks supprimés
        """
        total_removed = 0
        
        # Vérifier dans tous les types d'index possibles
        for index_type in ["public", "admin"]:
            mapping = self.load_mapping(index_type)
            
            ids_to_remove = [
                faiss_id for faiss_id, data in mapping.items()
                if data.get("document_id") == document_id
            ]
            
            for faiss_id in ids_to_remove:
                del mapping[faiss_id]
            
            if ids_to_remove:
                self.save_mapping(mapping, index_type)
                total_removed += len(ids_to_remove)
        
        # Vérifier dans tous les index user (on ne sait pas lequel)
        # Pour optimiser, on pourrait stocker document_id → index_type dans un registry
        for mapping_file in self.mapping_dir.glob("user_*_mapping.json"):
            user_id = mapping_file.stem.replace("user_", "").replace("_mapping", "")
            mapping = self.load_mapping("user", user_id)
            
            ids_to_remove = [
                faiss_id for faiss_id, data in mapping.items()
                if data.get("document_id") == document_id
            ]
            
            for faiss_id in ids_to_remove:
                del mapping[faiss_id]
            
            if ids_to_remove:
                self.save_mapping(mapping, "user", user_id)
                total_removed += len(ids_to_remove)
        
        return total_removed
    
    def get_stats(self) -> dict:
        """Retourne les stats FAISS de tous les index"""
        stats = {
            "public": {"vectors": 0, "mapping_entries": 0},
            "admin": {"vectors": 0, "mapping_entries": 0},
            "users": {}
        }
        
        # Stats public
        public_index = self.get_index("public")
        public_mapping = self.load_mapping("public")
        stats["public"]["vectors"] = public_index.ntotal
        stats["public"]["mapping_entries"] = len(public_mapping)
        
        # Stats admin
        admin_index = self.get_index("admin")
        admin_mapping = self.load_mapping("admin")
        stats["admin"]["vectors"] = admin_index.ntotal
        stats["admin"]["mapping_entries"] = len(admin_mapping)
        
        # Stats users
        for mapping_file in self.mapping_dir.glob("user_*_mapping.json"):
            user_id = mapping_file.stem.replace("user_", "").replace("_mapping", "")
            user_index = self.get_index("user", user_id)
            user_mapping = self.load_mapping("user", user_id)
            stats["users"][user_id] = {
                "vectors": user_index.ntotal,
                "mapping_entries": len(user_mapping)
            }
        
        return stats
    
    def move_document(
        self,
        document_id: str,
        old_visibility: str,
        old_owner_user_id: Optional[str],
        new_visibility: str,
        new_owner_user_id: Optional[str]
    ) -> int:
        """
        Déplace un document d'un index à un autre en transférant les vecteurs
        
        Returns:
            Nombre de chunks déplacés
        """
        # 1. Déterminer index source
        if old_visibility == "PUBLIC":
            old_index_type = "public"
            old_user_id = None
        elif old_visibility == "ADMIN_ONLY":
            old_index_type = "admin"
            old_user_id = None
        elif old_visibility == "USER_SPECIFIC":
            old_index_type = "user"
            old_user_id = old_owner_user_id
        else:
            raise ValueError(f"Invalid old_visibility: {old_visibility}")
        
        # 2. Déterminer index destination
        if new_visibility == "PUBLIC":
            new_index_type = "public"
            new_user_id = None
        elif new_visibility == "ADMIN_ONLY":
            new_index_type = "admin"
            new_user_id = None
        elif new_visibility == "USER_SPECIFIC":
            if not new_owner_user_id:
                raise ValueError("new_owner_user_id required for USER_SPECIFIC")
            new_index_type = "user"
            new_user_id = new_owner_user_id
        else:
            raise ValueError(f"Invalid new_visibility: {new_visibility}")
        
        # 3. Si même index, rien à faire
        if old_index_type == new_index_type and old_user_id == new_user_id:
            print(f"   ℹ️  Document {document_id} already in correct index")
            return 0
        
        # 4. Extraire chunks du mapping source
        old_mapping = self.load_mapping(old_index_type, old_user_id)
        
        chunks_to_move = []
        old_faiss_ids = []
        
        for faiss_id, data in old_mapping.items():
            if data.get("document_id") == document_id:
                # Vérifier que le vecteur est présent
                if "vector" not in data:
                    raise ValueError(f"Chunk {data['chunk_id']} has no stored vector. Cannot move.")
                chunks_to_move.append(data)
                old_faiss_ids.append(faiss_id)
        
        if not chunks_to_move:
            print(f"   ⚠️  No chunks found for document {document_id} in old index")
            return 0
        
        print(f"   🔄 Moving {len(chunks_to_move)} chunks from {old_index_type}" +
              (f" (user {old_user_id})" if old_user_id else "") +
              f" to {new_index_type}" +
              (f" (user {new_user_id})" if new_user_id else ""))
        
        # 5. Charger index destination
        new_index = self.get_index(new_index_type, new_user_id)
        new_mapping = self.load_mapping(new_index_type, new_user_id)
        
        next_id = new_index.ntotal
        
        # 6. Ajouter chunks à l'index destination
        for i, chunk_data in enumerate(chunks_to_move):
            new_faiss_id = next_id + i
            vector = np.array(chunk_data["vector"])
            
            # Ajouter vecteur à FAISS
            new_index.add(vector.reshape(1, -1))
            
            # Ajouter au mapping destination (conserver le vecteur)
            new_mapping[str(new_faiss_id)] = chunk_data
        
        # 7. Sauvegarder index et mapping destination
        self.save_index(new_index, new_index_type, new_user_id)
        self.save_mapping(new_mapping, new_index_type, new_user_id)
        
        # 8. Supprimer du mapping source
        for faiss_id in old_faiss_ids:
            del old_mapping[faiss_id]
        
        self.save_mapping(old_mapping, old_index_type, old_user_id)
        
        print(f"   ✅ Successfully moved {len(chunks_to_move)} chunks")
        print(f"   ⚠️  Note: Old vectors remain in old FAISS index (orphaned)")
        
        return len(chunks_to_move)