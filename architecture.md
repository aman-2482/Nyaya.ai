# NyayaAI – Architecture Documentation

## System Overview

NyayaAI is a **Retrieval-Augmented Generation (RAG)** system that combines:
1. **Document retrieval** from a FAISS vector index of Indian legal documents
2. **Language Model generation** via OpenRouter for structured, bilingual responses

This architecture ensures responses are **grounded in actual legal text** rather than hallucinated.

---

## RAG Flow

```mermaid
flowchart TD
    A[User Query] --> B[Input Sanitisation]
    B --> C[Generate Query Embedding]
    C --> D[FAISS Similarity Search]
    D --> E["Retrieve Top-K Chunks (K=5)"]
    E --> F[Build Prompt with Context]
    F --> G[OpenRouter LLM Call]
    G --> H[Parse Structured JSON]
    H --> I[Return AskResponse to Frontend]

    style A fill:#ff9838,stroke:#333,color:#fff
    style D fill:#3b82f6,stroke:#333,color:#fff
    style G fill:#22c55e,stroke:#333,color:#fff
    style I fill:#ff9838,stroke:#333,color:#fff
```

---

## Embedding Process

```mermaid
flowchart LR
    subgraph Ingestion Pipeline
        A[Legal PDFs] --> B[PyPDF Text Extraction]
        B --> C[Text Cleaning]
        C --> D["RecursiveCharacterTextSplitter<br/>(1000 chars, 200 overlap)"]
        D --> E[Metadata Extraction<br/>from Filename]
        E --> F["all-MiniLM-L6-v2<br/>(384-dim embeddings)"]
        F --> G[FAISS IndexFlatL2]
    end

    style A fill:#ff9838,stroke:#333,color:#fff
    style F fill:#3b82f6,stroke:#333,color:#fff
    style G fill:#22c55e,stroke:#333,color:#fff
```

### Details:
- **Model:** `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, normalised)
- **Index:** FAISS `IndexFlatL2` – exact search, suitable for < 100K vectors
- **Chunking:** Recursive splitting on `\n\n`, `\n`, `. `, ` ` boundaries
- **Metadata per chunk:**
  ```json
  {
    "law": "IPC",
    "section": "Section 302",
    "source": "IPC__Section-302__Criminal.pdf",
    "category": "Criminal"
  }
  ```

---

## Retrieval Process

1. **Query embedding** – The user's question is encoded using the same MiniLM model.
2. **FAISS search** – L2 distance search returns the top-K most similar chunks.
3. **Score-based ranking** – Lower L2 distance = more relevant.
4. **Metadata preservation** – Each chunk carries its law, section, source, and category.

```mermaid
sequenceDiagram
    participant U as User
    participant API as FastAPI
    participant E as EmbeddingService
    participant F as FAISS Index
    participant LLM as OpenRouter

    U->>API: POST /ask {query, language}
    API->>API: sanitize_input()
    API->>E: embed_query(query)
    E-->>API: query_vector [384-dim]
    API->>F: search(query_vector, k=5)
    F-->>API: top-5 chunks + metadata
    API->>API: build_messages(query, chunks, language)
    API->>LLM: POST /chat/completions
    LLM-->>API: JSON response
    API->>API: parse_json() + add disclaimer
    API-->>U: AskResponse (structured JSON)
```

---

## LLM Interaction

### Provider: OpenRouter
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Model:** `mistralai/mistral-7b-instruct` (free tier)
- **Temperature:** 0.2 (low for factual accuracy)
- **Max Tokens:** 1024

### Prompt Structure:
1. **System Prompt** – Defines NyayaAI persona, rules (bilingual, no jargon, must cite law, must disclaim), and required JSON output schema.
2. **User Prompt** – Contains: retrieved context chunks with metadata, user's question, and language instruction.

### Output Format:
```json
{
  "summary": "Plain-language explanation",
  "relevant_law": "Section X of Y Act, 20XX",
  "your_rights": "Rights in this situation",
  "next_steps": ["Step 1", "Step 2", "Step 3"],
  "disclaimer": "This is informational only..."
}
```

### Fallback Strategy:
If the LLM response cannot be parsed as JSON:
1. Try extracting JSON from markdown code fences
2. Try finding first `{...}` block
3. Fallback: use raw text as `summary` field

---

## Deployment Flow

```mermaid
flowchart LR
    subgraph Development
        A[Local Dev] --> B[Git Push]
    end

    subgraph Backend - Render
        B --> C[Render Auto-Deploy]
        C --> D["pip install"]
        D --> E["uvicorn app.main:app"]
        E --> F[https://nyayaai.onrender.com]
    end

    subgraph Frontend - Vercel
        B --> G[Vercel Auto-Deploy]
        G --> H["npm run build"]
        H --> I[https://nyayaai.vercel.app]
    end

    I -->|API Rewrite| F

    style A fill:#ff9838,stroke:#333,color:#fff
    style F fill:#22c55e,stroke:#333,color:#fff
    style I fill:#3b82f6,stroke:#333,color:#fff
```

### Environment Variables:

| Variable             | Where       | Description                      |
| -------------------- | ----------- | -------------------------------- |
| `OPENROUTER_API_KEY` | Render      | OpenRouter API key               |
| `MODEL_NAME`         | Render      | LLM model identifier             |
| `VITE_API_URL`       | Vercel      | Backend URL for API calls         |

---

## Security Architecture

```
User Input → Sanitise (regex) → Validate Length → Rate Limit (slowapi)
                                                         ↓
                                                   Process Query
                                                         ↓
                                              Return with Disclaimer
```

- **Prompt injection detection** – 10+ regex patterns for common injection attempts
- **Input cleaning** – null bytes, control chars, whitespace normalisation
- **Length validation** – 5–2000 character bounds
- **Rate limiting** – 10 req/min per IP via `slowapi`
- **CORS** – configurable allowed origins
- **No secrets in code** – all via `.env` / environment variables
