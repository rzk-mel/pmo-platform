import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, UserRole } from '@/types'
import { supabase, getCurrentSession, getCurrentUser, signOut as supabaseSignOut } from '@/lib/supabase'

interface AuthState {
  user: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  isInitialized: boolean
  
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
      isInitialized: false,

      initialize: async () => {
        // Prevent multiple initializations
        if (get().isInitialized) {
          set({ isLoading: false })
          return
        }

        set({ isLoading: true })
        
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Auth timeout')), 10000)
          )

          const authPromise = async () => {
            const { session, error: sessionError } = await getCurrentSession()
            
            if (sessionError || !session) {
              return { user: null, isAuthenticated: false }
            }

            const { user: authUser, error: userError } = await getCurrentUser()
            
            if (userError || !authUser) {
              return { user: null, isAuthenticated: false }
            }

            // Fetch profile from database
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authUser.id)
              .single()

            if (profileError || !profile) {
              console.error('Failed to fetch profile:', profileError)
              // User is authenticated but has no profile - still allow access
              return { 
                user: null, 
                isAuthenticated: true 
              }
            }

            return { 
              user: profile as Profile, 
              isAuthenticated: true 
            }
          }

          const result = await Promise.race([authPromise(), timeoutPromise])
          
          set({ 
            user: result.user,
            isAuthenticated: result.isAuthenticated, 
            isLoading: false,
            isInitialized: true
          })
        } catch (error) {
          console.error('Auth initialization error:', error)
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            isInitialized: true
          })
        }
      },

      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: !!user,
          isLoading: false,
          isInitialized: true
        })
      },

      signOut: async () => {
        await supabaseSignOut()
        set({ 
          user: null, 
          isAuthenticated: false,
          isInitialized: true
        })
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
      // On rehydrate, reset loading state
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = true
          state.isInitialized = false
        }
      },
    }
  )
)

// Subscribe to auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = useAuthStore.getState()
  
  if (event === 'SIGNED_IN' && session?.user) {
    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    
    if (profile) {
      store.setUser(profile as Profile)
    } else {
      // User authenticated but no profile
      store.setUser(null)
      useAuthStore.setState({ isAuthenticated: true, isLoading: false })
    }
  } else if (event === 'SIGNED_OUT') {
    store.setUser(null)
  } else if (event === 'TOKEN_REFRESHED') {
    // Token refreshed, no action needed
  }
})

