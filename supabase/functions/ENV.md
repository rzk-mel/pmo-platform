# Environment Variables

## Supabase Edge Functions Configuration

This document lists all required environment variables for the PMO Platform Edge Functions.

---

## Required Variables

### Supabase Configuration

These are automatically provided by Supabase:

| Variable                    | Description                     | Example                   |
| --------------------------- | ------------------------------- | ------------------------- |
| `SUPABASE_URL`              | Supabase project URL            | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY`         | Public anon key for client auth | `eyJhbG...`               |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | `eyJhbG...`               |

### DashScope (Qwen AI)

| Variable            | Description               | Required By                                                            |
| ------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `DASHSCOPE_API_KEY` | Alibaba DashScope API key | ai-processor, document-extraction, voice-transcription, blog-generator |

### GitHub Integration

| Variable                 | Description                      | Required By                   |
| ------------------------ | -------------------------------- | ----------------------------- |
| `GITHUB_PAT`             | Personal Access Token (fallback) | github-integration            |
| `GITHUB_APP_ID`          | GitHub App ID (for app auth)     | github-integration (optional) |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (PEM)     | github-integration (optional) |
| `GITHUB_WEBHOOK_SECRET`  | Webhook signature secret         | github-integration            |

### Logging

| Variable    | Description       | Default |
| ----------- | ----------------- | ------- |
| `LOG_LEVEL` | Minimum log level | `info`  |

---

## Setting Environment Variables

### Via Supabase Dashboard

1. Go to Project Settings → Edge Functions
2. Add each variable in the "Secrets" section

### Via Supabase CLI

```bash
# Set individual secrets
supabase secrets set DASHSCOPE_API_KEY=your_key_here
supabase secrets set GITHUB_PAT=your_pat_here
supabase secrets set GITHUB_WEBHOOK_SECRET=your_secret_here

# Set multiple at once from .env file
supabase secrets set --env-file .env.production
```

### Local Development

Create `.env.local` in `supabase/functions/`:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_key
DASHSCOPE_API_KEY=your_dashscope_key
GITHUB_PAT=your_github_pat
LOG_LEVEL=debug
```

---

## Security Notes

> [!CAUTION]
>
> - Never commit secrets to version control
> - Use `.gitignore` to exclude `.env*` files
> - Rotate keys periodically
> - Use minimum required scopes for tokens

### GitHub PAT Scopes Required

- `repo` - Full repository access (for private repos)
- `read:org` - Read organization info
- `write:discussion` - For issue comments

### DashScope API Key

Obtain from: https://dashscope.console.aliyun.com/
