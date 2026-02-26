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

# Services
from services.embeddings import embed_texts_batch, embed_chunks_in_batches
from services.pdf_parser import extract_text_from_pdf
from services.faiss_manager import FAISSManager
from services.mistral import (
    build_system_prompt,
    build_rag_context,
    build_conversation_history,
    generate_chat_response
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

FAISS_INDEX_PATH = FAISS_INDEX_DIR / "documents.index"
MAPPING_PATH = MAPPINGS_DIR / "documents_mapping.json"

# FAISS Manager
faiss_manager = FAISSManager(FAISS_INDEX_PATH, MAPPING_PATH)

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
        
        # 3. Indexation FAISS
        chunk_ids = faiss_manager.add_chunks(
            request.document_id,
            chunks,
            all_embeddings
        )
        
        print(f"✅ PDF indexed: {len(chunks)} chunks")
        
        # 4. Export debug
        debug_file = DATA_DIR / f"chunks_debug_{request.document_id}.txt"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(f"=== CHUNKS DEBUG - Document {request.document_id} ===\n")
            f.write(f"Total chunks: {len(chunks)}\n")
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
    Endpoint de chat avec RAG
    """
    try:
        # 1. RAG - Recherche dans FAISS
        chunk_ids = []
        rag_chunks = []
        
        # Embed question
        query_vecs = await embed_texts_batch(mistral_client, [request.message])
        query_vec = query_vecs[0]
        
        # Search
        scores, indices = faiss_manager.search(query_vec, k=10)
        
        if indices:
            # Récupérer chunks + contexte ±1
            chunks_to_fetch = []
            for idx in indices:
                chunks_to_fetch.append(idx)
                if idx > 0:
                    chunks_to_fetch.append(idx - 1)
                if idx < faiss_manager.get_index().ntotal - 1:
                    chunks_to_fetch.append(idx + 1)
            
            # Dédupliquer
            unique_indices = list(dict.fromkeys(chunks_to_fetch))[:20]
            
            # Récupérer
            retrieved = faiss_manager.get_chunks_by_indices(unique_indices)
            chunk_ids = [c["chunk_id"] for c in retrieved]
            rag_chunks = retrieved
            
            print(f"📚 Retrieved {len(rag_chunks)} chunks")
            print(f"   Top scores: {scores[:5]}")
        
        # 2. Construire contexte
        system_prompt = build_system_prompt()
        rag_context = build_rag_context(rag_chunks)
        
        # 3. Historique
        recent_messages = request.history[-5:]  # 5 derniers messages
        conversation_history = build_conversation_history(recent_messages)
        
        # 4. Appel Mistral
        answer = await generate_chat_response(
            mistral_client,
            system_prompt,
            rag_context,
            conversation_history,
            request.message
        )
        
        print(f"✅ Response generated")
        
        return ChatResponse(
            answer=answer,
            chunk_ids=chunk_ids,
            summary_updated=False
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


@app.on_event("startup")
async def startup():
    print("="*50)
    print("🚀 Backend Python started")
    print(f"📊 FAISS stats: {faiss_manager.get_stats()}")
    print("="*50)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)