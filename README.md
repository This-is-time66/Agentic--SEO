# 🔍 Agentic SEO

> An AI-powered SEO  intelligence platform that uses a multi-agent pipeline to analyze competitors, identify  gaps, and generate optimized articles — all from a single keyword.

---

## ✨ Features

- 🔐 **User Authentication** — Secure signup/login with session tokens
- 🤖 **3-Stage Agent Pipeline** — Competitor Intelligence → Gap Analysis → Article Generation
- 🌐 **Live SERP Analysis** — Real-time web search via Tavily API
- 📝 **Full Article Generation** — SEO-optimized, gap-filling articles via Groq (LLaMA)
- 🕐 **Search History** — Per-user history with full results stored in database
- 🐳 **Docker Ready** — Deployable to Hugging Face Spaces 

---



---

## 🗂️ Project Structure

```
Agentic SEO/
├── app.py                  # FastAPI routes (thin entry point)
├── core/
│   ├── agents.py           # Competitor, Gap, and Writer agents
│   ├── database.py         # PostgreSQL helpers (psycopg2)
│   └── models.py           # Pydantic request models + AgentState TypedDict
├── templates/
│   └── index.html          # Single-page frontend (Jinja2)
├── static/
│   ├── css/style.css
│   └── js/script.js
├── .env                    # Local secrets (never commit this)
├── .gitignore
├── Dockerfile              # HF Spaces ready 
├── .dockerignore
├── requirements.txt
└── README.md
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| LLM | Groq — LLaMA  |
| Web Search | Tavily API |
| Auth | Token-based sessions |
| Frontend | HTML,Vanilla JS + Jinja2 |
| Deployment | Docker / Hugging Face Spaces |

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/agentic-seo.git
cd agentic-seo
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=your DATABASE_URL
TAVILY_API_KEY=your_tavily_api_key
GROQ_API_KEY=your_groq_api_key
```

### 4. Set Up the Database

Run the following SQL to create the required tables:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    competitors_summary TEXT DEFAULT '',
    gaps TEXT DEFAULT '',
    final_article TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Run the App

```bash
python app.py
```



