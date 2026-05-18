import re
from typing import List


def count_tokens(text: str) -> int:
    # Approximation: ~4 characters per token (good enough for chunking)
    return len(text) // 4


def chunk_text(text: str, max_tokens: int = 3500) -> List[str]:
    """Split text at paragraph boundaries so no chunk exceeds max_tokens."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: List[str] = []
    current: List[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = count_tokens(para)
        # If a single paragraph is larger than the limit, split it by sentences
        if para_tokens > max_tokens:
            if current:
                chunks.append("\n\n".join(current))
                current = []
                current_tokens = 0
            chunks.extend(_split_large_paragraph(para, max_tokens))
            continue

        if current_tokens + para_tokens > max_tokens:
            chunks.append("\n\n".join(current))
            current = [para]
            current_tokens = para_tokens
        else:
            current.append(para)
            current_tokens += para_tokens

    if current:
        chunks.append("\n\n".join(current))

    return chunks


def _split_large_paragraph(text: str, max_tokens: int) -> List[str]:
    """Fallback: split an oversized paragraph by sentence-ending punctuation."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: List[str] = []
    current: List[str] = []
    current_tokens = 0

    for sentence in sentences:
        t = count_tokens(sentence)
        if current_tokens + t > max_tokens:
            if current:
                chunks.append(" ".join(current))
            current = [sentence]
            current_tokens = t
        else:
            current.append(sentence)
            current_tokens += t

    if current:
        chunks.append(" ".join(current))
    return chunks


def deduplicate_list(items: List[str], threshold: float = 0.82) -> List[str]:
    """Remove near-duplicate strings using Jaccard token overlap.

    Jaccard similarity is used instead of embeddings because it requires no
    model, no GPU, and no network call — acceptable precision for list
    deduplication where paraphrased duplicates share most of the same tokens.
    """
    unique: List[str] = []
    for item in items:
        item_tokens = set(item.lower().split())
        is_dup = any(
            len(item_tokens & set(u.lower().split())) /
            max(len(item_tokens | set(u.lower().split())), 1) >= threshold
            for u in unique
        )
        if not is_dup:
            unique.append(item)
    return unique
