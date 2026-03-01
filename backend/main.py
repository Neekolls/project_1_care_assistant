# backend/main.py
"""
Backend Python - Care Assistant
Orchestrateur des services RAG
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mistralai import Mistral
import os
from dotenv import load_dotenv
from pathlib import Path
import datetime
import httpx

# Services
from services.embeddings import embed_texts_batch, embed_chunks_in_batches
from services.pdf_parser import extract_text_from_pdf
from services.faiss_manager import FAISSManager
from services.mistral import (
    build_system_prompt,
    build_rag_context,
    build_conversation_history,
    generate_chat_response,
    generate_summary
)

# Models
from models import (
    ChatRequest,
    ChatResponse,
    ProcessPDFRequest,
    ProcessPDFResponse
)

load_dotenv()

app = FastAPI(title="Care Assistant - RAG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clients
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

# Paths
DATA_DIR = Path(__file__).parent / "data"
FAISS_INDEX_DIR = DATA_DIR / "faiss_index"
MAPPINGS_DIR = DATA_DIR / "mappings"

DATA_DIR.mkdir(exist_ok=True)
FAISS_INDEX_DIR.mkdir(exist_ok=True)
MAPPINGS_DIR.mkdir(exist_ok=True)

# FAISS Manager (multi-index)
faiss_manager = FAISSManager(FAISS_INDEX_DIR, MAPPINGS_DIR)

# BFF URL pour appels API
BFF_URL = os.getenv("BFF_URL", "http://localhost:3001")

# ==========================================
# ROUTES
# ==========================================

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "ok",
        "faiss_stats": faiss_manager.get_stats()
    }


@app.post("/process-pdf", response_model=ProcessPDFResponse)
async def process_pdf(request: ProcessPDFRequest):
    """
    Traite un PDF : extraction, chunking, embedding, indexation
    """
    try:
        print(f"📄 Processing PDF: {request.document_id}")
        print(f"   Visibility: {request.visibility}")
        print(f"   Owner: {request.owner_user_id}")
        
        # 1. Extraction texte + chunking
        chunks = extract_text_from_pdf(request.file_path)
        print(f"   Extracted {len(chunks)} chunks")
        
        if not chunks:
            raise HTTPException(400, "No text extracted from PDF")
        
        # 2. Génération embeddings (batches de 10)
        all_embeddings = await embed_chunks_in_batches(
            mistral_client,
            chunks,
            batch_size=10
        )
        
        # 3. Indexation FAISS avec visibilité
        chunk_ids = faiss_manager.add_chunks(
            request.document_id,
            chunks,
            all_embeddings,
            visibility=request.visibility,
            owner_user_id=request.owner_user_id
        )
        
        print(f"✅ PDF indexed: {len(chunks)} chunks")
        
        # 4. Export debug
        debug_file = DATA_DIR / f"chunks_debug_{request.document_id}.txt"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(f"=== CHUNKS DEBUG - Document {request.document_id} ===\n")
            f.write(f"Total chunks: {len(chunks)}\n")
            f.write(f"Visibility: {request.visibility}\n")
            f.write(f"Owner: {request.owner_user_id}\n")
            f.write(f"Date: {datetime.datetime.now()}\n\n")
            
            for i, chunk in enumerate(chunks):
                f.write(f"\n{'='*80}\n")
                f.write(f"CHUNK {i+1}/{len(chunks)}\n")
                f.write(f"Page: {chunk['page_number']}\n")
                f.write(f"Length: {len(chunk['content'])} chars\n")
                f.write(f"{'='*80}\n")
                f.write(chunk['content'])
                f.write(f"\n\n")
        
        print(f"   📝 Debug file saved: {debug_file}")
        
        # 5. Retourner chunks pour stockage BFF
        return ProcessPDFResponse(
            chunks_created=len(chunks),
            chunks=[
                {
                    "chunk_index": c["chunk_index"],
                    "page_number": c["page_number"],
                    "content": c["content"]
                }
                for c in chunks
            ]
        )
    
    except Exception as e:
        print(f"❌ Error processing PDF: {e}")
        raise HTTPException(500, str(e))


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Endpoint de chat avec RAG + mémoire long terme + filtrage par user
    """
    try:
        # 1. RAG - Recherche dans FAISS avec filtrage user
        chunk_ids = []
        rag_chunks = []
        
        # Embed question
        query_vecs = await embed_texts_batch(mistral_client, [request.message])
        query_vec = query_vecs[0]
        
        # Recherche filtrée par user
        user_role = getattr(request, 'user_role', 'USER')  # Default USER si non fourni
        scores, chunks = faiss_manager.search_for_user(
            query_vec,
            user_id=request.user_id,
            user_role=user_role,
            k=10
        )
        
        if chunks:
            # Top 3 pour citations
            top_3_chunks = chunks[:3]
            top_3_chunk_ids = [c["chunk_id"] for c in top_3_chunks]
            
            # Récupérer contexte ±1 pour les chunks (pas implémenté ici, simplification)
            # Pour l'instant on utilise les chunks directs
            rag_chunks = chunks
            chunk_ids = top_3_chunk_ids
            
            print(f"📚 Retrieved {len(rag_chunks)} chunks for RAG (user: {request.user_id})")
            print(f"   Top 3 for citations: {top_3_chunk_ids}")
            print(f"   Top scores: {scores[:3]}")
        
        # 2. MÉMOIRE LONG TERME - Récupérer résumé actuel
        conversation_summary = ""
        summary_updated = False
        
        try:
            async with httpx.AsyncClient() as client:
                summary_response = await client.get(
                    f"{BFF_URL}/api/care/conversations/{request.conversation_id}/summary",
                    timeout=5.0
                )
                if summary_response.status_code == 200:
                    summary_data = summary_response.json()
                    conversation_summary = summary_data.get("summary", "")
                    print(f"📝 Current summary loaded ({len(conversation_summary)} chars)")
        except Exception as e:
            print(f"⚠️  Could not load summary: {e}")
        
        # 3. Compter messages USER dans l'historique
        user_message_count = sum(1 for msg in request.history if msg.get("sender_role") == "USER")
        print(f"👤 User messages in history: {user_message_count}")
        
        # 4. Si >= 20 messages USER → Générer nouveau résumé (tous les 20 pour éviter rate limit)
        if user_message_count >= 20 and user_message_count % 20 == 0:
            print(f"🧠 Generating summary (20+ user messages)")
            try:
                new_summary = await generate_summary(
                    mistral_client,
                    conversation_summary,
                    request.history
                )
                
                # Sauvegarder le résumé via BFF
                async with httpx.AsyncClient() as client:
                    await client.patch(
                        f"{BFF_URL}/api/care/conversations/{request.conversation_id}/summary",
                        json={"summary": new_summary},
                        timeout=5.0
                    )
                    print(f"✅ Summary updated and saved")
                    conversation_summary = new_summary
                    summary_updated = True
            except Exception as e:
                print(f"⚠️  Summary generation failed: {e}")
        
        # 5. Construire contexte avec résumé
        system_prompt = build_system_prompt()
        rag_context = build_rag_context(rag_chunks)
        
        # Ajouter résumé au prompt système si disponible
        if conversation_summary:
            system_prompt += f"\n\nRésumé de la conversation jusqu'à présent :\n{conversation_summary}\n"
        
        # 6. Historique - 5 derniers messages seulement
        recent_messages = request.history[-5:]
        conversation_history = build_conversation_history(recent_messages)
        
        # 7. Appel Mistral
        answer = await generate_chat_response(
            mistral_client,
            system_prompt,
            rag_context,
            conversation_history,
            request.message
        )
        
        print(f"✅ Response generated (summary_updated: {summary_updated})")
        
        return ChatResponse(
            answer=answer,
            chunk_ids=chunk_ids,
            summary_updated=summary_updated
        )
    
    except Exception as e:
        print(f"❌ Chat error: {e}")
        raise HTTPException(500, str(e))


@app.delete("/delete-document/{document_id}")
async def delete_document(document_id: str):
    """
    Supprime un document de FAISS
    """
    try:
        removed = faiss_manager.delete_document(document_id)
        print(f"🗑️  Document {document_id}: {removed} chunks removed from mapping")
        
        return {
            "ok": True,
            "removed": removed
        }
    except Exception as e:
        print(f"❌ Delete error: {e}")
        raise HTTPException(500, str(e))


@app.get("/faiss-stats")
async def faiss_stats():
    """Stats FAISS pour sanity check"""
    return faiss_manager.get_stats()


@app.patch("/documents/{document_id}/visibility")
async def update_document_visibility(document_id: str, request: dict):
    """
    Change la visibilité d'un document et déplace dans FAISS
    
    Body: {
        "old_visibility": "PUBLIC" | "ADMIN_ONLY" | "USER_SPECIFIC",
        "old_owner_user_id": str | null,
        "new_visibility": "PUBLIC" | "ADMIN_ONLY" | "USER_SPECIFIC",
        "new_owner_user_id": str | null
    }
    """
    try:
        old_visibility = request.get("old_visibility")
        old_owner_user_id = request.get("old_owner_user_id")
        new_visibility = request.get("new_visibility")
        new_owner_user_id = request.get("new_owner_user_id")
        
        if not old_visibility or not new_visibility:
            raise HTTPException(400, "old_visibility and new_visibility required")
        
        print(f"📝 Updating visibility for document {document_id}")
        print(f"   Old: {old_visibility}" + (f" (owner: {old_owner_user_id})" if old_owner_user_id else ""))
        print(f"   New: {new_visibility}" + (f" (owner: {new_owner_user_id})" if new_owner_user_id else ""))
        
        # Déplacer dans FAISS
        moved = faiss_manager.move_document(
            document_id,
            old_visibility,
            old_owner_user_id,
            new_visibility,
            new_owner_user_id
        )
        
        print(f"✅ Visibility updated: {moved} chunks moved")
        
        return {
            "ok": True,
            "chunks_moved": moved
        }
    
    except Exception as e:
        print(f"❌ Error updating visibility: {e}")
        raise HTTPException(500, str(e))


@app.on_event("startup")
async def startup():
    print("="*50)
    print("🚀 Backend Python started")
    print(f"📊 FAISS stats: {faiss_manager.get_stats()}")
    print("="*50)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)