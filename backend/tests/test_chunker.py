import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chunker import count_tokens, chunk_text, deduplicate_list, _split_large_paragraph


# ── count_tokens ──────────────────────────────────────────────────────────────

def test_count_tokens_basic():
    # 12 chars // 4 = 3
    assert count_tokens("hello world!") == 3


def test_count_tokens_empty():
    assert count_tokens("") == 0


def test_count_tokens_long():
    text = "a" * 400
    assert count_tokens(text) == 100


# ── chunk_text ────────────────────────────────────────────────────────────────

def test_chunk_text_single_chunk():
    text = "Short paragraph.\n\nAnother short one."
    chunks = chunk_text(text, max_tokens=500)
    assert len(chunks) == 1
    assert "Short paragraph" in chunks[0]
    assert "Another short one" in chunks[0]


def test_chunk_text_splits_at_paragraphs():
    # Each paragraph is ~100 tokens (400 chars); limit is 150 tokens → forces a split
    para_a = "A" * 400
    para_b = "B" * 400
    text = para_a + "\n\n" + para_b
    chunks = chunk_text(text, max_tokens=150)
    assert len(chunks) == 2
    assert chunks[0].strip() == para_a
    assert chunks[1].strip() == para_b


@pytest.mark.parametrize("size", [100, 500, 1000, 5000, 14000])
def test_chunk_no_chunk_exceeds_limit(size):
    # Generate text of `size` tokens (~4 chars each)
    text = ("word " * (size * 4))  # many small paragraphs separated by double newlines
    # Insert paragraph breaks every 200 chars so chunker has boundaries to use
    parts = [text[i:i+200] for i in range(0, len(text), 200)]
    text_with_breaks = "\n\n".join(parts)
    max_tokens = 300
    chunks = chunk_text(text_with_breaks, max_tokens=max_tokens)
    for chunk in chunks:
        assert count_tokens(chunk) <= max_tokens, (
            f"Chunk exceeds limit: {count_tokens(chunk)} > {max_tokens}"
        )


def test_chunk_text_empty():
    assert chunk_text("", max_tokens=500) == []


def test_chunk_text_preserves_content():
    paras = [f"Paragraph {i}." for i in range(10)]
    text = "\n\n".join(paras)
    chunks = chunk_text(text, max_tokens=50)
    combined = " ".join(chunks)
    for para in paras:
        assert para in combined


# ── _split_large_paragraph ────────────────────────────────────────────────────

def test_split_large_paragraph_sentence_level():
    # Build a single paragraph with no double-newlines, ~800 tokens (3200 chars)
    sentences = ["This is sentence number {}.".format(i) for i in range(100)]
    big_para = " ".join(sentences)
    max_tokens = 200
    result = _split_large_paragraph(big_para, max_tokens)
    assert len(result) > 1, "Should have split the oversized paragraph"
    for chunk in result:
        assert count_tokens(chunk) <= max_tokens, (
            f"Sentence-level chunk too large: {count_tokens(chunk)}"
        )


def test_split_large_paragraph_single_sentence_fits():
    short = "One short sentence."
    result = _split_large_paragraph(short, max_tokens=500)
    assert result == [short]


# ── deduplicate_list ──────────────────────────────────────────────────────────

def test_deduplicate_exact_duplicates():
    items = ["Collects email address", "Collects email address"]
    result = deduplicate_list(items)
    assert result == ["Collects email address"]


def test_deduplicate_near_duplicates():
    # These share ~90% of tokens — should collapse to one entry
    a = "collects your email address and name"
    b = "collects email address and your name"
    result = deduplicate_list([a, b])
    assert len(result) == 1


def test_deduplicate_distinct_strings():
    a = "Shares data with advertising partners"
    b = "Mandatory binding arbitration clause"
    result = deduplicate_list([a, b])
    assert len(result) == 2


def test_deduplicate_empty_list():
    assert deduplicate_list([]) == []


def test_deduplicate_preserves_order():
    items = ["First item", "Second item", "Third item"]
    result = deduplicate_list(items)
    assert result == items
