import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export type UserRole = 'pelajar' | 'pemateri' | 'admin'

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000 // 30 minutes in milliseconds
const LAST_ACTIVITY_KEY   = 'kaiwa_last_activity_timestamp'

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
  sessionExpiredNotice: string | null
  clearSessionNotice: () => void
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
  streak_days: 0,
  last_active_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  sessionExpiredNotice: null,
  clearSessionNotice: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(() => {
    const custom = localStorage.getItem('kaiwa_custom_profile')
    if (custom) {
      try { return JSON.parse(custom) } catch {}
    }
    return DEFAULT_DEMO_PROFILE
  })
  const [loading, setLoading] = useState(true)
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    return localStorage.getItem('kaiwa_session_expired_reason')
  })

  function clearSessionNotice() {
    localStorage.removeItem('kaiwa_session_expired_reason')
    setSessionExpiredNotice(null)
  }

  // Update activity timestamp in local storage
  const updateActivity = () => {
    const now = Date.now()
    const storedStr = localStorage.getItem(LAST_ACTIVITY_KEY)
    const stored = storedStr ? parseInt(storedStr, 10) : 0
    // Throttle to update at most once every 5 seconds
    if (now - stored > 5000) {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
    }
  }

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) {
      setProfile(data as Profile)
      localStorage.setItem('kaiwa_custom_profile', JSON.stringify(data))
    }
  }

  async function refreshProfile() {
    const custom = localStorage.getItem('kaiwa_custom_profile')
    if (custom) {
      try {
        setProfile(JSON.parse(custom))
        return
      } catch {}
    }
    if (session?.user?.id) {
      await fetchProfile(session.user.id)
    }
  }

  async function signOut(reason?: string) {
    await supabase.auth.signOut()
    setSession(null)
    localStorage.removeItem('kaiwa_custom_profile')
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    setProfile(null)

    if (reason) {
      localStorage.setItem('kaiwa_session_expired_reason', reason)
      setSessionExpiredNotice(reason)
    }
  }

  useEffect(() => {
    // Record initial activity time
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
    }

    // Activity event listeners
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    const handleUserActivity = () => updateActivity()

    activityEvents.forEach(evt => {
      window.addEventListener(evt, handleUserActivity, { passive: true })
    })

    // Inactivity check interval every 10 seconds
    const interval = setInterval(() => {
      const storedStr = localStorage.getItem(LAST_ACTIVITY_KEY)
      if (storedStr) {
        const lastActive = parseInt(storedStr, 10)
        if (Date.now() - lastActive > INACTIVITY_LIMIT_MS) {
          signOut('Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 30 menit demi keamanan akun.')
        }
      }
    }, 10000)

    const handleProfileUpdate = () => {
      const custom = localStorage.getItem('kaiwa_custom_profile')
      if (custom) {
        try { setProfile(JSON.parse(custom)) } catch {}
      }
    }

    window.addEventListener('kaiwa_profile_updated', handleProfileUpdate)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        const custom = localStorage.getItem('kaiwa_custom_profile')
        if (custom) {
          try { setProfile(JSON.parse(custom)) } catch {}
        } else {
          setProfile(DEFAULT_DEMO_PROFILE)
        }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        const custom = localStorage.getItem('kaiwa_custom_profile')
        if (custom) {
          try { setProfile(JSON.parse(custom)) } catch {}
        } else {
          setProfile(DEFAULT_DEMO_PROFILE)
        }
      }
    })

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, handleUserActivity)
      })
      clearInterval(interval)
      window.removeEventListener('kaiwa_profile_updated', handleProfileUpdate)
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      sessionExpiredNotice,
      clearSessionNotice,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
