# SevanaGPT

**An AI-powered discovery platform for Indian government welfare schemes — search, chat, and check eligibility across 4,600+ schemes in 22 Indian languages.**

<p>
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16%20+%20pgvector-4169E1?logo=postgresql&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white">
</p>

---

## The problem

India runs **thousands of central and state welfare schemes** across 50+ ministries — spanning agriculture, education, health, housing, and social welfare. Most citizens never claim the benefits they qualify for, because the information is fragmented across dozens of portals, buried in bureaucratic language, and rarely available in their mother tongue.

**SevanaGPT** closes that gap with a single, conversational, multilingual entry point to scheme discovery.

## What it does

- 💬 **Conversational assistant** — an FSM-driven chatbot that understands a user's situation in natural language and recommends relevant schemes, backed by an LLM.
- 🔍 **Hybrid search** — combines keyword search with semantic (vector) search over `pgvector`, fused with Reciprocal Rank Fusion (RRF) for high-quality results.
- ✅ **Eligibility wizard** — scores schemes against a user profile to surface what they actually qualify for.
- 🌐 **22 Indian languages** — full UI + content translation via a self-hosted **IndicTrans2** neural MT microservice (GPU-accelerated, with  LoRA fine-tuning) and a Google Translate fallback.
- 🎙️ **Voice input & read-aloud** — Web Speech API for accessibility in low-literacy contexts.
- 📚 **Browsable catalog** — schemes indexed by category, state, and ministry.

Scheme data is aggregated from official sources: **MyScheme.gov.in**, **data.gov.in**, Kaggle datasets, and HuggingFace Hub.

## Architecture

Four containerized services orchestrated with Docker Compose:

```
                    ┌─────────────────────────-─┐
                    │   frontend  (Next.js 16)  │  :3000
                    │   React 19 · TS · Tailwind│
                    └────────────┬─────────────-┘
                                 │ REST /api/v1
                    ┌────────────▼───────────-──┐
                    │   backend  (FastAPI)      │  :8000
                    │   async · SQLAlchemy 2.0  │
                    │   chatbot FSM · hybrid    │
                    │   search · eligibility    │
                    └───────┬───────────┬─────-─┘
                            │           │
              ┌─────────────▼──┐   ┌────▼─────────────────┐
              │  db (Postgres  │   │  indictrans (FastAPI)│  :7860
              │  16 + pgvector)│   │  IndicTrans2 + LoRA  │
              │  :5433         │   │  GPU neural MT       │
              └────────────────┘   └──────────────────────┘
```

| Service       | Stack                                                        | Port |
|---------------|--------------------------------------------------------------|------|
| **db**        | PostgreSQL 16 + `pgvector` (schemes, embeddings, chat)       | 5433 |
| **backend**   | FastAPI, Python 3.12, async SQLAlchemy 2.0 + asyncpg, Alembic| 8000 |
| **frontend**  | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind 4  | 3000 |
| **indictrans**| IndicTrans2 (`ai4bharat/indictrans2-en-indic-dist-200M`), PyTorch/CUDA | 7860 |

**Key design choices**

- **Hybrid search** in `search_service.py` — keyword + 1024-dim Mistral semantic vectors, merged via RRF.
- **Chatbot FSM** (`chatbot/fsm.py`) — deterministic states: `GREETING → NEED_EXTRACTION → SCHEME_SEARCH → SCHEME_DETAIL → CLOSING` (with `DISAMBIGUATION`), keeping LLM behavior predictable.
- **LLM layer** — Mistral AI (primary) with Groq as a free fallback.
- **Translation pipeline** — IndicTrans2 first, Google Translate fallback; a per-scheme cache avoids re-translating content.
- **Async everywhere** — non-blocking DB access and batched, rate-limit-aware embedding generation.

## Repository structure

```
sevanagpt/
├── backend/            FastAPI app
│   ├── app/
│   │   ├── api/v1/      REST routers (schemes, chat, search, eligibility, …)
│   │   ├── chatbot/     FSM + prompts
│   │   ├── services/    business logic (search, chat, embeddings, translation)
│   │   ├── data/        ingestion + translation pipelines
│   │   ├── models/      SQLAlchemy models
│   │   └── schemas/     Pydantic schemas
│   ├── alembic/        database migrations
│   └── tests/          pytest suite
├── frontend/           Next.js app (App Router, i18n, chat UI, browse pages)
│   └── public/locales/ translations for 22 languages
├── indictrans/         IndicTrans2 neural-MT microservice
├── Fine-tuning/        LoRA fine-tuning scripts + evaluation results
├── docker-compose.yml  full-stack orchestration
└── Makefile            common dev commands
```

## Getting started

### Prerequisites
- Docker + Docker Compose
- (Optional) an NVIDIA GPU for the `indictrans` service; the stack runs without it.
- API keys for [Mistral](https://console.mistral.ai) and [Groq](https://console.groq.com) (both have free tiers).

### Quick start (Docker)

```bash
# 1. Configure environment
cp backend/.env.example backend/.env      # add MISTRAL_API_KEY, GROQ_API_KEY
cp frontend/.env.example frontend/.env.local

# 2. Launch the stack (without the GPU translation service)
docker compose up -d db backend frontend

# 3. Set up the database
docker exec myscheme-backend alembic upgrade head
docker exec myscheme-backend python -m app.data.seed
```

Then open **http://localhost:3000**. API docs live at **http://localhost:8000/docs**.

To include GPU translation: `docker compose up -d --build` (requires an `HF_TOKEN` — see `indictrans/.env.example`).

### Local development

Common tasks are wrapped in the `Makefile`:

```bash
make db-up        # start PostgreSQL
make backend      # uvicorn --reload on :8000
make frontend     # next dev on :3000
make migrate      # alembic upgrade head
make seed         # seed categories, states, ministries
make test         # backend pytest
```

## Data pipeline

Ingestion is idempotent (slug-based dedup) and runs in order — seed → ingest → embed:

```bash
docker exec myscheme-backend python -m app.data.ingest_all           # full pipeline
docker exec myscheme-backend python -m app.data.generate_embeddings  # embeddings only
docker exec myscheme-backend python -m app.data.run_translations --all
```

## Testing

```bash
cd backend && pytest              # full suite
cd backend && pytest tests/test_search.py -v
```

The suite covers search quality, the chat service, eligibility scoring, link extraction/validation, translation quality, and performance.

## Fine-tuning 

`Fine-tuning/` contains a LoRA pipeline that adapts IndicTrans2 to government-scheme terminology: parallel-data extraction, glossary building, training (`train_lora.py`), and evaluation with BLEU comparisons against the base model. Trained weights and checkpoints are excluded from the repo; the scripts and evaluation results are included to document the approach.

## Tech stack

**Backend** — FastAPI · SQLAlchemy 2.0 (async) · asyncpg · Alembic · pgvector · Mistral AI · Groq
**Frontend** — Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
**ML / NLP** — IndicTrans2 · PyTorch · PEFT (LoRA) · Mistral embeddings
**Infra** — Docker Compose · PostgreSQL 16

## Authors

Final-year B.Tech (AI & ML) project, Vidya Academy of Science & Technology (APJ Abdul Kalam Technological University).

- Albrin T B
- Deva Nanda Gopi
- Goutham Krishna K S
- Hiba P S

## License

Released under the [MIT License](LICENSE).

---

<sub>Built as a full-stack + applied-ML project demonstrating hybrid retrieval, multilingual NLP, and production-style service orchestration.</sub>

---
