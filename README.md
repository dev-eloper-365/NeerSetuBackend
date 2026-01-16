# INGRES RAG Backend

Local embeddings + ChromaDB + Groq LLM backend for the INGRES groundwater data RAG system.

## Architecture

```
User Query → Local Embeddings (BGE-small) → ChromaDB Search → Groq LLM → Response
```

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker (for ChromaDB)
- Groq API key (free at https://console.groq.com)

### 2. Setup

```bash
# Install dependencies
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 3. Start ChromaDB

```bash
# From project root
docker-compose up -d
```

### 4. Ingest Data (One-time)

```bash
npm run ingest
```

This will:
- Load all documents from `output/semantic_chunks.jsonl`
- Generate embeddings locally using BGE-small (~50MB model, downloads on first run)
- Store vectors in ChromaDB

### 5. Start Server

```bash
npm run dev
```

Server runs at `http://localhost:3001`

## API Endpoints

### `POST /api/embed`
Generate embedding for text.

```json
{
  "text": "groundwater recharge in Maharashtra"
}
```

### `POST /api/search`
Search for similar documents.

```json
{
  "query": "water table depth in Rajasthan",
  "topK": 5,
  "filters": {
    "state": "Rajasthan",
    "year": "2024-2025"
  }
}
```

### `GET /api/search/stats`
Get vector store statistics.

### `POST /api/chat`
Full RAG chat (non-streaming).

```json
{
  "query": "What is the groundwater status in Punjab?",
  "chatHistory": [],
  "topK": 5
}
```

### `POST /api/chat/stream`
Streaming RAG chat (SSE).

Returns Server-Sent Events with:
- `sources` - Retrieved documents
- `token` - Streamed response tokens
- `suggestions` - Follow-up questions
- `done` - Completion signal

### `GET /api/health`
Health check endpoint.

## Tech Stack

- **Embeddings**: `@xenova/transformers` (BGE-small-en-v1.5, 384 dims)
- **Vector DB**: ChromaDB
- **LLM**: Groq (llama-3.1-70b-versatile)
- **Framework**: Express.js + TypeScript

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Groq API key | Required |
| `CHROMA_URL` | ChromaDB URL | `http://localhost:8000` |
| `PORT` | Server port | `3001` |
| `COLLECTION_NAME` | ChromaDB collection | `ingres_groundwater` |
# NeerSetuBackend
