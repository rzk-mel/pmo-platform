# PMO Platform - Known Limitations & Future Roadmap

## Known Limitations

### Current Implementation Constraints

| Area                    | Limitation                                  | Impact                              | Workaround                                  |
| ----------------------- | ------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| **PDF/DOCX Extraction** | Edge Functions have limited library support | Text extraction may be incomplete   | Use plain text or markdown for best results |
| **Real-time Updates**   | Supabase Realtime not implemented           | Manual refresh needed for updates   | Add Realtime subscriptions in Phase 2       |
| **File Size**           | 50MB max per upload                         | Large files rejected                | Split large documents                       |
| **AI Rate Limits**      | DashScope free tier limits                  | May hit quotas during heavy use     | Upgrade to paid tier                        |
| **Voice Transcription** | Depends on DashScope Paraformer API         | May not be available in all regions | Use alternative ASR if needed               |
| **Concurrent Edits**    | No conflict resolution for document edits   | Last-write-wins                     | Add optimistic locking in Phase 2           |

### Browser Support

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile browsers: Limited testing performed
- IE11: Not supported

### Performance Considerations

- Dashboard loads ~15 projects efficiently
- Large project lists (100+) may need pagination optimization
- Vector search optimized for ~10K embeddings per project

---

## Future Improvement Roadmap

### Phase 2: Enhanced Collaboration (Q1 2025)

| Feature                 | Description                         | Priority |
| ----------------------- | ----------------------------------- | -------- |
| **Real-time Presence**  | See who's viewing/editing documents | High     |
| **Comments System**     | Inline comments on artifacts        | High     |
| **Notification Center** | In-app + email notifications        | High     |
| **Activity Feed**       | Timeline of project activities      | Medium   |
| **@mentions**           | Tag users in comments               | Medium   |

### Phase 3: Advanced AI (Q2 2025)

| Feature               | Description                     | Priority |
| --------------------- | ------------------------------- | -------- |
| **AI Chat Interface** | Contextual assistant in sidebar | High     |
| **Smart Suggestions** | Auto-suggest next actions       | Medium   |
| **Document Analysis** | Automated risk detection        | Medium   |
| **Multi-language**    | Indonesian + English support    | Medium   |
| **Voice Commands**    | Voice-to-action in meetings     | Low      |

### Phase 4: Integrations (Q3 2025)

| Feature               | Description               | Priority |
| --------------------- | ------------------------- | -------- |
| **Jira Sync**         | Bidirectional ticket sync | High     |
| **Slack Integration** | Notifications + commands  | High     |
| **Google Drive**      | Document import/export    | Medium   |
| **Calendar Sync**     | Meeting scheduling        | Medium   |
| **Zapier/n8n**        | Workflow automation       | Low      |

### Infrastructure Improvements

| Area            | Improvement                    | Timeline      |
| --------------- | ------------------------------ | ------------- |
| **Monitoring**  | Add Sentry, LogRocket          | Phase 2       |
| **Analytics**   | User behavior tracking         | Phase 2       |
| **Performance** | CDN optimization, lazy loading | Phase 2       |
| **Testing**     | E2E tests with Playwright      | Phase 2       |
| **Backup**      | Automated daily backups        | Phase 1 (now) |

---

## Technical Debt Log

| Item                  | Location              | Effort | Notes                              |
| --------------------- | --------------------- | ------ | ---------------------------------- |
| Add input validation  | All forms             | Medium | Use Zod schemas                    |
| Implement pagination  | Project list, Tickets | Medium | Add `usePagination` hook           |
| Add error boundaries  | App.tsx               | Low    | Catch component errors             |
| Optimize re-renders   | Dashboard             | Medium | Use React.memo                     |
| Add loading skeletons | All pages             | Low    | Better perceived performance       |
| Implement caching     | API hooks             | Medium | React Query stale-while-revalidate |

---

## Upgrade Considerations

### Supabase Plan Upgrade

Upgrade from Free to Pro when:

- Database exceeds 500MB
- Edge Function invocations exceed 500K/month
- Need point-in-time recovery
- Need daily backups

### DashScope Upgrade

Upgrade when:

- Hitting rate limits frequently
- Need priority API access
- Require higher token limits

### Netlify Upgrade

Upgrade from Starter when:

- Build minutes exceed 300/month
- Need more bandwidth
- Require team collaboration features
