import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  CheckSquare,
  MessageCircle,
  Github,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials, ROLE_LABELS } from '@/lib/utils'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Artifacts', href: '/artifacts', icon: FileText },
  { label: 'Sign-offs', href: '/signoffs', icon: CheckSquare },
  { label: 'Inquiries', href: '/inquiries', icon: MessageCircle },
  { label: 'GitHub Sync', href: '/github', icon: Github, roles: ['project_manager', 'tech_lead', 'developer'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['org_admin', 'super_admin'] },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut, hasMinimumRole } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const filteredItems = navItems.filter(item => {
    if (!item.roles) return true
    return item.roles.some(role => hasMinimumRole(role))
  })

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!collapsed && (
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            PMO Platform
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {filteredItems.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        {user && (
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
              <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            )}
            {!collapsed && (
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

interface HeaderProps {
  title?: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  const { user } = useAuthStore()
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4">
        {title && <h1 className="text-xl font-semibold">{title}</h1>}
      </div>

      <div className="flex items-center gap-4">
        {actions}
        
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
            3
          </Badge>
        </Button>

        {/* User menu */}
        {user && (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </header>
  )
}

interface PageLayoutProps {
  title?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageLayout({ title, actions, children }: PageLayoutProps) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-64">
        <Header title={title} actions={actions} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
