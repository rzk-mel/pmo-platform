# PMO Platform

**AI-Powered Project Scoping & Delivery Platform**

A comprehensive project management platform with AI-assisted document generation, GitHub integration, and multi-stage approval workflows.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Supabase account
- Netlify account
- DashScope API key

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/pmo-platform.git
cd pmo-platform

# Setup frontend
cd frontend
npm install
cp .env.example .env.local
# Add your Supabase keys to .env.local
npm run dev

# Frontend runs at http://localhost:5173
```

### Edge Functions Development

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve
```

---

## 📁 Project Structure

```
pmo-platform/
├── frontend/               # React + Vite application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # React hooks
│   │   ├── stores/         # Zustand stores
│   │   ├── lib/            # Utilities
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── _shared/        # Shared utilities
│   │   ├── ai-processor/   # AI generation
│   │   ├── document-extraction/
│   │   ├── github-integration/
│   │   ├── staff-actions/
│   │   ├── voice-transcription/
│   │   └── blog-generator/
│   └── migrations/         # Database migrations
│
├── docs/                   # Documentation
│   ├── DEPLOYMENT.md       # Deployment guide
│   ├── SUPABASE_CHECKLIST.md
│   └── ROADMAP.md
│
├── .github/workflows/      # CI/CD
└── netlify.toml            # Netlify config
```

---

## 🛠️ Tech Stack

| Layer             | Technology                                           |
| ----------------- | ---------------------------------------------------- |
| **Frontend**      | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui  |
| **Backend**       | Supabase (PostgreSQL, Edge Functions, Auth, Storage) |
| **AI**            | DashScope (Qwen) for generation + embeddings         |
| **Vector Search** | pgvector for RAG                                     |
| **Integration**   | GitHub REST API                                      |
| **Deployment**    | Netlify (frontend), Supabase (backend)               |

---

## 📖 Documentation

| Document                                            | Description                      |
| --------------------------------------------------- | -------------------------------- |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)                 | Step-by-step deployment guide    |
| [SUPABASE_CHECKLIST.md](docs/SUPABASE_CHECKLIST.md) | Supabase setup checklist         |
| [ROADMAP.md](docs/ROADMAP.md)                       | Known limitations & future plans |

---

## 🔐 Environment Variables

### Frontend (.env.local)

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

### Edge Functions (set via CLI)

```bash
supabase secrets set DASHSCOPE_API_KEY=xxx
supabase secrets set GITHUB_PAT=xxx
supabase secrets set GITHUB_WEBHOOK_SECRET=xxx
```

---

## 🧪 Testing

```bash
# Frontend type check
cd frontend && npm run typecheck

# Frontend lint
npm run lint

# Build verification
npm run build
```

---

## 📦 Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for full instructions.

```bash
# Deploy Edge Functions
supabase functions deploy

# Frontend deploys automatically via Netlify on push to main
```

---

## 📄 License

Proprietary - All rights reserved.
