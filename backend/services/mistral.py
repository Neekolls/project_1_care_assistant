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
    model: str = "mistral-small-latest",
    temperature: float = 0.7,
    max_tokens: int = 500
) -> str:
    """
    Génère une réponse via Mistral
    
    Args:
        client: Client Mistral
        system_prompt: Prompt système
        rag_context: Contexte des documents
        conversation_history: Historique formaté
        user_message: Message de l'utilisateur
        
    Returns:
        Réponse générée
    """
    messages = [
        {"role": "system", "content": system_prompt + rag_context}
    ]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})
    
    response = client.chat.complete(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    
    return response.choices[0].message.content.strip()
