import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, UserRole } from '@/types'
import { supabase, getCurrentSession, getCurrentUser, signOut as supabaseSignOut } from '@/lib/supabase'

interface AuthState {
  user: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Actions
  initialize: () => Promise<void>
  setUser: (user: Profile | null) => void
  signOut: () => Promise<void>
  
  // Role helpers
  hasRole: (role: UserRole) => boolean
  hasMinimumRole: (role: UserRole) => boolean
}

const ROLE_HIERARCHY: UserRole[] = [
  'viewer',
  'client_stakeholder',
  'developer',
  'tech_lead',
  'project_manager',
  'org_admin',
  'super_admin',
]

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      initialize: async () => {
        set({ isLoading: true })
        
        try {
          const { session, error: sessionError } = await getCurrentSession()
          
          if (sessionError || !session) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          const { user: authUser, error: userError } = await getCurrentUser()
          
          if (userError || !authUser) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          // Fetch profile from database
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()

          if (profileError || !profile) {
            console.error('Failed to fetch profile:', profileError)
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          set({ 
            user: profile as Profile, 
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (error) {
          console.error('Auth initialization error:', error)
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: !!user,
          isLoading: false 
        })
      },

      signOut: async () => {
        await supabaseSignOut()
        set({ user: null, isAuthenticated: false })
      },

      hasRole: (role) => {
        const { user } = get()
        return user?.role === role
      },

      hasMinimumRole: (requiredRole) => {
        const { user } = get()
        if (!user) return false
        
        const userIndex = ROLE_HIERARCHY.indexOf(user.role)
        const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole)
        return userIndex >= requiredIndex
      },
    }),
    {
      name: 'pmo-auth',
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Subscribe to auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    
    if (profile) {
      useAuthStore.getState().setUser(profile as Profile)
    }
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.getState().setUser(null)
  }
})
