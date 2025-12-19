# Test Scenarios

## Edge Function Testing Guide

This document outlines test scenarios for each Edge Function in the PMO Platform.

---

## 1. ai-processor

### Test Scenarios

| #   | Scenario           | Input                                                                                 | Expected Output                         |
| --- | ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------- |
| 1.1 | List templates     | `GET /ai-processor`                                                                   | 200: Array of template objects          |
| 1.2 | Generate SOW       | `POST { action: "generate", templateId: "sow-generation", context: {...} }`           | 200: Generated SOW content + confidence |
| 1.3 | Generate with RAG  | `POST { action: "generate", templateId: "rag-qa", useRag: true, ragQuery: "budget" }` | 200: Answer with citations              |
| 1.4 | Chat completion    | `POST { action: "chat", messages: [...] }`                                            | 200: AI response                        |
| 1.5 | Generate embedding | `POST { action: "embed", text: "sample text" }`                                       | 200: Embedding array (1536 dims)        |
| 1.6 | Missing template   | `POST { action: "generate", templateId: "nonexistent" }`                              | 400: Template not found                 |
| 1.7 | Unauthorized       | No auth header                                                                        | 401: Authentication required            |
| 1.8 | Save as artifact   | `POST { action: "generate", ..., saveResult: true, projectId: "..." }`                | 200: Content + artifact ID              |

### Example Test Request

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/ai-processor \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate",
    "templateId": "sow-generation",
    "context": {
      "projectName": "Test Project",
      "scopeSummary": "Build a web application"
    }
  }'
```

---

## 2. document-extraction

### Test Scenarios

| #   | Scenario                 | Input                                                                                | Expected Output                               |
| --- | ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2.1 | Extract text from TXT    | `POST { action: "extract", filePath: "docs/test.txt", mimeType: "text/plain" }`      | 200: Extracted text + chunks                  |
| 2.2 | Extract from PDF         | `POST { action: "extract", filePath: "docs/test.pdf", mimeType: "application/pdf" }` | 200: Extracted text (or error if unsupported) |
| 2.3 | Generate embeddings      | `POST { action: "embed", content: "..." }`                                           | 200: Chunk count + embedding metadata         |
| 2.4 | Process artifact         | `POST { action: "process", artifactId: "uuid" }`                                     | 200: Processing stats                         |
| 2.5 | Skip existing embeddings | `POST { action: "process", artifactId: "uuid" }` (already processed)                 | 200: Skipped message                          |
| 2.6 | Force reprocess          | `POST { action: "process", artifactId: "uuid", forceReprocess: true }`               | 200: Reprocessed                              |
| 2.7 | Invalid file type        | `POST { action: "extract", filePath: "...", mimeType: "video/mp4" }`                 | 400: Unsupported file type                    |

---

## 3. github-integration

### Test Scenarios

| #    | Scenario                 | Input                                                                                         | Expected Output              |
| ---- | ------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------- |
| 3.1  | Connect repository       | `POST { action: "connect_repo", projectId: "...", repoUrl: "https://github.com/owner/repo" }` | 200: Repository details      |
| 3.2  | Disconnect repository    | `POST { action: "disconnect_repo", projectId: "..." }`                                        | 200: Disconnected            |
| 3.3  | Sync ticket to GitHub    | `POST { action: "sync_to_github", ticketId: "..." }`                                          | 200: Issue number + URL      |
| 3.4  | Create new issue         | Sync ticket without existing issue                                                            | 200: `created: true`         |
| 3.5  | Update existing issue    | Sync ticket with existing issue                                                               | 200: `created: false`        |
| 3.6  | Sync from GitHub         | `POST { action: "sync_from_github", projectId: "..." }`                                       | 200: Sync stats              |
| 3.7  | Handle webhook (issues)  | `POST { action: "webhook", webhookEvent: "issues", webhookPayload: {...} }`                   | 200: Processed               |
| 3.8  | Invalid repo URL         | `POST { action: "connect_repo", repoUrl: "invalid" }`                                         | 400: Invalid URL             |
| 3.9  | No connected repo        | Sync without connected repo                                                                   | 400: No repository connected |
| 3.10 | Insufficient permissions | User without PM role tries to connect                                                         | 403: Permission denied       |

---

## 4. staff-actions

### Test Scenarios

| #    | Scenario                  | Input                                                                                | Expected Output                |
| ---- | ------------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| 4.1  | Approve artifact          | `POST { action: "approve_artifact", signoffId: "..." }`                              | 200: Approved + signature hash |
| 4.2  | Reject artifact           | `POST { action: "reject_artifact", signoffId: "...", comments: "Reason" }`           | 200: Rejected                  |
| 4.3  | Reject without comment    | `POST { action: "reject_artifact", signoffId: "..." }`                               | 400: Comments required         |
| 4.4  | Request changes           | `POST { action: "request_changes", signoffId: "...", comments: "..." }`              | 200: Changes requested         |
| 4.5  | Delegate signoff          | `POST { action: "delegate_signoff", signoffId: "...", delegateToId: "..." }`         | 200: Delegated                 |
| 4.6  | Transition project        | `POST { action: "transition_project", projectId: "...", targetStatus: "poc_phase" }` | 200: Transitioned              |
| 4.7  | Invalid transition        | Draft → Completed (not allowed)                                                      | 400: Invalid transition        |
| 4.8  | Insufficient role         | Developer tries PM-only transition                                                   | 403: Permission denied         |
| 4.9  | Assign ticket             | `POST { action: "assign_ticket", ticketId: "...", assigneeId: "..." }`               | 200: Assigned                  |
| 4.10 | Bulk assign               | `POST { action: "bulk_assign", ticketIds: [...], assigneeId: "..." }`                | 200: Count assigned            |
| 4.11 | Create signoff request    | `POST { action: "create_signoff_request", artifactId: "...", approverIds: [...] }`   | 200: Signoff IDs               |
| 4.12 | Already approved artifact | Create signoff for approved artifact                                                 | 409: Already approved          |

---

## 5. voice-transcription

### Test Scenarios

| #   | Scenario             | Input                                                                           | Expected Output                   |
| --- | -------------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| 5.1 | Transcribe audio URL | `POST { action: "transcribe", audioUrl: "https://...", mimeType: "audio/wav" }` | 200: Transcript + segments        |
| 5.2 | Transcribe base64    | `POST { action: "transcribe", audioBase64: "...", mimeType: "audio/mp3" }`      | 200: Transcript                   |
| 5.3 | Generate minutes     | `POST { action: "generate_minutes", transcript: "...", meetingTitle: "..." }`   | 200: Meeting minutes              |
| 5.4 | Full pipeline        | `POST { action: "transcribe_and_generate", audioUrl: "..." }`                   | 200: Transcript + minutes         |
| 5.5 | Save as artifact     | `POST { ..., saveAsArtifact: true, projectId: "..." }`                          | 200: Artifact ID                  |
| 5.6 | No audio provided    | `POST { action: "transcribe" }`                                                 | 400: Audio required               |
| 5.7 | Speaker diarization  | Audio with multiple speakers                                                    | 200: Segments with speaker labels |

---

## 6. blog-generator

### Test Scenarios

| #   | Scenario                | Input                                                              | Expected Output                 |
| --- | ----------------------- | ------------------------------------------------------------------ | ------------------------------- |
| 6.1 | Generate blog post      | `POST { action: "generate_blog", topic: "...", keyPoints: [...] }` | 200: Blog content               |
| 6.2 | With metadata           | `POST { ..., includeMetadata: true }`                              | 200: Content + SEO metadata     |
| 6.3 | Different tones         | `POST { ..., tone: "casual" }`                                     | 200: Casual-tone content        |
| 6.4 | Generate project update | `POST { action: "generate_update", projectId: "..." }`             | 200: Project update post        |
| 6.5 | Generate summary        | `POST { action: "generate_summary", projectId: "..." }`            | 200: Executive summary          |
| 6.6 | Suggest topics          | `POST { action: "suggest_topics" }`                                | 200: Array of topic suggestions |
| 6.7 | With project context    | `POST { action: "suggest_topics", projectId: "..." }`              | 200: Project-specific topics    |
| 6.8 | Missing key points      | `POST { action: "generate_blog", topic: "Test" }`                  | 400: keyPoints required         |

---

## Testing Commands

### Local Testing

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/ai-processor \
  -H "Authorization: Bearer $LOCAL_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action": "list-templates"}'
```

### Integration Testing

```bash
# Deploy to staging
supabase functions deploy --project-ref $STAGING_PROJECT

# Run integration tests
npm run test:integration
```

---

## Error Code Reference

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| 400  | Validation error (bad input)               |
| 401  | Authentication required                    |
| 403  | Authorization denied (role)                |
| 404  | Resource not found                         |
| 409  | Conflict (duplicate, invalid state)        |
| 429  | Rate limit exceeded                        |
| 500  | Internal server error                      |
| 502  | External service error (GitHub, DashScope) |
