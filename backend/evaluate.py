"""
NyayaAI – Evaluation Script
==============================
Tests the RAG pipeline with 10 sample Indian legal questions.
Prints retrieved chunks and generated answers for manual inspection.

Usage (from backend/ directory):
    python evaluate.py
"""

import asyncio
import sys
import time
from pathlib import Path

# Ensure backend root is on path
_BACKEND_ROOT = Path(__file__).resolve().parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.rag.retriever import retriever
from app.services.llm_service import call_llm

# ── Test questions covering diverse legal areas ──────────────────────────
TEST_QUESTIONS = [
    {
        "query": "What are my rights if my landlord refuses to return my security deposit?",
        "language": "en",
        "category": "Rental/Property Law",
    },
    {
        "query": "Can a woman file a case of domestic violence against her in-laws?",
        "language": "en",
        "category": "Family Law / DV Act",
    },
    {
        "query": "मुझे ऑनलाइन शॉपिंग में नकली प्रोडक्ट मिला, मैं क्या कर सकता हूँ?",
        "language": "hi",
        "category": "Consumer Protection",
    },
    {
        "query": "What is the punishment for cheque bounce under Indian law?",
        "language": "en",
        "category": "Negotiable Instruments Act",
    },
    {
        "query": "How can I file an FIR if the police refuse to register it?",
        "language": "en",
        "category": "Criminal Procedure",
    },
    {
        "query": "What are the legal rights of an employee who is terminated without notice?",
        "language": "en",
        "category": "Labour Law",
    },
    {
        "query": "क्या मुझे गिरफ्तारी के समय वकील का अधिकार है?",
        "language": "hi",
        "category": "Criminal Law / Fundamental Rights",
    },
    {
        "query": "What is the process to file a complaint in consumer court?",
        "language": "en",
        "category": "Consumer Protection",
    },
    {
        "query": "Can I get bail immediately after being arrested for a bailable offence?",
        "language": "en",
        "category": "Criminal Procedure (Bail)",
    },
    {
        "query": "What legal action can I take against cyberbullying in India?",
        "language": "en",
        "category": "IT Act / Cyber Law",
    },
]


def print_separator(char: str = "═", width: int = 80):
    print(char * width)


def print_header(text: str):
    print_separator()
    print(f"  {text}")
    print_separator()


async def evaluate():
    """Run all test questions through the RAG pipeline and print results."""
    print_header("NyayaAI – Evaluation Suite")
    print(f"Total questions: {len(TEST_QUESTIONS)}\n")

    # Load retriever
    retriever.load_index()
    if not retriever.is_loaded:
        print("⚠  FAISS index not found. Run ingestion first:")
        print("   python -m app.rag.ingest")
        print("\nSkipping LLM calls. Showing questions only.\n")

        for i, q in enumerate(TEST_QUESTIONS, 1):
            print(f"\n[Q{i}] ({q['category']}) [{q['language'].upper()}]")
            print(f"  {q['query']}")
        return

    total_retrieval_time = 0
    total_llm_time = 0

    for i, q in enumerate(TEST_QUESTIONS, 1):
        print(f"\n{'─' * 80}")
        print(f"[Q{i}/{len(TEST_QUESTIONS)}] ({q['category']}) [{q['language'].upper()}]")
        print(f"  Query: {q['query']}")
        print(f"{'─' * 80}")

        # Retrieval
        t0 = time.time()
        chunks = retriever.retrieve(q["query"])
        retrieval_time = time.time() - t0
        total_retrieval_time += retrieval_time

        print(f"\n  📚 Retrieved {len(chunks)} chunks ({retrieval_time:.2f}s)")
        for j, chunk in enumerate(chunks, 1):
            print(f"\n  [Chunk {j}]")
            print(f"    Law: {chunk.get('law', 'N/A')}")
            print(f"    Section: {chunk.get('section', 'N/A')}")
            print(f"    Score: {chunk.get('score', 'N/A'):.4f}")
            print(f"    Text: {chunk['text'][:200]}...")

        # LLM call
        try:
            t1 = time.time()
            response = await call_llm(
                user_query=q["query"],
                context_chunks=chunks,
                language=q["language"],
            )
            llm_time = time.time() - t1
            total_llm_time += llm_time

            print(f"\n  🤖 LLM Response ({llm_time:.2f}s):")
            print(f"    Summary: {response.get('summary', 'N/A')[:300]}")
            print(f"    Relevant Law: {response.get('relevant_law', 'N/A')}")
            print(f"    Rights: {response.get('your_rights', 'N/A')[:200]}")
            next_steps = response.get("next_steps", [])
            if next_steps:
                print(f"    Next Steps:")
                for step in next_steps:
                    print(f"      • {step}")
        except Exception as e:
            print(f"\n  ❌ LLM Error: {e}")

    # Summary
    print_header("Evaluation Summary")
    print(f"  Questions tested:       {len(TEST_QUESTIONS)}")
    print(f"  Total retrieval time:   {total_retrieval_time:.2f}s")
    print(f"  Avg retrieval time:     {total_retrieval_time / len(TEST_QUESTIONS):.2f}s")
    if total_llm_time > 0:
        print(f"  Total LLM time:         {total_llm_time:.2f}s")
        print(f"  Avg LLM time:           {total_llm_time / len(TEST_QUESTIONS):.2f}s")
    print_separator()


if __name__ == "__main__":
    asyncio.run(evaluate())
