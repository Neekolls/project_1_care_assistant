# backend/services/pdf_parser.py
"""
Service d'extraction et chunking de PDFs
"""
import PyPDF2


def extract_text_from_pdf(file_path: str) -> list[dict]:
    """
    Extrait texte d'un PDF et le découpe en chunks
    
    Stratégie simple : split sur double saut de ligne
    
    Args:
        file_path: Chemin vers le PDF
        
    Returns:
        Liste de chunks avec page_number, content, chunk_index
    """
    chunks = []
    chunk_index = 0
    
    with open(file_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text = page.extract_text()
            
            # Split sur double saut de ligne
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
            
            for para in paragraphs:
                if len(para) > 50:  # Minimum 50 chars
                    chunks.append({
                        "page_number": page_num + 1,
                        "content": para,
                        "chunk_index": chunk_index
                    })
                    chunk_index += 1
    
    return chunks
