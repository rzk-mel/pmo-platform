# PMO Platform - Supabase Setup Checklist

## Project Configuration

- [ ] **Create Supabase Project**

  - Region: `ap-southeast-1` (Singapore)
  - Save database password securely

- [ ] **Enable Required Extensions**

  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```

- [ ] **Run Database Migrations**
  ```bash
  supabase link --project-ref YOUR_REF
  supabase db push
  ```

## Authentication Setup

- [ ] **Email Provider**

  - Enable in Authentication → Providers
  - Configure SMTP for production emails (optional)

- [ ] **GitHub OAuth**

  - Create OAuth App at github.com/settings/developers
  - Callback: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
  - Add Client ID and Secret to Supabase

- [ ] **Email Templates** (optional)
  - Customize in Authentication → Email Templates
  - Confirm Email, Reset Password, Magic Link

## Storage Configuration

- [ ] **Create Buckets**

  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', false);
  ```

- [ ] **Storage Policies**
  - Upload: Authenticated users
  - Download: RLS via org_id

## Edge Functions

- [ ] **Set Secrets**

  ```bash
  supabase secrets set DASHSCOPE_API_KEY=xxx
  supabase secrets set GITHUB_PAT=xxx
  supabase secrets set GITHUB_WEBHOOK_SECRET=xxx
  ```

- [ ] **Deploy Functions**

  ```bash
  supabase functions deploy
  ```

- [ ] **Verify Deployment**
  ```bash
  supabase functions list
  ```

## Security Settings

- [ ] **Rate Limiting**

  - Configure in Database → Cron Jobs (if needed)

- [ ] **API Settings**

  - Verify JWT expiry (default: 1 hour)
  - Enable refresh token rotation

- [ ] **RLS Verification**
  - Test with different user roles
  - Verify cross-tenant isolation

## Monitoring

- [ ] **Enable Logs**

  - Edge Function logs in Dashboard
  - Database query logs (optional)

- [ ] **Set Alerts** (optional)
  - Database size alerts
  - Edge Function error alerts

## API Keys Checklist

| Key                | Location           | Used For                        |
| ------------------ | ------------------ | ------------------------------- |
| `Project URL`      | Settings → API     | Frontend VITE_SUPABASE_URL      |
| `anon key`         | Settings → API     | Frontend VITE_SUPABASE_ANON_KEY |
| `service_role key` | Settings → API     | Edge Functions (auto-injected)  |
| `Project Ref`      | Settings → General | CI/CD                           |
| `Access Token`     | Account → Tokens   | CI/CD                           |
