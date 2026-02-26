# backend/services/embeddings.py
"""
Service de génération d'embeddings via Mistral
- Batch embeddings (jusqu'à 50 textes)
- Retry avec backoff exponentiel
"""
import asyncio
import numpy as np
from mistralai import Mistral


async def embed_texts_batch(
    client: Mistral,
    texts: list[str],
    max_retries: int = 5
) -> list[np.ndarray]:
    """
    Génère des embeddings pour une liste de textes
    
    Args:
        client: Client Mistral
        texts: Liste de textes à embedder
        max_retries: Nombre max de retries
        
    Returns:
        Liste de vecteurs numpy (1024 dimensions)
    """
    attempt = 0
    
    while attempt < max_retries:
        try:
            response = await asyncio.to_thread(
                client.embeddings.create,
                model="mistral-embed",
                inputs=texts
            )
            
            vectors = [np.array(item.embedding, dtype="float32") for item in response.data]
            return vectors
            
        except Exception as e:
            error_str = str(e)
            attempt += 1
            
            # Rate limit (429)
            if "429" in error_str or "rate_limit" in error_str.lower():
                wait_time = 2 ** attempt  # 2, 4, 8, 16, 32 secondes
                print(f"   ⏳ Rate limit, retry {attempt}/{max_retries} in {wait_time}s")
                await asyncio.sleep(wait_time)
                
            # Capacity exceeded (503)
            elif "503" in error_str or "capacity" in error_str.lower():
                wait_time = 3 ** attempt  # 3, 9, 27 secondes
                print(f"   ⏳ Capacity exceeded, retry {attempt}/{max_retries} in {wait_time}s")
                await asyncio.sleep(wait_time)
                
            else:
                print(f"   ❌ Embedding error: {error_str}")
                raise
    
    raise Exception(f"Failed after {max_retries} retries")


async def embed_chunks_in_batches(
    client: Mistral,
    chunks: list[dict],
    batch_size: int = 10
) -> list[np.ndarray]:
    """
    Embed une liste de chunks en batches
    
    Args:
        client: Client Mistral
        chunks: Liste de chunks avec clé "content"
        batch_size: Taille des batches
        
    Returns:
        Liste de vecteurs dans le même ordre que chunks
    """
    all_embeddings = []
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_texts = [c["content"] for c in batch]
        
        print(f"   Batch {i // batch_size + 1}/{(len(chunks) + batch_size - 1) // batch_size}: {len(batch_texts)} chunks")
        
        batch_vectors = await embed_texts_batch(client, batch_texts)
        all_embeddings.extend(batch_vectors)
        
        # Petite pause entre batches
        await asyncio.sleep(1)
    
    return all_embeddings
