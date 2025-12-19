import { useState } from 'react'
import {
  User,
  Bell,
  Moon,
  Sun,
  Save,
  Building,
  Shield,
  Mail,
  Loader2,
} from 'lucide-react'
import { PageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from '@/components/ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { getInitials, ROLE_LABELS, cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function SettingsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  
  const [fullName, setFullName] = useState(user?.full_name || '')
  const email = user?.email || ''
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  )
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { full_name: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Refresh auth store
      window.location.reload()
    },
  })

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ full_name: fullName })
  }

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  if (!user) {
    return (
      <PageLayout title="Settings">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please log in to view settings</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Settings">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden md:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden md:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span className="hidden md:inline">Appearance</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal information and account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                  <Button variant="outline" size="sm" className="mt-2" disabled>
                    Change Avatar
                  </Button>
                </div>
              </div>

              {/* Form */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
              </div>

              {/* Role & Organization */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Organization</p>
                    <p className="text-sm text-muted-foreground">Teknusa</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending || fullName === user.full_name}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <ToggleOption
                  icon={Mail}
                  title="Email Notifications"
                  description="Receive notifications via email"
                  checked={emailNotifications}
                  onChange={setEmailNotifications}
                />
                <ToggleOption
                  icon={Bell}
                  title="Push Notifications"
                  description="Receive in-app push notifications"
                  checked={pushNotifications}
                  onChange={setPushNotifications}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {isDarkMode ? (
                    <Moon className="h-5 w-5 text-primary" />
                  ) : (
                    <Sun className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">
                      {isDarkMode ? 'Dark theme is enabled' : 'Light theme is enabled'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={toggleDarkMode}
                >
                  {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}

interface ToggleOptionProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleOption({ icon: Icon, title, description, checked, onChange }: ToggleOptionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors',
        checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      )}
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5', checked ? 'text-primary' : 'text-muted-foreground')} />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div
        className={cn(
          'w-11 h-6 rounded-full transition-colors relative',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </div>
    </div>
  )
}
