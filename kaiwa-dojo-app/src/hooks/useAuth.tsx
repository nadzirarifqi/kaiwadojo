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
  institution?: string | null
  avatar_url: string | null
  bio: string | null
  role: UserRole
  streak_days: number
  status?: 'approved' | 'pending' | 'rejected'
  last_active_at: string | null
  current_session_id?: string | null
  current_device_info?: string | null
  last_session_at?: string | null
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
  signOut: (reason?: string) => Promise<void>
  refreshProfile: () => Promise<void>
}


const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  sessionExpiredNotice: null,
  clearSessionNotice: () => {},
  signOut: async (_reason?: string) => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(() => {
    // ── FORCE-CLEAR all legacy localStorage auth data on every boot ──
    localStorage.removeItem('kaiwa_custom_profile')
    localStorage.removeItem('kaiwa_session_active')

    // Check if browser session is active (sessionStorage lives only while tab/browser is open)
    const isActive = sessionStorage.getItem('kaiwa_session_active') === 'true'
    if (!isActive) {
      sessionStorage.removeItem('kaiwa_custom_profile')
      sessionStorage.removeItem('kaiwa_session_active')
      sessionStorage.removeItem('kaiwa_client_session_id')
      return null
    }

    // Restore profile from sessionStorage if browser session is active
    const raw = sessionStorage.getItem('kaiwa_custom_profile')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.id && parsed.role) {
          return parsed
        }
      } catch {}
    }
    return null
  })
  const [loading, setLoading] = useState(true)
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    return localStorage.getItem('kaiwa_session_expired_reason')
  })

  function clearSessionNotice() {
    localStorage.removeItem('kaiwa_session_expired_reason')
    setSessionExpiredNotice(null)
  }

  const LAST_HEARTBEAT_KEY = 'kaiwa_last_presence_heartbeat'

  // Send presence heartbeat to Supabase DB to track online status & verify active session
  const sendPresenceHeartbeat = async (userId: string) => {
    if (!userId) return
    const now = Date.now()
    const lastHbStr = sessionStorage.getItem(LAST_HEARTBEAT_KEY)
    const lastHb = lastHbStr ? parseInt(lastHbStr, 10) : 0

    // Throttle heartbeat to at most once per 60 seconds
    if (now - lastHb < 60000) return

    sessionStorage.setItem(LAST_HEARTBEAT_KEY, now.toString())
    try {
      const { data: dbProf } = await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId)
        .select('current_session_id, current_device_info')
        .maybeSingle()

      // Check if session has been taken over by another device
      if (dbProf?.current_session_id) {
        const mySessionId = sessionStorage.getItem('kaiwa_client_session_id')
        if (mySessionId && dbProf.current_session_id !== mySessionId) {
          const otherDevice = dbProf.current_device_info || 'Perangkat Lain'
          signOut(`Akun Anda telah masuk di perangkat lain (${otherDevice}). Anda telah dikeluarkan dari perangkat ini demi keamanan dan konsistensi data.`)
        }
      }
    } catch {}
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

    // Also trigger throttled presence heartbeat for active profile
    if (profile?.id) {
      sendPresenceHeartbeat(profile.id)
    }
  }

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) {
      if (data.role === 'pelajar' && (data.status === 'rejected' || data.status === 'pending')) {
        signOut(data.status === 'rejected' ? 'Akun Anda telah dinonaktifkan / ditolak oleh Admin.' : 'Akun Anda masih dalam proses verifikasi Admin.')
        return
      }

      // Check single active device session
      const mySessionId = sessionStorage.getItem('kaiwa_client_session_id')
      if (data.current_session_id && mySessionId && data.current_session_id !== mySessionId) {
        const otherDevice = data.current_device_info || 'Perangkat Lain'
        signOut(`Akun Anda telah masuk di perangkat lain (${otherDevice}). Anda telah dikeluarkan dari perangkat ini demi keamanan dan konsistensi data.`)
        return
      }

      setProfile(data as Profile)
      sessionStorage.setItem('kaiwa_session_active', 'true')
      sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(data))
    }
  }

  async function refreshProfile() {
    const custom = sessionStorage.getItem('kaiwa_custom_profile') || localStorage.getItem('kaiwa_custom_profile')
    if (custom) {
      try {
        const parsed = JSON.parse(custom)
        if (parsed?.id) {
          const { data: dbProf } = await supabase.from('profiles').select('*').eq('id', parsed.id).maybeSingle()
          if (dbProf) {
            const merged = { ...parsed, ...dbProf }
            sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(merged))
            localStorage.setItem('kaiwa_custom_profile', JSON.stringify(merged))
            setProfile(merged)
            return
          }
        }
        setProfile(parsed)
        return
      } catch {}
    }
    if (session?.user?.id) {
      await fetchProfile(session.user.id)
    }
  }

  async function signOut(reason?: string) {
    await supabase.auth.signOut().catch(() => {})
    sessionStorage.removeItem('kaiwa_session_active')
    sessionStorage.removeItem('kaiwa_custom_profile')
    sessionStorage.removeItem('kaiwa_client_session_id')
    localStorage.removeItem('kaiwa_custom_profile')
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    setSession(null)
    setProfile(null)

    if (reason) {
      localStorage.setItem('kaiwa_session_expired_reason', reason)
      setSessionExpiredNotice(reason)
    }
  }

  // ── Realtime Single Active Session Guard ──
  // If another device logs in and takes over the session, kick this device immediately
  useEffect(() => {
    if (!profile?.id) return

    const mySessionId = sessionStorage.getItem('kaiwa_client_session_id')
    if (!mySessionId) return

    const sessionGuardChannel = supabase
      .channel(`profile_session_guard_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload: any) => {
          const newProfile = payload.new
          if (newProfile && newProfile.current_session_id) {
            const currentClientSess = sessionStorage.getItem('kaiwa_client_session_id')
            if (currentClientSess && newProfile.current_session_id !== currentClientSess) {
              const otherDevice = newProfile.current_device_info || 'Perangkat Lain'
              signOut(
                `Akun Anda baru saja masuk di perangkat lain (${otherDevice}). Anda telah dikeluarkan dari perangkat ini demi keamanan dan konsistensi data.`
              )
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionGuardChannel)
    }
  }, [profile?.id])

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
      const isBrowserSessionActive = sessionStorage.getItem('kaiwa_session_active') === 'true'
      if (!isBrowserSessionActive) return
      const custom = sessionStorage.getItem('kaiwa_custom_profile')
      if (custom) {
        try {
          const parsed = JSON.parse(custom)
          if (parsed && parsed.id) {
            setProfile(parsed)
            setLoading(false)
          }
        } catch {}
      }
    }

    window.addEventListener('kaiwa_profile_updated', handleProfileUpdate)

    // Check browser session status
    const isBrowserSessionActive = sessionStorage.getItem('kaiwa_session_active') === 'true'
    if (!isBrowserSessionActive) {
      // Browser was newly opened or tab restarted — purge legacy tokens and enforce guest state
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('sb-') || k.includes('kaiwa_custom_profile'))) {
          localStorage.removeItem(k)
        }
      }
      sessionStorage.removeItem('kaiwa_custom_profile')
      sessionStorage.removeItem('kaiwa_session_active')
      sessionStorage.removeItem('kaiwa_client_session_id')
      localStorage.removeItem(LAST_ACTIVITY_KEY)
      supabase.auth.signOut().catch(() => {})
      setSession(null)
      setProfile(null)
      setLoading(false)
    } else {
      // Restore cached profile from sessionStorage immediately for 0ms Instant Entry
      const customStr = sessionStorage.getItem('kaiwa_custom_profile')
      if (customStr) {
        try {
          const parsed = JSON.parse(customStr)
          if (parsed && parsed.id && parsed.role) {
            setProfile(parsed)
          }
        } catch {}
      }
      setLoading(false)

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && sessionStorage.getItem('kaiwa_session_active') === 'true') {
          setSession(session)
          fetchProfile(session.user.id).catch(() => {}).finally(() => setLoading(false))
        } else {
          setLoading(false)
        }
      })
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const active = sessionStorage.getItem('kaiwa_session_active') === 'true'
      if (active && session?.user) {
        setSession(session)
        const customStr = sessionStorage.getItem('kaiwa_custom_profile')
        if (customStr) {
          try {
            const parsed = JSON.parse(customStr)
            if (parsed && parsed.id) {
              setProfile(parsed)
              setLoading(false)
            }
          } catch {}
        }
        fetchProfile(session.user.id).catch(() => {}).finally(() => setLoading(false))
      } else if (!active) {
        setSession(null)
        setProfile(null)
        setLoading(false)
      } else {
        setSession(session)
        const customStr = sessionStorage.getItem('kaiwa_custom_profile')
        if (customStr) {
          try {
            const parsed = JSON.parse(customStr)
            if (parsed && parsed.id && parsed.role) {
              setProfile(parsed)
            }
          } catch {}
        }
        setLoading(false)
      }
    })

    // Periodic presence heartbeat every 2 minutes while tab is open
    const heartbeatInterval = setInterval(() => {
      const customStr = sessionStorage.getItem('kaiwa_custom_profile')
      if (customStr) {
        try {
          const parsed = JSON.parse(customStr)
          if (parsed?.id) {
            sendPresenceHeartbeat(parsed.id)
          }
        } catch {}
      }
    }, 120000)

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, handleUserActivity)
      })
      clearInterval(interval)
      clearInterval(heartbeatInterval)
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
