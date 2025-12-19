import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { ProjectStatus, ArtifactStatus, TicketStatus, TicketPriority, UserRole } from '@/types'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting
export function formatDate(date: string | Date, pattern: string = 'MMM d, yyyy'): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, pattern)
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'MMM d, yyyy HH:mm')
}

export function formatRelative(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(parsed, { addSuffix: true })
}

// Status display helpers
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  scoping: 'Scoping',
  sow_draft: 'SOW Draft',
  sow_review: 'SOW Review',
  poc_phase: 'POC Phase',
  development: 'Development',
  uat_phase: 'UAT Phase',
  sign_off: 'Sign Off',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scoping: 'bg-blue-100 text-blue-700',
  sow_draft: 'bg-yellow-100 text-yellow-700',
  sow_review: 'bg-orange-100 text-orange-700',
  poc_phase: 'bg-purple-100 text-purple-700',
  development: 'bg-indigo-100 text-indigo-700',
  uat_phase: 'bg-cyan-100 text-cyan-700',
  sign_off: 'bg-teal-100 text-teal-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export const ARTIFACT_STATUS_LABELS: Record<ArtifactStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
}

export const ARTIFACT_STATUS_COLORS: Record<ArtifactStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  superseded: 'bg-gray-200 text-gray-600',
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  blocked: 'bg-red-100 text-red-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  project_manager: 'Project Manager',
  tech_lead: 'Tech Lead',
  developer: 'Developer',
  client_stakeholder: 'Client Stakeholder',
  viewer: 'Viewer',
}

// Role hierarchy (higher index = more permissions)
const ROLE_HIERARCHY: UserRole[] = [
  'viewer',
  'client_stakeholder',
  'developer',
  'tech_lead',
  'project_manager',
  'org_admin',
  'super_admin',
]

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole)
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole)
  return userIndex >= requiredIndex
}

export function canEditProject(role: UserRole): boolean {
  return hasMinimumRole(role, 'project_manager')
}

export function canEditArtifact(role: UserRole): boolean {
  return hasMinimumRole(role, 'developer')
}

export function canApprove(role: UserRole): boolean {
  return hasMinimumRole(role, 'tech_lead') || role === 'client_stakeholder'
}

export function canManageUsers(role: UserRole): boolean {
  return hasMinimumRole(role, 'org_admin')
}

// Text helpers
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Number formatting
export function formatCurrency(amount: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}
