import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Family, Profile } from '@/lib/database.types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  family: Family | null
  loading: boolean
  /** logged in but not yet attached to a family */
  needsFamily: boolean
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  createFamily: (name: string) => Promise<Family>
  joinFamily: (token: string) => Promise<Family>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    family: null,
    loading: true,
    needsFamily: false,
  })
  const initialized = useRef(false)

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('loadProfile', error)
      return null
    }
    return data as Profile | null
  }, [])

  const loadFamily = useCallback(async (familyId: string): Promise<Family | null> => {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .maybeSingle()
    if (error) {
      console.error('loadFamily', error)
      return null
    }
    return data as Family | null
  }, [])

  const hydrate = useCallback(
    async (session: Session | null) => {
      if (!session?.user) {
        setState({
          session: null,
          profile: null,
          family: null,
          loading: false,
          needsFamily: false,
        })
        return
      }
      const profile = await loadProfile(session.user.id)
      const family = profile?.family_id ? await loadFamily(profile.family_id) : null
      setState({
        session,
        profile,
        family,
        loading: false,
        needsFamily: !profile?.family_id,
      })
    },
    [loadProfile, loadFamily],
  )

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    supabase.auth.getSession().then(({ data }) => hydrate(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [hydrate])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await hydrate(data.session)
  }, [hydrate])

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw error
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const createFamily = useCallback(
    async (name: string): Promise<Family> => {
      const { data, error } = await supabase.rpc('create_family', { family_name: name })
      if (error) throw error
      await refreshProfile()
      return data as Family
    },
    [refreshProfile],
  )

  const joinFamily = useCallback(
    async (token: string): Promise<Family> => {
      const { data, error } = await supabase.rpc('join_family', { invite_token: token })
      if (error) throw error
      await refreshProfile()
      return data as Family
    },
    [refreshProfile],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signUp,
      signIn,
      signOut,
      createFamily,
      joinFamily,
      refreshProfile,
    }),
    [state, signUp, signIn, signOut, createFamily, joinFamily, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
