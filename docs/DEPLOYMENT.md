# PMO Platform - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Frontend Deployment (Netlify)](#frontend-deployment-netlify)
4. [CI/CD Configuration](#cicd-configuration)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Strategy](#rollback-strategy)

---

## Prerequisites

Before deployment, ensure you have:

- [ ] Supabase account (free tier or higher)
- [ ] Netlify account
- [ ] GitHub repository with the codebase
- [ ] DashScope API key (from Alibaba Cloud)
- [ ] GitHub OAuth App (for GitHub login)
- [ ] Domain name (optional, for custom domain)

---

## Supabase Setup

### Step 1: Create Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Region**: Select `ap-southeast-1` (Singapore) for Indonesia users
3. **Database Password**: Generate and save securely
4. Wait for project initialization (~2 minutes)

### Step 2: Enable Extensions

```sql
-- Run in SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Step 3: Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### Step 4: Configure Authentication

1. Go to **Authentication → Providers**
2. Enable **Email** provider
3. Enable **GitHub** provider:
   - Create GitHub OAuth App at github.com/settings/developers
   - Callback URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

### Step 5: Set Up Storage Buckets

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- RLS policy for documents bucket
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view own org documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

### Step 6: Deploy Edge Functions

```bash
# Set secrets
supabase secrets set DASHSCOPE_API_KEY=your_dashscope_key
supabase secrets set GITHUB_PAT=your_github_pat
supabase secrets set GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Deploy all functions
supabase functions deploy

# Verify deployment
supabase functions list
```

### Step 7: Get API Keys

Go to **Settings → API** and copy:

- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` key → `VITE_SUPABASE_ANON_KEY`
- `service_role` key → For backend only (keep secret!)

---

## Frontend Deployment (Netlify)

### Option A: Deploy via Netlify UI

1. Go to [app.netlify.com](https://app.netlify.com) → Add new site → Import existing project
2. Connect GitHub repository
3. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
4. Add environment variables:
   ```
   VITE_SUPABASE_URL = https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbG...
   ```
5. Deploy

### Option B: Deploy via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize site
cd frontend
netlify init

# Deploy
npm run build
netlify deploy --prod --dir=dist
```

### Configure Redirects

Create `frontend/public/_redirects`:

```
/*    /index.html   200
```

This ensures SPA routing works correctly.

---

## CI/CD Configuration

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Type check
        run: cd frontend && npm run typecheck

      - name: Lint
        run: cd frontend && npm run lint

  deploy-functions:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Edge Functions
        run: |
          supabase link --project-ref $SUPABASE_PROJECT_REF
          supabase functions deploy

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install & Build
        run: |
          cd frontend
          npm ci
          npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: "./frontend/dist"
          production-deploy: true
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Required GitHub Secrets

| Secret                   | Description                                |
| ------------------------ | ------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`  | From supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF`   | Project reference ID                       |
| `VITE_SUPABASE_URL`      | Supabase project URL                       |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key                          |
| `NETLIFY_AUTH_TOKEN`     | From app.netlify.com/user/applications     |
| `NETLIFY_SITE_ID`        | From Netlify site settings                 |

---

## Post-Deployment Verification

### Smoke Test Checklist

| #   | Test                  | Expected Result                           |
| --- | --------------------- | ----------------------------------------- |
| 1   | Load homepage         | Login page displays                       |
| 2   | GitHub OAuth login    | Redirects to GitHub, returns to dashboard |
| 3   | Email login           | Sign in works, redirects to dashboard     |
| 4   | View projects list    | Projects load (or empty state)            |
| 5   | Create project        | Form submits, project appears in list     |
| 6   | View project detail   | Artifacts and tickets sections visible    |
| 7   | View sign-offs        | Pending sign-offs display                 |
| 8   | Edge Function: AI     | Generate content with ai-processor        |
| 9   | Edge Function: GitHub | Connect repo, sync issues                 |
| 10  | Logout                | Session cleared, redirect to login        |

### Health Check Endpoints

```bash
# Test Edge Functions
curl https://YOUR_PROJECT.supabase.co/functions/v1/ai-processor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "list-templates"}'

# Expected: 200 with template list
```

---

## Rollback Strategy

### Frontend Rollback (Netlify)

1. Go to Netlify Dashboard → Deploys
2. Find last working deploy
3. Click "Publish deploy"

Or via CLI:

```bash
netlify rollback
```

### Edge Functions Rollback

```bash
# Revert to previous commit
git checkout HEAD~1 -- supabase/functions/

# Redeploy
supabase functions deploy
```

### Database Rollback

> [!CAUTION]
> Database rollbacks can cause data loss. Always backup first.

```bash
# Create backup before migration
supabase db dump -f backup_$(date +%Y%m%d).sql

# Rollback specific migration
supabase migration repair --status reverted MIGRATION_ID
```

---

## Production Checklist

- [ ] SSL certificate active (automatic on Netlify/Supabase)
- [ ] Rate limiting configured in Supabase
- [ ] RLS policies tested with different roles
- [ ] Error monitoring set up (e.g., Sentry)
- [ ] Backup schedule configured
- [ ] Custom domain configured (optional)
- [ ] Email templates customized in Supabase Auth
