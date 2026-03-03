# backend/services/mistral.py
"""
Service d'appel Mistral pour le chat
"""
from mistralai import Mistral


def build_system_prompt() -> str:
    """Construit le prompt système"""
    return """Tu es un assistant de support client intelligent et serviable.

Utilise les documents fournis pour répondre avec précision.
Reste concis, professionnel et courtois.

IMPORTANT - Formatage de tes réponses :
- N'utilise pas de markdown
- Reste lisible et aéré sans abuser du formatage
"""


def build_rag_context(chunks: list[dict]) -> str:
    """
    Construit le contexte RAG à partir des chunks
    
    Args:
        chunks: Liste de dicts avec clé "content"
        
    Returns:
        Contexte formaté
    """
    if not chunks:
        return ""
    
    contents = [chunk["content"] for chunk in chunks]
    return "\n\nDocuments:\n" + "\n---\n".join(contents)


def build_conversation_history(messages: list[dict]) -> list[dict]:
    """
    Transforme l'historique en format Mistral
    
    Args:
        messages: [{"sender_role": "USER"|"BOT", "content": "..."}]
        
    Returns:
        [{"role": "user"|"assistant", "content": "..."}]
    """
    history = []
    for msg in messages:
        role = "user" if msg["sender_role"] == "USER" else "assistant"
        history.append({"role": role, "content": msg["content"]})
    return history


async def generate_chat_response(
    client: Mistral,
    system_prompt: str,
    rag_context: str,
    conversation_history: list[dict],
    user_message: str,
    model: str = "open-mistral-7b",
    temperature: float = 0.7,
    max_tokens: int = 500
) -> str:
    """
    Génère une réponse via Mistral avec retry sur rate limit
    
    Args:
        client: Client Mistral
        system_prompt: Prompt système
        rag_context: Contexte des documents
        conversation_history: Historique formaté
        user_message: Message de l'utilisateur
        
    Returns:
        Réponse générée
    """
    import asyncio
    
    messages = [
        {"role": "system", "content": system_prompt + rag_context}
    ]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})
    
    # Retry avec backoff exponentiel
    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.chat.complete(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            error_str = str(e)
            
            # Rate limit (429)
            if "429" in error_str or "rate" in error_str.lower():
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)  # 2, 4, 8, 16, 32 secondes
                    print(f"   ⏳ Rate limit on chat, retry {attempt + 1}/{max_retries} in {wait_time}s")
                    await asyncio.sleep(wait_time)
                else:
                    raise Exception(f"Rate limit persists after {max_retries} retries")
            else:
                # Autre erreur → fail immédiatement
                raise


async def generate_summary(
    client: Mistral,
    current_summary: str,
    recent_messages: list[dict],
    model: str = "mistral-small-latest"
) -> str:
    """
    Génère un résumé cumulatif de la conversation avec retry
    
    Args:
        client: Client Mistral
        current_summary: Résumé actuel (peut être vide)
        recent_messages: Derniers messages depuis le dernier résumé
        
    Returns:
        Nouveau résumé mis à jour
    """
    import asyncio
    
    # Formater les messages
    conversation_text = "\n".join([
        f"{msg['sender_role']}: {msg['content']}"
        for msg in recent_messages
    ])
    
    if current_summary:
        prompt = f"""Voici le résumé actuel de la conversation :
{current_summary}

Voici les nouveaux messages depuis ce résumé :
{conversation_text}

Génère un nouveau résumé CUMULATIF qui :
1. Intègre les informations du résumé précédent
2. Ajoute les nouveaux éléments importants des derniers messages
3. Reste concis (3-5 phrases maximum)
4. Capture les besoins du client, les solutions proposées, et l'état de la conversation

Nouveau résumé :"""
    else:
        prompt = f"""Voici le début d'une conversation de support client :
{conversation_text}

Génère un résumé concis (3-5 phrases) qui capture :
1. Le besoin principal du client
2. Les informations importantes échangées
3. L'état actuel de la conversation

Résumé :"""
    
    # Retry avec backoff exponentiel
    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.chat.complete(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=200
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            error_str = str(e)
            
            if "429" in error_str or "rate" in error_str.lower():
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    print(f"   ⏳ Rate limit on summary, retry {attempt + 1}/{max_retries} in {wait_time}s")
                    await asyncio.sleep(wait_time)
                else:
                    raise Exception(f"Rate limit persists after {max_retries} retries")
            else:
                raise