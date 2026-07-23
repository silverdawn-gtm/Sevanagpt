# SevanaGPT Backend

FastAPI-powered backend for SevanaGPT — an AI-driven Indian government scheme discovery platform. Provides REST APIs for scheme browsing, hybrid search, a multilingual chatbot, and eligibility checking. (Voice input / read-aloud are handled client-side in the frontend via the Web Speech API — there are no voice endpoints here.)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.115.6 + Uvicorn |
| Database | PostgreSQL 16 with pgvector |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| LLM | Mistral AI (primary), Groq (fallback) |
| Embeddings | Mistral Embed (1024-dim vectors) |
| Translation | IndicTrans2 microservice (primary) + Google Translate fallback |
| HTTP Client | httpx (async) |

## Prerequisites

- Python 3.12+
- Docker & Docker Compose (for PostgreSQL + pgvector)
- API keys (optional but recommended):
  - [Mistral AI](https://console.mistral.ai) — chat + embeddings
  - [Groq](https://console.groq.com) — free chat fallback

## Quick Start

### 1. Start the database

```bash
docker compose up -d db
```

This starts PostgreSQL 16 with pgvector on port **5433**.

### 2. Set up Python environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env    # then fill in MISTRAL_API_KEY, GROQ_API_KEY
```

Key variables (see `.env.example` for the full list):

```env
DATABASE_URL=postgresql+asyncpg://myscheme:myscheme_dev@localhost:5433/myscheme

# Mistral AI — chat + embeddings
MISTRAL_API_KEY=your-key-here

# Groq — free chat fallback
GROQ_API_KEY=your-key-here

# IndicTrans2 translation microservice (empty string disables it)
INDICTRANS_URL=http://localhost:7860
```

### 4. Run database migrations

```bash
alembic upgrade head
```

### 5. Seed and ingest data

```bash
# Seed reference data (categories, states, ministries, tags)
python -m app.data.seed

# Ingest curated + state schemes embedded in the codebase
python -m app.data.ingest_hf
python -m app.data.ingest_state_schemes

# Ingest from MyScheme.gov.in API (bulk of the catalogue)
python -m app.data.ingest_myscheme

# Generate vector embeddings for semantic search (requires Mistral API key)
python -m app.data.generate_embeddings
```

Or run everything at once:

```bash
python -m app.data.ingest_all
```

### 6. Start the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at http://localhost:8000/docs

## Project Structure

```
backend/
├── app/
│   ├── api/v1/              # API route handlers
│   │   ├── schemes.py       # /schemes - list, detail, featured
│   │   ├── categories.py    # /categories - browse by category
│   │   ├── states.py        # /states - browse by state (with level filter)
│   │   ├── ministries.py    # /ministries - browse by ministry
│   │   ├── search.py        # /search - hybrid search + /search/suggest
│   │   ├── chat.py          # /chat - AI chatbot endpoints
│   │   ├── translate.py     # /translate + /languages
│   │   └── eligibility.py   # /eligibility - scheme eligibility checker
│   │
│   ├── chatbot/             # Chatbot logic
│   │   ├── fsm.py           # Finite State Machine for conversation flow
│   │   └── prompts.py       # LLM prompt templates (language-aware)
│   │
│   ├── data/                # Data ingestion pipeline
│   │   ├── seed.py          # Seed categories, states, ministries, tags
│   │   ├── ingest_hf.py     # Curated central + major state schemes
│   │   ├── ingest_state_schemes.py  # State-specific schemes
│   │   ├── ingest_myscheme.py       # MyScheme.gov.in API (bulk)
│   │   ├── ingest_kaggle.py         # Kaggle dataset (optional)
│   │   ├── ingest_datagov.py        # data.gov.in API (optional)
│   │   ├── generate_embeddings.py   # Batch vector embedding generation
│   │   ├── pre_translate.py         # Pre-translate scheme content
│   │   ├── run_translations.py      # Batch translation launcher
│   │   └── ingest_all.py            # Orchestrator for all ingestion steps
│   │
│   ├── models/              # SQLAlchemy models
│   │   ├── scheme.py        # Scheme, Category, State, Ministry, Tag, embeddings
│   │   ├── chat.py          # Conversation, Message
│   │   └── cache.py         # Translation cache
│   │
│   ├── schemas/             # Pydantic response schemas
│   ├── services/            # Business logic layer
│   │   ├── chat_service.py        # Chat pipeline (FSM + LLM + search)
│   │   ├── search_service.py      # Hybrid search (keyword + semantic + RRF)
│   │   ├── mistral_service.py     # LLM chat/embedding (Mistral + Groq)
│   │   ├── indictrans_client.py   # HTTP client for the IndicTrans2 microservice
│   │   ├── translate_service.py   # Translation orchestration + caching
│   │   ├── embedding_service.py   # Batch embedding generation
│   │   └── eligibility_service.py # Eligibility matching engine
│   │
│   ├── utils/               # Utilities
│   │   ├── scheme_translate.py   # Translate scheme responses
│   │   ├── translations.py       # Pre-computed translation dictionaries
│   │   ├── languages.py          # Language code mappings
│   │   ├── rate_limit.py         # Rate limiting
│   │   └── slug.py               # URL slug generation
│   │
│   ├── config.py            # Pydantic settings (env vars)
│   ├── database.py          # Async engine + session factory
│   └── main.py              # FastAPI app entry point
│
├── alembic/                 # Database migration scripts
├── tests/                   # pytest suite
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container build
└── .env.example             # Environment variable template
```

## API Endpoints

### Schemes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/schemes` | List schemes (filters: category, state, ministry, level, tag, search) |
| GET | `/api/v1/schemes/featured` | Get featured schemes |
| GET | `/api/v1/schemes/{slug}` | Scheme detail |

### Taxonomy
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/categories` | List all categories with scheme counts |
| GET | `/api/v1/categories/{slug}` | Schemes in a category |
| GET | `/api/v1/states` | List all states/UTs with scheme counts |
| GET | `/api/v1/states/{slug}` | Schemes in a state (filter by `level=state\|central`) |
| GET | `/api/v1/ministries` | List all ministries |
| GET | `/api/v1/ministries/{slug}` | Schemes by ministry |

### Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/search` | Hybrid keyword + semantic search |
| GET | `/api/v1/search/suggest` | Auto-complete suggestions |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/chat/message` | Send message, get AI response + scheme cards |
| GET | `/api/v1/chat/history/{session_id}` | Get conversation history |
| POST | `/api/v1/chat/reset/{session_id}` | Reset conversation |

### Translation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/translate` | Translate text into a target language |
| GET | `/api/v1/languages` | List supported languages |

### Eligibility
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/eligibility/check` | Check eligibility based on user profile |
| GET | `/api/v1/eligibility/options` | Get filter options (genders, categories, states) |

## Key Implementation Details

### Hybrid Search (Reciprocal Rank Fusion)

Search combines two strategies and merges results using RRF:

1. **Keyword search** — ILIKE pattern matching across scheme name, description, benefits, and eligibility fields
2. **Semantic search** — pgvector cosine distance using Mistral 1024-dim embeddings

Results are merged using the formula `score = 1 / (k + rank + 1)` with `k=60`. Non-English queries are translated to English before retrieval.

### Chatbot FSM

The conversational AI uses a Finite State Machine:

```
GREETING → NEED_EXTRACTION → SCHEME_SEARCH → SCHEME_DETAIL → CLOSING
                                  ↕
                           DISAMBIGUATION
```

- **Intent classification**: Mistral/Groq LLM classifies user intent, with a keyword-based fallback
- **Entity extraction**: Extracts age, gender, state, category, income from conversation context
- **Language-aware**: system prompts instruct the LLM to respond in the user's language
- **Scheme card translation**: scheme names and descriptions are translated for non-English users

### Data Ingestion Pipeline

```
seed.py → ingest_hf.py → ingest_state_schemes.py → ingest_myscheme.py → generate_embeddings.py
```

| Source | Description |
|--------|-------------|
| ingest_hf.py | Hand-curated central + major state schemes embedded in the codebase |
| ingest_state_schemes.py | State-specific schemes |
| ingest_myscheme.py | Official MyScheme.gov.in API (bulk of the ~4,600+ catalogue) |
| ingest_kaggle.py / ingest_datagov.py | Optional supplementary sources (require API keys) |

All ingestion scripts use slug-based deduplication and are idempotent (safe to re-run).

### Multilingual Support

**22 Indian languages + English.** 11 are served via the MyScheme API's own translations (hi, bn, ta, te, mr, gu, kn, ml, pa, or, ur); the remaining 11 (as, ne, sa, sd, mai, doi, kok, sat, mni, bodo, lus) via IndicTrans2 with a Google Translate fallback. Note: `bodo` and `sat` have no Google Translate support (IndicTrans2 only).

Translation is layered:
1. **scheme_translations table** — pre-computed translations (instant)
2. **IndicTrans2 microservice** — neural MT (primary), with Google Translate fallback
3. **Static dictionaries** — pre-translated category, state, ministry names

## Testing

```bash
pytest                       # unit + mocked tests (in-memory SQLite, external services mocked)
pytest -m "integration"      # tests that need a live Postgres/pgvector database
pytest -m "benchmark"        # performance/quality benchmarks (need a running backend on :8000)
```

By default `pytest` skips the `benchmark` and `integration` markers so the suite runs fast and self-contained.

## Make Commands

From the project root:

```bash
make db-up      # Start PostgreSQL container
make db-down    # Stop all containers
make migrate    # Run alembic upgrade head
make seed       # Seed reference data
make ingest     # Ingest schemes
make embed      # Generate embeddings
make backend    # Start backend server
make frontend   # Start frontend dev server
make test       # Run backend tests
```

## Database Reset

To completely reset and re-ingest:

```bash
docker compose down -v
docker compose up -d db
# Wait ~5 seconds for DB to be healthy
cd backend
alembic upgrade head
python -m app.data.ingest_all
```
