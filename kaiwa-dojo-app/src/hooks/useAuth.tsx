import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export type UserRole = 'pelajar' | 'pemateri' | 'admin'

export interface Profile {
  id: string
  full_name: string
  username: string
  email: string | null
  phone_number: string | null
  avatar_url: string | null
  bio: string | null
  role: UserRole
  streak_days: number
  last_active_at: string | null
  created_at: string
  updated_at: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const DEFAULT_DEMO_PROFILE: Profile = {
  id: 'user-demo-active',
  full_name: 'Budi Santoso',
  username: 'budisantoso',
  email: 'budi@kaiwadojo.com',
  phone_number: '08123456789',
  avatar_url: null,
  bio: 'Semangat belajar Bahasa Jepang untuk persiapan kerja & magang!',
  role: 'pelajar',
  streak_days: 12,
  last_active_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(DEFAULT_DEMO_PROFILE)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) {
      setProfile(data as Profile)
    }
  }

  async function refreshProfile() {
    if (session?.user?.id) {
      await fetchProfile(session.user.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(DEFAULT_DEMO_PROFILE)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(DEFAULT_DEMO_PROFILE)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(DEFAULT_DEMO_PROFILE)
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
