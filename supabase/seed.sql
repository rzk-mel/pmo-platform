-- PMO Platform Sample Data
-- Run this script to populate the database with sample data

-- ============================================
-- 1. Organization
-- ============================================
INSERT INTO organizations (id, name, slug, settings) VALUES
  ('org-001', 'PT Teknologi Nusantara', 'teknusa', '{"industry": "Technology", "size": "medium"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. User Profiles (will be linked to auth.users)
-- Note: These profiles reference Supabase auth users
-- ============================================

-- Create profiles for demo (you may need to adjust IDs based on actual auth.users)
INSERT INTO profiles (id, org_id, email, full_name, role, is_active, preferences) VALUES
  ('user-pm-001', 'org-001', 'project.manager@teknusa.com', 'Budi Santoso', 'project_manager', true, '{}'),
  ('user-tl-001', 'org-001', 'tech.lead@teknusa.com', 'Dewi Hartono', 'tech_lead', true, '{}'),
  ('user-dev-001', 'org-001', 'developer1@teknusa.com', 'Agus Pratama', 'developer', true, '{}'),
  ('user-dev-002', 'org-001', 'developer2@teknusa.com', 'Siti Rahma', 'developer', true, '{}'),
  ('user-client-001', 'org-001', 'client@partner.com', 'Ahmad Wijaya', 'client_stakeholder', true, '{}'),
  ('96e0f8b6-6832-4135-936b-0535a1ed44b7', 'org-001', 'admin@teknusa.com', 'Admin Super', 'super_admin', true, '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. Projects
-- ============================================
INSERT INTO projects (id, org_id, code, name, description, status, start_date, target_end_date, project_manager_id, tech_lead_id, client_contact_id, estimated_budget, currency) VALUES
  ('proj-001', 'org-001', 'PMO-2024-001', 'E-Commerce Platform Modernization', 
   'Modernisasi platform e-commerce existing dengan teknologi terbaru. Scope meliputi redesign UI/UX, migrasi database, dan integrasi payment gateway baru.', 
   'development', '2024-11-01', '2025-03-31', 'user-pm-001', 'user-tl-001', 'user-client-001', 750000000, 'IDR'),
  
  ('proj-002', 'org-001', 'PMO-2024-002', 'HR Management System', 
   'Pengembangan sistem manajemen SDM terintegrasi untuk mengelola data karyawan, absensi, cuti, dan payroll.', 
   'scoping', '2024-12-15', '2025-06-30', 'user-pm-001', 'user-tl-001', 'user-client-001', 500000000, 'IDR'),
  
  ('proj-003', 'org-001', 'PMO-2024-003', 'Mobile Banking App v2.0', 
   'Pengembangan fitur baru mobile banking: transfer internasional, virtual card, dan integrasi QRIS.', 
   'sow_review', '2025-01-10', '2025-08-15', 'user-pm-001', 'user-tl-001', 'user-client-001', 1200000000, 'IDR'),

  ('proj-004', 'org-001', 'PMO-2024-004', 'Supply Chain Dashboard', 
   'Dashboard analytics untuk monitoring supply chain real-time dengan prediksi demand menggunakan AI.', 
   'completed', '2024-06-01', '2024-11-30', 'user-pm-001', 'user-tl-001', 'user-client-001', 350000000, 'IDR')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Project Members
-- ============================================
INSERT INTO project_members (id, project_id, profile_id, role) VALUES
  ('pm-001-1', 'proj-001', 'user-pm-001', 'project_manager'),
  ('pm-001-2', 'proj-001', 'user-tl-001', 'tech_lead'),
  ('pm-001-3', 'proj-001', 'user-dev-001', 'developer'),
  ('pm-001-4', 'proj-001', 'user-dev-002', 'developer'),
  ('pm-001-5', 'proj-001', 'user-client-001', 'client_stakeholder'),
  ('pm-002-1', 'proj-002', 'user-pm-001', 'project_manager'),
  ('pm-002-2', 'proj-002', 'user-tl-001', 'tech_lead'),
  ('pm-003-1', 'proj-003', 'user-pm-001', 'project_manager'),
  ('pm-003-2', 'proj-003', 'user-tl-001', 'tech_lead'),
  ('pm-004-1', 'proj-004', 'user-pm-001', 'project_manager')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. Artifacts
-- ============================================
INSERT INTO artifacts (id, project_id, type, title, content, status, version, ai_generated, created_by) VALUES
  -- E-Commerce Project Artifacts
  ('art-001', 'proj-001', 'scope_document', 'Dokumen Scope E-Commerce Modernization', 
   '# Scope Document\n\n## Overview\nProyek modernisasi platform e-commerce meliputi:\n\n1. **Redesign UI/UX** - Mobile-first responsive design\n2. **Backend Migration** - Dari monolith ke microservices\n3. **Database Upgrade** - PostgreSQL 15 dengan partitioning\n4. **Payment Integration** - Midtrans, Xendit, GoPay\n\n## Timeline\n- Phase 1: UI/UX (8 minggu)\n- Phase 2: Backend (12 minggu)\n- Phase 3: Integration (4 minggu)\n\n## Deliverables\n- [ ] High-fidelity mockups\n- [ ] Technical architecture document\n- [ ] API specifications\n- [ ] Deployment playbook', 
   'approved', 1, false, 'user-pm-001'),
  
  ('art-002', 'proj-001', 'sow', 'Statement of Work - E-Commerce Platform', 
   '# Statement of Work\n\n## 1. Project Information\n**Nama Proyek**: E-Commerce Platform Modernization\n**Client**: PT Partner Retail Indonesia\n**Durasi**: 5 bulan\n\n## 2. Scope of Work\n### 2.1 In Scope\n- Redesign frontend dengan React 18\n- API gateway dengan Kong\n- Containerization dengan Docker & Kubernetes\n- CI/CD pipeline setup\n\n### 2.2 Out of Scope\n- Mobile app development\n- Data migration dari sistem lama\n\n## 3. Timeline & Milestones\n| Milestone | Due Date | Value |\n|-----------|----------|-------|\n| Kickoff | 1 Nov 2024 | 20% |\n| Phase 1 Complete | 31 Dec 2024 | 30% |\n| Phase 2 Complete | 28 Feb 2025 | 30% |\n| Go-Live | 31 Mar 2025 | 20% |', 
   'pending_review', 2, true, 'user-pm-001'),
  
  ('art-003', 'proj-001', 'technical_spec', 'Technical Specification - Microservices Architecture', 
   '# Technical Specification\n\n## Architecture Overview\n```\n┌─────────────┐     ┌─────────────┐\n│   Frontend  │────▶│ API Gateway │\n│  (React 18) │     │   (Kong)    │\n└─────────────┘     └──────┬──────┘\n                           │\n        ┌──────────────────┼──────────────────┐\n        ▼                  ▼                  ▼\n┌───────────────┐  ┌───────────────┐  ┌───────────────┐\n│ Product Svc   │  │  Order Svc    │  │ Payment Svc   │\n│ (Node.js)     │  │  (Go)         │  │ (Node.js)     │\n└───────────────┘  └───────────────┘  └───────────────┘\n```\n\n## Tech Stack\n- **Frontend**: React 18, TypeScript, Tailwind CSS\n- **Backend**: Node.js, Go\n- **Database**: PostgreSQL 15, Redis\n- **Infrastructure**: Kubernetes, Docker\n- **Monitoring**: Prometheus, Grafana', 
   'approved', 1, true, 'user-tl-001'),

  -- HR System Artifacts
  ('art-004', 'proj-002', 'scope_document', 'Dokumen Scope HR Management System', 
   '# HR Management System - Scope\n\n## Modules\n1. Employee Management\n2. Attendance & Leave\n3. Payroll Processing\n4. Performance Review\n5. Recruitment\n\n## Integration\n- BPJS Ketenagakerjaan API\n- Bank Mandiri Payroll\n- Fingerprint devices', 
   'draft', 1, false, 'user-pm-001'),

  -- Mobile Banking Artifacts
  ('art-005', 'proj-003', 'sow', 'SOW - Mobile Banking v2.0', 
   '# Statement of Work\n\n## Features\n1. **International Transfer**\n   - SWIFT integration\n   - Real-time exchange rates\n   - Compliance checking\n\n2. **Virtual Card**\n   - Instant card generation\n   - Spending limits\n   - Card freezing\n\n3. **QRIS Integration**\n   - Static & dynamic QR\n   - Merchant discovery\n   - Transaction history', 
   'pending_review', 1, true, 'user-pm-001'),

  -- Completed Project Artifacts
  ('art-006', 'proj-004', 'sign_off_document', 'Project Sign-Off - Supply Chain Dashboard', 
   '# Final Sign-Off Document\n\n## Project Completion Certificate\n\nThis certifies that the Supply Chain Dashboard project has been successfully completed as per the agreed scope and specifications.\n\n### Deliverables Accepted\n- [x] Real-time dashboard\n- [x] AI prediction module\n- [x] Alert system\n- [x] Mobile responsive\n\n### Signatures\n- Project Manager: ________________\n- Client Representative: ________________\n- Date: November 30, 2024', 
   'approved', 1, false, 'user-pm-001')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. Signoffs
-- ============================================
INSERT INTO signoffs (id, artifact_id, assignee_id, status, due_date, comments, created_by) VALUES
  ('sign-001', 'art-002', 'user-client-001', 'pending', '2024-12-20', NULL, 'user-pm-001'),
  ('sign-002', 'art-002', 'user-tl-001', 'approved', '2024-12-15', 'Technical content verified. Ready for client review.', 'user-pm-001'),
  ('sign-003', 'art-005', 'user-client-001', 'pending', '2024-12-25', NULL, 'user-pm-001'),
  ('sign-004', 'art-006', 'user-client-001', 'approved', '2024-11-30', 'All deliverables accepted. Project completed successfully.', 'user-pm-001')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. Tickets
-- ============================================
INSERT INTO tickets (id, project_id, title, description, status, priority, assignee_id, reporter_id, due_date, estimated_hours, labels) VALUES
  -- E-Commerce Tickets
  ('tick-001', 'proj-001', 'Setup React 18 project scaffold', 'Initialize new React 18 project with TypeScript and Tailwind CSS configuration.', 'done', 'high', 'user-dev-001', 'user-tl-001', '2024-11-15', 8, ARRAY['frontend', 'setup']),
  ('tick-002', 'proj-001', 'Design system components', 'Create reusable UI components: Button, Input, Card, Modal, Table.', 'in_progress', 'high', 'user-dev-001', 'user-tl-001', '2024-12-01', 24, ARRAY['frontend', 'design-system']),
  ('tick-003', 'proj-001', 'Implement product catalog API', 'Build REST API for product CRUD operations with pagination and filtering.', 'in_progress', 'high', 'user-dev-002', 'user-tl-001', '2024-12-15', 16, ARRAY['backend', 'api']),
  ('tick-004', 'proj-001', 'Setup Kubernetes cluster', 'Configure K8s cluster on GCP with proper namespaces and RBAC.', 'open', 'medium', 'user-tl-001', 'user-pm-001', '2024-12-30', 16, ARRAY['devops', 'infrastructure']),
  ('tick-005', 'proj-001', 'Payment gateway integration - Midtrans', 'Integrate Midtrans payment gateway for credit card and e-wallet payments.', 'open', 'high', 'user-dev-002', 'user-tl-001', '2025-01-15', 24, ARRAY['backend', 'payment']),
  
  -- HR System Tickets
  ('tick-006', 'proj-002', 'Database schema design', 'Design PostgreSQL schema for employee, attendance, and payroll modules.', 'in_progress', 'high', 'user-tl-001', 'user-pm-001', '2024-12-20', 12, ARRAY['database', 'design']),
  ('tick-007', 'proj-002', 'Employee CRUD API', 'REST API for employee management with validation and soft delete.', 'open', 'medium', 'user-dev-001', 'user-tl-001', '2025-01-10', 16, ARRAY['backend', 'api']),
  
  -- Mobile Banking Tickets  
  ('tick-008', 'proj-003', 'SWIFT integration research', 'Research SWIFT API requirements and sandbox setup.', 'in_progress', 'critical', 'user-tl-001', 'user-pm-001', '2024-12-22', 8, ARRAY['research', 'integration']),
  ('tick-009', 'proj-003', 'Security audit preparation', 'Prepare documentation for OJK security compliance audit.', 'open', 'critical', 'user-pm-001', 'user-client-001', '2025-01-05', 16, ARRAY['security', 'compliance'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. Inquiries
-- ============================================
INSERT INTO inquiries (id, project_id, subject, body, status, asked_by, answered_by, answer, answered_at, is_internal) VALUES
  ('inq-001', 'proj-001', 'Timezone handling for order timestamps', 
   'How should we handle timezone for order timestamps? Should we store in UTC and convert on display?', 
   'answered', 'user-dev-001', 'user-tl-001', 
   'Yes, always store timestamps in UTC. Use the client timezone from the request header for display conversion. We will use dayjs library for consistent handling across frontend and backend.', 
   NOW() - INTERVAL '2 days', true),
  
  ('inq-002', 'proj-001', 'Payment refund flow clarification', 
   'Client is asking about the refund flow. How many days should we allow for refund requests?', 
   'open', 'user-pm-001', NULL, NULL, NULL, false),
  
  ('inq-003', 'proj-002', 'Leave balance carry-over policy', 
   'Should the system support annual leave carry-over to next year? What is the max days?', 
   'answered', 'user-dev-001', 'user-client-001', 
   'Yes, maximum 5 days can be carried over to the next year. Any unused balance above 5 days will expire.', 
   NOW() - INTERVAL '1 day', false),
  
  ('inq-004', 'proj-003', 'OJK compliance for virtual cards', 
   'What are the specific OJK requirements for virtual card issuance that we need to implement?', 
   'open', 'user-tl-001', NULL, NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 9. Notifications (sample)
-- ============================================
INSERT INTO notifications (id, user_id, title, body, type, priority, entity_type, entity_id, action_url) VALUES
  ('notif-001', 'user-pm-001', 'New Sign-off Required', 'SOW for E-Commerce Platform is pending your review.', 'signoff_request', 'high', 'signoff', 'sign-001', '/signoffs'),
  ('notif-002', 'user-client-001', 'Pending Approval', 'Please review and approve the SOW for Mobile Banking v2.0.', 'signoff_request', 'high', 'signoff', 'sign-003', '/signoffs'),
  ('notif-003', 'user-dev-001', 'Task Assigned', 'You have been assigned: Design system components', 'task_assigned', 'medium', 'ticket', 'tick-002', '/projects/proj-001'),
  ('notif-004', 'user-tl-001', 'Inquiry Response Needed', 'New inquiry about payment refund flow requires your input.', 'inquiry', 'medium', 'inquiry', 'inq-002', '/inquiries')
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Sample data inserted successfully!' as message;
