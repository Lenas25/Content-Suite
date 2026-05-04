# Content Suite — Reto Técnico

Plataforma de consistencia de marca con tres módulos funcionales: generación de manuales de marca, motor creativo con RAG híbrido y auditoría multimodal de imágenes.

**Stack:** FastAPI · Supabase (pgvector + BM25) · Groq Llama 3.3 · Google Gemini · Next.js · Langfuse

---

## Acceso a la aplicación

| URL                                       | Descripción                               |
| ----------------------------------------- | ----------------------------------------- |
| `https://content-suite-neon.vercel.app`   | Aplicación web (Next.js)                  |
| `https://content-suite-mmh2.onrender.com` | API REST (FastAPI) · `/docs` para Swagger |

### Credenciales de los 3 roles

| Rol         | Usuario       | Contraseña                            |
| ----------- | ------------- | ------------------------------------- |
| Creador     | `creador`     | _(ver .env — `CREADOR_PASSWORD`)_     |
| Aprobador A | `aprobador_a` | _(ver .env — `APROBADOR_A_PASSWORD`)_ |
| Aprobador B | `aprobador_b` | _(ver .env — `APROBADOR_B_PASSWORD`)_ |

### Observabilidad en Langfuse

Proyecto Langfuse con trazas en vivo de todas las llamadas LLM y RAG:
`https://cloud.langfuse.com` → proyecto **Content Suite**

---

## Módulos

### Módulo I — Brand DNA Architect (`/brand`)

El **Creador** ingresa un brief (nombre del producto, tono, público, valores, restricciones). El sistema genera un manual de marca completo en Markdown usando el LLM y lo indexa en Supabase con embeddings de Google (`gemini-embedding-001`, dim=768) para RAG.

### Módulo II — Creative Engine (`/content`)

Genera descripciones de producto, guiones de video y prompts de imagen. Usa **Hybrid Search** (pgvector coseno + BM25 con RRF) sobre el manual de marca seleccionado para que el contenido esté alineado con el tono y las restricciones de la marca.

### Módulo III — Governance (`/audit`)

El **Aprobador A** revisa y aprueba/rechaza el contenido generado. El **Aprobador B** sube una imagen y el sistema la audita contra el manual de marca usando **Gemini Vision** (`gemini-2.5-flash-lite`) con structured output. Todas las auditorías quedan registradas en `audit_logs`.

---

## Arquitectura RAG

```
Query del usuario
      │
      ├─► Vector Search (pgvector, similitud coseno)   → top-20 por embedding
      └─► BM25 (tsvector PostgreSQL, websearch_to_tsquery) → top-20 por palabras clave
                              │
                    Reciprocal Rank Fusion (RRF, k=60)
                              │
                    Top-4 chunks → contexto para el LLM
```

**¿Por qué hybrid y no solo vector?** Vector search falla con queries de keywords exactas ("restricciones", "logo"). BM25 falla con queries semánticos ("tono amigable"). RRF combina ambos rankings sin necesidad de normalizar scores — los chunks que aparecen en los dos resultados suben al tope.

---

## Cadena de LLM

```
GLM_API_KEY presente → GLM 5.1 (Zhipu AI, OpenAI-compatible)
        └── fallback → Groq Llama 3.3 70B (gratuito, siempre configurado)
```

Embeddings: `gemini-embedding-001` (Google AI Studio, gratuito)
Visión: `gemini-2.5-flash-lite` (Google AI Studio, gratuito)

---

## Estructura del proyecto

```
content-suite/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, routers, lifespan
│   ├── requirements.txt         # Dependencias (también en pyproject.toml para uv)
│   ├── supabase_setup.sql       # Schema completo — ejecutar en Supabase una vez
│   ├── routers/
│   │   ├── auth.py              # POST /auth/login + JWT con 3 roles
│   │   ├── brand.py             # POST /brand/generate + /brand/save + GET /brand/manuals
│   │   ├── content.py           # POST /content/generate + GET /content + PATCH /content/{id}/status
│   │   └── audit.py             # POST /audit/image + GET /audit/logs
│   ├── services/
│   │   ├── llm.py               # Cadena GLM o Groq (async)
│   │   ├── rag.py               # embed_text + chunk_manual + retrieve_context (hybrid)
│   │   ├── vision.py            # audit_image_with_gemini (structured output)
│   │   ├── supabase_client.py   # Singleton AsyncClient
│   │   ├── google_client.py     # Singleton genai.Client
│   │   └── error_handlers.py    # Handlers globales para errores de LLM y BD
│   └── models/
│       └── schemas.py           # Todos los Pydantic schemas
└── frontend/
    └── src/
        ├── lib/
        │   ├── api-client.ts    # axios con Bearer interceptor + auto-logout 401
        │   ├── types.ts         # Tipos TypeScript espejo de los schemas Pydantic
        │   └── status.ts        # Mappers de status backend ↔ UI
        └── components/content-suite/
            ├── shared/          # BrandSelector (compartido entre módulos)
            ├── creator/         # BrandDnaArchitect + CreativeEngine + MyGenerations
            ├── approver-a/      # ReviewInbox + History
            └── approver-b/      # VisualAudit + AuditHistory
```

---

## Instalación local

### Backend

```bash
cd backend

# Con uv (recomendado)
uv sync
uv run uvicorn main:app --reload --port 8000

# Con pip
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Crear `backend/.env` con las variables del bloque siguiente.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Crear `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Variables de entorno (backend/.env)

```env
# LLM principal (opcional, si no está, usa Groq)
GLM_API_KEY=
GLM_MODEL=glm-4-flash
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

# LLM fallback (obligatorio)
GROQ_API_KEY=

# Google AI Studio (embeddings + visión)
GOOGLE_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Langfuse
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com

# Auth JWT
JWT_SECRET=
CREADOR_PASSWORD=
APROBADOR_A_PASSWORD=
APROBADOR_B_PASSWORD=
```

### Base de datos (Supabase)

Ejecutar `backend/supabase_setup.sql` completo en el SQL Editor de Supabase. Crea todas las tablas, índices, función de hybrid search y triggers.

---

## Observabilidad

Cada llamada LLM, recuperación RAG y auditoría de imagen genera una traza en Langfuse con:

- `model_used` (qué LLM respondió)
- chunks recuperados con `vector_rank`, `fts_rank` y `rrf_score`
- input/output de cada generation

Acceder al proyecto en `https://us.cloud.langfuse.com` con las credenciales del `.env`.

### Trazas públicas de la demo

Los siguientes links son trazas reales del flujo end-to-end con el producto **Frescavena Premium**. No requieren cuenta de Langfuse para ser consultados.

| #   | Módulo                | Acción                                | Trace name              | Link                                                                                                                                                                                                                              |
| --- | --------------------- | ------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | I — Brand DNA         | Generar manual de marca               | `brand-dna-generate`    | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/5a50fb348adbd4e62d6c1647ea61ff14?observation=ea2559a8456ac2c7&timestamp=2026-05-04T21:38:48.579Z&traceId=5a50fb348adbd4e62d6c1647ea61ff14)      |
| 2   | I — Brand DNA         | Guardar manual + indexar RAG          | `brand-dna-save-rag`    | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/3278953dd951974fa414c3294df0fe7f?observation=16aaeb3a87b94fca&timestamp=2026-05-04T21:39:20.442Z&traceId=3278953dd951974fa414c3294df0fe7f)      |
| 3   | II — Creative Engine  | Generar descripción de producto       | `content-generate`      | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/ed70f51bd26d77105d8a87190aa3e262?observation=eecafda0a2a2dbfd&timestamp=2026-05-04T21%3A42%3A17.467Z&traceId=ed70f51bd26d77105d8a87190aa3e262)  |
| 4   | II — Creative Engine  | Generar guión de video                | `content-generate`      | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/3934fe54d9b130e2a2754d8060314379?observation=5619feb72ebdf994&timestamp=2026-05-04T21:44:27.490Z&traceId=3934fe54d9b130e2a2754d8060314379)      |
| 5   | II — Creative Engine  | Generar prompt de imagen              | `content-generate`      | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/eda5acd6751f411dde60de490855f67e?observation=8b42eb3029fc6897&timestamp=2026-05-04T21:46:42.243Z&traceId=eda5acd6751f411dde60de490855f67e)      |
| 6   | III — Governance      | Aprobar contenido (Aprobador A)       | `content-status-change` | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/2d2e0bc8faefc9fb81f9164c7b00725e?observation=0012f18ca9f31d90&timestamp=2026-05-04T21:48:07.177Z&traceId=2d2e0bc8faefc9fb81f9164c7b00725e)      |
| 7   | III — Governance      | Auditar imagen — caso aprobado        | `multimodal-audit`      | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/105ada96c652043db73e4ae20c7d0d1b?observation=7ef8291c2aecc50a&timestamp=2026-05-04T21%3A51%3A43.828Z&traceId=105ada96c652043db73e4ae20c7d0d1b)  |
| 8   | III — Governance      | Auditar imagen — caso rechazado       | `multimodal-audit`      | [ver trace](https://us.cloud.langfuse.com/project/cmoqmdkdp0d62ad06jegzfvb7/traces/76cb1f41491ab9cc4ca6eca84f09d662?observation=72ffd326802b52a2&timestamp=2026-05-04T21:53:45.795Z&traceId=76cb1f41491ab9cc4ca6eca84f09d662)      |

**Qué inspeccionar en cada trace:**

- **#1, #3, #4, #5** — el `input` muestra el prompt completo enviado al LLM y el `output` la respuesta. En #3-#5, abrí el span `hybrid-rag-retrieval` para ver `vector_rank`, `fts_rank` y `rrf_score` por chunk recuperado.
- **#2** — el span `rag-indexing` muestra cuántos chunks se generaron y el manual completo indexado.
- **#6** — la metadata muestra el `user_id: aprobador_a`, el `content_id` y el cambio de estado (RBAC en acción).
- **#7 y #8** — el span `gemini-vision-audit` muestra el structured output de Gemini con cada `check` (categoría, severidad, detalle). El #8 demuestra detección automática de violación de manual.
